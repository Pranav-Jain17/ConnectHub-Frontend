import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebRTC = (socket, roomId, userId) => {
    const [remoteStreams, setRemoteStreams] = useState({});
    const [localStreamReady, setLocalStreamReady] = useState(false);
    const localStreamRef = useRef(null);
    const peerConnectionsRef = useRef({});
    const pendingCandidatesRef = useRef({});

    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    };

    const handleUserDisconnected = useCallback((remoteUserId) => {
        console.log('🔴 user-disconnected:', remoteUserId);
        if (peerConnectionsRef.current[remoteUserId]) {
            try {
                peerConnectionsRef.current[remoteUserId].close();
            } catch (e) {
                console.error("Error closing PC", e);
            }
            delete peerConnectionsRef.current[remoteUserId];
        }
        if (pendingCandidatesRef.current[remoteUserId]) {
            delete pendingCandidatesRef.current[remoteUserId];
        }
        setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[remoteUserId];
            return next;
        });
    }, []);

    useEffect(() => {
        let mounted = true;
        const getLocalStream = async () => {
            try {
                console.log('🎥 Requesting local media stream...');
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                });

                if (!mounted) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }

                localStreamRef.current = stream;
                setLocalStreamReady(true);
                console.log('✅ Local stream acquired:', stream.id);
            } catch (err) {
                console.error('❌ Error accessing media devices:', err);
                alert('Cannot access camera/microphone. Please grant permissions and reload the page.');
            }
        };

        getLocalStream();

        return () => {
            mounted = false;
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
            }
            Object.values(peerConnectionsRef.current).forEach((pc) => {
                try { pc.close(); } catch (e) { }
            });
        };
    }, []);

    useEffect(() => {
        if (!socket || !roomId || !userId) return;
        const createPeerConnection = (remoteUserId) => {
            console.log('\n🔗 Creating PeerConnection for', remoteUserId);

            if (peerConnectionsRef.current[remoteUserId]) {
                console.log('ℹ️ Reusing existing PeerConnection for', remoteUserId);
                return peerConnectionsRef.current[remoteUserId];
            }

            const pc = new RTCPeerConnection(iceServers);
            peerConnectionsRef.current[remoteUserId] = pc;

            // Add local tracks if available
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    try {
                        pc.addTrack(track, localStreamRef.current);
                        console.log('➕ Added local track to PC:', track.kind);
                    } catch (err) {
                        console.warn('⚠️ addTrack failed:', err);
                    }
                });
            } else {
                console.warn('⚠️ Local stream not available when creating PC for', remoteUserId);
            }

            pc.ontrack = (event) => {
                console.log('📥 ontrack fired for', remoteUserId, event);
                let incomingStream = null;
                if (event.streams && event.streams[0]) {
                    incomingStream = event.streams[0];
                } else {
                    incomingStream = new MediaStream();
                    if (event.track) incomingStream.addTrack(event.track);
                }

                setRemoteStreams((prev) => {
                    const existing = prev[remoteUserId];
                    if (!existing) {
                        return { ...prev, [remoteUserId]: incomingStream };
                    } else {
                        incomingStream.getTracks().forEach((t) => {
                            const already = existing.getTracks().some((et) => et.id === t.id);
                            if (!already) existing.addTrack(t);
                        });
                        return { ...prev, [remoteUserId]: existing };
                    }
                });
                console.log('✅ Remote stream set/updated for', remoteUserId);
            };

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    const candidate = (typeof event.candidate.toJSON === 'function')
                        ? event.candidate.toJSON()
                        : event.candidate;
                    socket.emit('ice-candidate', {
                        toUserId: remoteUserId,
                        fromUserId: userId,
                        candidate,
                    });
                }
            };

            // pc.onconnectionstatechange = () => {
            //     console.log(`🔌 connectionState (${remoteUserId}):`, pc.connectionState);
            //     if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            //         console.warn('⚠️ connectionState is failed/disconnected for', remoteUserId, '-- attempting ICE restart');
            //     }
            // };
            pc.onconnectionstatechange = () => {
                const state = pc.connectionState;
                console.log(`🔌 connectionState (${remoteUserId}):`, state);

                if (state === 'failed') {
                    console.warn('⚠️ Connection failed. Cleaning up...');
                    handleUserDisconnected(remoteUserId);
                }
            };

            // const pending = pendingCandidatesRef.current[remoteUserId];
            // if (pending && pending.length) {
            //     console.log('⏳ Draining', pending.length, 'pending candidates for', remoteUserId);
            //     (async () => {
            //         for (const cand of pending) {
            //             try {
            //                 const normalized = (cand instanceof RTCIceCandidate) ? cand : new RTCIceCandidate(cand);
            //                 await pc.addIceCandidate(normalized);
            //             } catch (err) {
            //                 console.error('❌ Error adding pending candidate for', remoteUserId, err);
            //             }
            //         }
            //     })();
            //     delete pendingCandidatesRef.current[remoteUserId];
            // }

            return pc;
        };

        const drainCandidates = async (remoteUserId) => {
            const pc = peerConnectionsRef.current[remoteUserId];
            const queue = pendingCandidatesRef.current[remoteUserId];

            if (pc && pc.remoteDescription && queue && queue.length > 0) {
                console.log(`📥 Draining ${queue.length} candidates for ${remoteUserId}`);
                while (queue.length > 0) {
                    const candidate = queue.shift();
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (err) {
                        console.error("❌ Error adding drained candidate:", err);
                    }
                }
            }
        };

        const handleUserConnected = async (remoteUserId) => {
            console.log('👤 user-connected:', remoteUserId);
            if (!remoteUserId || remoteUserId === userId) return;
            const pc = createPeerConnection(remoteUserId);
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                console.log('📤 Emitting offer to server → target:', remoteUserId);
                socket.emit('signal', remoteUserId, { type: offer.type, sdp: offer.sdp });
            } catch (err) {
                console.error('❌ Error creating/sending offer to', remoteUserId, err);
            }
        };

        const handleSignal = async (fromUserId, data) => {
            console.log('📥 signal received from', fromUserId, 'type:', data?.type);
            if (!fromUserId || !data || fromUserId === userId) return;

            let pc = peerConnectionsRef.current[fromUserId];

            if (data.type === 'offer') {
                if (!pc) pc = createPeerConnection(fromUserId);
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(data));
                    await drainCandidates(fromUserId);

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('signal', fromUserId, { type: 'answer', sdp: answer.sdp });
                } catch (err) {
                    console.error('❌ Error handling offer:', err);
                }
            } else if (data.type === 'answer') {
                if (!pc) return;
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(data));
                    await drainCandidates(fromUserId);
                } catch (err) {
                    console.error('❌ Error applying answer:', err);
                }
            }
        };

        const handleIceCandidate = async (payload) => {
            const { fromUserId, candidate } = payload || {};
            if (!candidate || !fromUserId) return;

            const pc = peerConnectionsRef.current[fromUserId];

            if (pc && pc.remoteDescription) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('✅ Added ICE candidate immediately');
                } catch (err) {
                    console.error('❌ Error adding ICE candidate:', err);
                }
            } else {
                console.log('⏳ Queueing candidate for', fromUserId);
                if (!pendingCandidatesRef.current[fromUserId]) {
                    pendingCandidatesRef.current[fromUserId] = [];
                }
                pendingCandidatesRef.current[fromUserId].push(candidate);
            }
        };

        // const handleUserDisconnected = (remoteUserId) => {
        //     console.log('🔴 user-disconnected:', remoteUserId);
        //     if (peerConnectionsRef.current[remoteUserId]) {
        //         try { peerConnectionsRef.current[remoteUserId].close(); } catch (e) { }
        //         delete peerConnectionsRef.current[remoteUserId];
        //     }

        //     setRemoteStreams((prev) => {
        //         const next = { ...prev };
        //         delete next[remoteUserId];
        //         return next;
        //     });
        // };

        socket.on('user-connected', handleUserConnected);
        socket.on('signal', handleSignal);
        socket.on('ice-candidate', handleIceCandidate);
        socket.on('user-disconnected', handleUserDisconnected);

        return () => {
            socket.off('user-connected', handleUserConnected);
            socket.off('signal', handleSignal);
            socket.off('ice-candidate', handleIceCandidate);
            socket.off('user-disconnected', handleUserDisconnected);
        };
    }, [socket, roomId, userId, handleUserDisconnected]);

    useEffect(() => {
        if (socket && roomId && userId && localStreamReady) {
            console.log("✅ Camera ready. Emitting join-room...");
            socket.emit('join-room', roomId, userId);
        }
    }, [socket, roomId, userId, localStreamReady]);

    const toggleMic = useCallback(() => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getAudioTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                console.log(track.enabled ? '🎤 Mic ON' : '🔇 Mic OFF');
                return track.enabled;
            }
        }
        return true;
    }, []);

    const toggleVideo = useCallback(() => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getVideoTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                console.log(track.enabled ? '📹 Video ON' : '📴 Video OFF');
                return track.enabled;
            }
        }
        return true;
    }, []);

    return {
        localStream: localStreamRef.current,
        localStreamReady,
        remoteStreams,
        toggleMic,
        toggleVideo,
    };
};
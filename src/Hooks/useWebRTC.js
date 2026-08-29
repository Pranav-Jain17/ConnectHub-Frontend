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
            // optionally add TURN server here for relay fallback
        ],
    };

    // ---------------------------------------------------------
    // 🎥 EFFECT 1: Acquire Media (Camera/Mic)
    // ---------------------------------------------------------
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
            // Close all PCs on unmount
            Object.values(peerConnectionsRef.current).forEach((pc) => {
                try { pc.close(); } catch (e) { }
            });
        };
    }, []);

    // ---------------------------------------------------------
    // ⚡ EFFECT 2: Socket Signaling (The Fix)
    // ---------------------------------------------------------
    useEffect(() => {
        // REMOVED: (!localStreamReady) check. 
        // We must listen for signals immediately, even if camera is loading.
        if (!socket || !roomId || !userId) return;

        // --- Helper: Create Peer Connection ---
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

            pc.onconnectionstatechange = () => {
                console.log(`🔌 connectionState (${remoteUserId}):`, pc.connectionState);
                if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                    console.warn('⚠️ connectionState is failed/disconnected for', remoteUserId, '-- attempting ICE restart');
                    // Optional: logic to restart ICE
                }
            };

            // drain pending ICE candidates
            const pending = pendingCandidatesRef.current[remoteUserId];
            if (pending && pending.length) {
                console.log('⏳ Draining', pending.length, 'pending candidates for', remoteUserId);
                (async () => {
                    for (const cand of pending) {
                        try {
                            const normalized = (cand instanceof RTCIceCandidate) ? cand : new RTCIceCandidate(cand);
                            await pc.addIceCandidate(normalized);
                        } catch (err) {
                            console.error('❌ Error adding pending candidate for', remoteUserId, err);
                        }
                    }
                })();
                delete pendingCandidatesRef.current[remoteUserId];
            }

            return pc;
        };

        // --- Socket Event Handlers ---

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
                    await pc.setRemoteDescription(new RTCSessionDescription({ type: data.type, sdp: data.sdp }));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    console.log('📤 Emitting answer back to', fromUserId);
                    socket.emit('signal', fromUserId, { type: 'answer', sdp: answer.sdp });
                } catch (err) {
                    console.error('❌ Error handling offer from', fromUserId, err);
                }
            } else if (data.type === 'answer') {
                if (!pc) {
                    console.error('❌ Received answer but no PC exists for', fromUserId);
                    return;
                }
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(data));
                    console.log('✅ Answer applied for', fromUserId);
                } catch (err) {
                    console.error('❌ Error applying answer from', fromUserId, err);
                }
            }
        };

        const handleIceCandidate = async (payload) => {
            const { fromUserId, candidate } = payload || {};
            if (!candidate || !fromUserId) return;

            const pc = peerConnectionsRef.current[fromUserId];
            if (pc) {
                try {
                    const candObj = (candidate instanceof RTCIceCandidate) ? candidate : new RTCIceCandidate(candidate);
                    await pc.addIceCandidate(candObj);
                    console.log('✅ Added ICE candidate for', fromUserId);
                } catch (err) {
                    console.error('❌ Error adding ICE candidate for', fromUserId, err);
                }
            } else {
                console.log('⏳ No PC for', fromUserId, '- queueing candidate');
                if (!pendingCandidatesRef.current[fromUserId]) pendingCandidatesRef.current[fromUserId] = [];
                pendingCandidatesRef.current[fromUserId].push(candidate);
            }
        };

        const handleUserDisconnected = (remoteUserId) => {
            console.log('🔴 user-disconnected:', remoteUserId);
            if (peerConnectionsRef.current[remoteUserId]) {
                try { peerConnectionsRef.current[remoteUserId].close(); } catch (e) { }
                delete peerConnectionsRef.current[remoteUserId];
            }
            setRemoteStreams((prev) => {
                const next = { ...prev };
                delete next[remoteUserId];
                return next;
            });
        };

        // Attach listeners IMMEDIATELY
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
    }, [socket, roomId, userId]); // Dependencies are stable now

    // ---------------------------------------------------------
    // 🚀 EFFECT 3: Join Room (Only when Camera Ready)
    // ---------------------------------------------------------
    useEffect(() => {
        // Only join when camera is ready to ensure tracks are added
        if (socket && roomId && userId && localStreamReady) {
            console.log("✅ Camera ready. Emitting join-room...");
            socket.emit('join-room', roomId, userId);
        }
    }, [socket, roomId, userId, localStreamReady]);

    // Utilities
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
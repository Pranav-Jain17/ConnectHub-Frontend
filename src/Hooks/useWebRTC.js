import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebRTC = (socket, roomId, userId) => {
    const [remoteStreams, setRemoteStreams] = useState({});
    const [localStreamReady, setLocalStreamReady] = useState(false);
    const localStreamRef = useRef(null);
    const peerConnectionsRef = useRef({});
    // queue ICE candidates that arrive before a PeerConnection exists for that user
    const pendingCandidatesRef = useRef({});

    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    };

    // Acquire local media
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
                    // stop tracks if component unmounted during async call
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
                localStreamRef.current.getTracks().forEach((t) => {
                    try { t.stop(); } catch (e) { /* ignore */ }
                });
            }
            Object.values(peerConnectionsRef.current).forEach((pc) => {
                try { pc.close(); } catch (e) { /* ignore */ }
            });
        };
    }, []);

    useEffect(() => {
        if (!socket || !roomId || !userId || !localStreamReady) {
            console.warn('⚠️ Prerequisites not met:', {
                socket: !!socket,
                roomId: !!roomId,
                userId: !!userId,
                localStreamReady,
            });
            return;
        }

        console.log('✅ All prerequisites met - setting up WebRTC');

        const createPeerConnection = (remoteUserId) => {
            console.log('\n🔗 Creating PeerConnection for', remoteUserId);

            if (peerConnectionsRef.current[remoteUserId]) {
                console.log('ℹ️ Reusing existing PeerConnection for', remoteUserId);
                return peerConnectionsRef.current[remoteUserId];
            }

            const pc = new RTCPeerConnection(iceServers);
            peerConnectionsRef.current[remoteUserId] = pc;

            // Add local stream tracks to pc
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

            // Robust ontrack: support event.streams[] or per-track events
            pc.ontrack = (event) => {
                console.log('📥 ontrack fired for', remoteUserId, 'track:', event.track?.kind);
                let incomingStream = null;

                if (event.streams && event.streams[0]) {
                    incomingStream = event.streams[0];
                } else {
                    // create a new MediaStream and add the track
                    incomingStream = new MediaStream();
                    if (event.track) incomingStream.addTrack(event.track);
                }

                setRemoteStreams((prev) => {
                    const existing = prev[remoteUserId];
                    if (!existing) {
                        return { ...prev, [remoteUserId]: incomingStream };
                    } else {
                        // merge tracks into existing MediaStream (avoid replacing the object reference used by video elements)
                        incomingStream.getTracks().forEach((t) => {
                            // avoid duplicate tracks
                            const already = existing.getTracks().some((et) => et.id === t.id);
                            if (!already) existing.addTrack(t);
                        });
                        return { ...prev, [remoteUserId]: existing };
                    }
                });

                console.log('✅ Remote stream set/updated for', remoteUserId);
            };

            // Send ICE candidates to signaling server
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('🧊 onicecandidate -> emitting to server for', remoteUserId);
                    try {
                        socket.emit('ice-candidate', {
                            toUserId: remoteUserId,
                            candidate: event.candidate, // candidate is RTCIceCandidateInit-like
                        });
                    } catch (err) {
                        console.error('❌ Failed to emit ice-candidate:', err);
                    }
                } else {
                    console.log('🧊 onicecandidate: all candidates sent for', remoteUserId);
                }
            };

            pc.onconnectionstatechange = () => {
                console.log(`🔌 connectionState (${remoteUserId}):`, pc.connectionState);
                if (pc.connectionState === 'failed') {
                    try { pc.restartIce(); } catch (e) { console.warn('restartIce failed', e); }
                }
            };

            pc.oniceconnectionstatechange = () => {
                console.log(`🧊 iceConnectionState (${remoteUserId}):`, pc.iceConnectionState);
            };

            // Drain any pending ICE candidates that arrived early
            const pending = pendingCandidatesRef.current[remoteUserId];
            if (pending && pending.length) {
                console.log('⏳ Draining', pending.length, 'pending ICE candidates for', remoteUserId);
                pending.forEach(async (cand) => {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(cand));
                        console.log('✅ Added pending candidate for', remoteUserId);
                    } catch (err) {
                        console.error('❌ Error adding pending candidate for', remoteUserId, err);
                    }
                });
                delete pendingCandidatesRef.current[remoteUserId];
            }

            return pc;
        };

        // join room
        const handleConnect = () => {
            console.log('📡 socket connected, emitting join-room', socket.id);
            // server expects (roomId, userId)
            socket.emit('join-room', roomId, userId);
        };

        if (socket.connected) handleConnect();
        else socket.on('connect', handleConnect);

        // A new user joined the room -> create offer for them
        const handleUserConnected = async (remoteUserId) => {
            console.log('👤 user-connected:', remoteUserId);
            if (!remoteUserId || remoteUserId === userId) return;

            const pc = createPeerConnection(remoteUserId);
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                // send the whole offer (type + sdp) — server will re-emit with fromUserId
                console.log('📤 Emitting signal (offer) to server -> target:', remoteUserId);
                socket.emit('signal', remoteUserId, offer);
            } catch (err) {
                console.error('❌ Error creating/sending offer to', remoteUserId, err);
            }
        };

        // Handle incoming signal from server: (fromUserId, data)
        const handleSignal = async (fromUserId, data) => {
            console.log('📥 signal received from', fromUserId, 'type:', data?.type);
            if (!fromUserId || !data) {
                console.warn('⚠️ signal missing fromUserId or data', fromUserId, data);
                return;
            }
            if (fromUserId === userId) {
                console.log('⚠️ Ignoring self signal');
                return;
            }

            let pc = peerConnectionsRef.current[fromUserId];
            if (data.type === 'offer') {
                if (!pc) pc = createPeerConnection(fromUserId);

                try {
                    // data has { type, sdp }
                    await pc.setRemoteDescription(new RTCSessionDescription(data));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    console.log('📤 Emitting signal (answer) back to', fromUserId);
                    socket.emit('signal', fromUserId, answer);
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
            } else {
                console.warn('⚠️ Unknown signal type:', data.type);
            }
        };

        // Handle ICE candidate relayed from server. server emits object containing at least fromUserId and candidate.
        const handleIceCandidate = async (payload) => {
            // payload might be { fromUserId, candidate } or it might include extra fields (fromSocketId etc.)
            const { fromUserId, candidate } = payload || {};
            console.log('🧊 ice-candidate received from', fromUserId);

            if (!candidate) {
                console.warn('⚠️ ice-candidate payload missing candidate:', payload);
                return;
            }

            const pc = peerConnectionsRef.current[fromUserId];
            if (pc) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
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
                try { peerConnectionsRef.current[remoteUserId].close(); } catch (e) { /* ignore */ }
                delete peerConnectionsRef.current[remoteUserId];
            }
            setRemoteStreams((prev) => {
                const next = { ...prev };
                delete next[remoteUserId];
                return next;
            });
        };

        // register listeners
        socket.on('user-connected', handleUserConnected);
        socket.on('user-disconnected', handleUserDisconnected);
        socket.on('signal', handleSignal);
        socket.on('ice-candidate', handleIceCandidate);

        // cleanup listeners on effect teardown
        return () => {
            socket.off('connect', handleConnect);
            socket.off('user-connected', handleUserConnected);
            socket.off('user-disconnected', handleUserDisconnected);
            socket.off('signal', handleSignal);
            socket.off('ice-candidate', handleIceCandidate);
        };
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
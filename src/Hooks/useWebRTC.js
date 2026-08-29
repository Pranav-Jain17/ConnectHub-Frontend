import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebRTC = (socket, roomId, userId, userName) => {
    const [remoteStreams, setRemoteStreams] = useState({});
    const [remoteNames, setRemoteNames] = useState({});
    const [localStreamReady, setLocalStreamReady] = useState(false);
    const localStreamRef = useRef(null);
    const peerConnectionsRef = useRef({});
    const pendingCandidatesRef = useRef({});

    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject',
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject',
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject',
            },
        ],
        sdpSemantics: 'unified-plan',
        iceCandidatePoolSize: 10,
    };

    const handleUserDisconnected = useCallback((remoteUserId) => {
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
        setRemoteNames((prev) => {
            const next = { ...prev };
            delete next[remoteUserId];
            return next;
        });
    }, []);

    useEffect(() => {
        let mounted = true;
        const getLocalStream = async () => {
            try {
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
            } catch (err) {
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
            if (peerConnectionsRef.current[remoteUserId]) {
                return peerConnectionsRef.current[remoteUserId];
            }

            const pc = new RTCPeerConnection(iceServers);
            peerConnectionsRef.current[remoteUserId] = pc;

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    try {
                        pc.addTrack(track, localStreamRef.current);
                    } catch (err) {
                        console.warn('addTrack failed:', err);
                    }
                });
            }

            pc.ontrack = (event) => {
                const { streams, track } = event;
                setRemoteStreams((prev) => {
                    const existingStream = prev[remoteUserId];
                    if (streams && streams[0]) {
                        if (!existingStream) {
                            return { ...prev, [remoteUserId]: streams[0] };
                        } else {
                            streams[0].getTracks().forEach(t => {
                                if (!existingStream.getTracks().find(et => et.id === t.id)) {
                                    existingStream.addTrack(t);
                                }
                            });
                            return { ...prev, [remoteUserId]: new MediaStream(existingStream.getTracks()) };
                        }
                    } else {
                        const stream = existingStream || new MediaStream();
                        if (track && !stream.getTracks().find(t => t.id === track.id)) {
                            stream.addTrack(track);
                        }
                        return { ...prev, [remoteUserId]: new MediaStream(stream.getTracks()) };
                    }
                });
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
                const state = pc.connectionState;
                if (state === 'failed') {
                    handleUserDisconnected(remoteUserId);
                }
            };

            return pc;
        };

        const drainCandidates = async (remoteUserId) => {
            const pc = peerConnectionsRef.current[remoteUserId];
            const queue = pendingCandidatesRef.current[remoteUserId];
            if (pc && pc.remoteDescription && queue && queue.length > 0) {
                while (queue.length > 0) {
                    const candidate = queue.shift();
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (err) {
                        console.error(" Error adding drained candidate:", err);
                    }
                }
            }
        };

        const handleUserConnected = async (payload) => {
            const remoteId = typeof payload === 'string' ? payload : payload.userId;
            const remoteName = typeof payload === 'object' ? payload.userName : null;

            if (!remoteId || remoteId === userId) return;
            
            if (remoteName) {
                setRemoteNames(prev => ({ ...prev, [remoteId]: remoteName }));
            }

            const pc = createPeerConnection(remoteId);
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('signal', remoteId, { type: offer.type, sdp: offer.sdp });
            } catch (err) {
                console.error('Error creating/sending offer to', remoteId, err);
            }
        };

        const handleSignal = async (fromUserId, data) => {
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
                    console.error('Error handling offer:', err);
                }
            } else if (data.type === 'answer') {
                if (!pc) return;
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(data));
                    await drainCandidates(fromUserId);
                } catch (err) {
                    console.error('Error applying answer:', err);
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
                } catch (err) {
                    console.error('Error adding ICE candidate:', err);
                }
            } else {
                if (!pendingCandidatesRef.current[fromUserId]) {
                    pendingCandidatesRef.current[fromUserId] = [];
                }
                pendingCandidatesRef.current[fromUserId].push(candidate);
            }
        };

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

    const toggleMic = useCallback(() => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getAudioTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
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
                return track.enabled;
            }
        }
        return true;
    }, []);

    return {
        localStream: localStreamRef.current,
        localStreamReady,
        remoteStreams,
        remoteNames,
        toggleMic,
        toggleVideo,
        peerConnectionsRef,
        localStreamRef,
    };
};
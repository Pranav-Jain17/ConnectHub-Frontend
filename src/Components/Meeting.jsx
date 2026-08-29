import { useEffect, useState, useRef, useMemo, useLayoutEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import "./Styles/meeting.css";
import { useSocket } from "../Providers/Socket";
import { useWebRTC } from "../Hooks/useWebRTC";
import { useParticipants } from "../Hooks/useParticipants";
import ChatPanel from "./ChatPanel";
import ParticipantsPanel from "./ParticipantsPanel";
import VideoGrid from "./VideoGrid";
import MeetingToolbar from "./MeetingToolbar";
import { InfoModal, ConfirmationModal } from "./MeetingModals";

export default function Meeting() {
    const navigate = useNavigate();
    const { roomId } = useParams();
    const { socket } = useSocket();
    const [userId, setUserId] = useState("");
    const [livekitUrl, setLivekitUrl] = useState("");
    const [livekitToken, setLivekitToken] = useState("");
    const [isHost, setIsHost] = useState(false);
    const [hostUserId, setHostUserId] = useState(null);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [peerMicState, setPeerMicState] = useState({});
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
    const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
    const [currentTime, setCurrentTime] = useState("");
    const [isRejoining, setIsRejoining] = useState(false);

    const localVideoRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunkIntervalRef = useRef(null);       // ✅ chunk timer
    const isExitingRef = useRef(false);
    const nameMapRef = useRef({});
    const chatOpenRef = useRef(isChatOpen);
    const participantsOpenRef = useRef(isParticipantsOpen);

    const meetTitle = localStorage.getItem("meetTitle");
    const userName = localStorage.getItem("userName") || "You";
    const { participants } = useParticipants(roomId, socket);
    const loginToken = localStorage.getItem("loginToken");

    const apiRequest = async (url, method, body = null) => {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${loginToken}`
        };
        const config = { method, headers };
        if (body) config.body = JSON.stringify(body);
        const response = await fetch(url, config);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.error || `Status: ${response.status}`);
        return data;
    };

    useEffect(() => {
        if (socket && !socket.connected) socket.connect();
    }, [socket]);

    const {
        localStream,
        localStreamReady,
        remoteStreams,
        toggleMic,
        toggleVideo,
        isScreenSharing,
        toggleScreenShare,
    } = useWebRTC(livekitUrl, livekitToken);

    const isAlone = !remoteStreams || Object.keys(remoteStreams).length === 0;

    const participantNameMap = useMemo(() => {
        const map = {};

        participants.forEach((p) => {
            const displayName = p.username || "Unknown User";
            if (p._id) map[p._id] = displayName;
            if (p.username) map[p.username] = displayName;
        });

        Object.values(remoteStreams).forEach(({ participant }) => {
            if (!participant) return;
            const identity = participant.identity; // now this IS the username
            if (!map[identity]) {
                // identity is username — use it directly
                const livekitName = (participant.name && participant.name !== 'Anonymous')
                    ? participant.name
                    : null;
                map[identity] = livekitName || identity;
            }
        });

        return map;
    }, [participants, remoteStreams]);

    useLayoutEffect(() => { chatOpenRef.current = isChatOpen; }, [isChatOpen]);
    useLayoutEffect(() => { participantsOpenRef.current = isParticipantsOpen; }, [isParticipantsOpen]);
    useEffect(() => { nameMapRef.current = participantNameMap; }, [participantNameMap]);

    // ✅ Initialize meeting — roomId from URL, works on refresh
    useEffect(() => {
        const initializeMeeting = async () => {
            if (!roomId) {
                toast.error("Invalid meeting link.");
                navigate("/home", { replace: true });
                return;
            }

            const storedUserId = localStorage.getItem("userId");
            if (!storedUserId) {
                toast.error("Please log in to join this meeting.");
                navigate("/login", { replace: true });
                return;
            }

            try {
                setIsRejoining(true);

                const joinData = await apiRequest(
                    `https://connecthub.dikshant-ahalawat.live/meetings/${roomId}/join`,
                    'POST',
                    { roomId }
                );

                if (typeof joinData.token !== 'string' || !joinData.token) {
                    toast.error("Failed to retrieve a valid meeting token.");
                    navigate("/home", { replace: true });
                    return;
                }

                const LIVEKIT_URL = "wss://connecthub-7c2knk6r.livekit.cloud";
                setUserId(storedUserId);
                setLivekitUrl(joinData.livekitUrl || LIVEKIT_URL);
                setLivekitToken(joinData.token);
                setIsHost(joinData.meeting?.host_id === storedUserId);

                localStorage.setItem("roomId", roomId);
                localStorage.setItem("isHost", String(joinData.meeting?.host_id === storedUserId));
                if (joinData.meeting?.title) {
                    localStorage.setItem("meetTitle", joinData.meeting.title);
                }

            } catch (error) {
                toast.error(`Could not join meeting: ${error.message}`);
                navigate("/home", { replace: true });
            } finally {
                setIsRejoining(false);
            }
        };

        initializeMeeting();
    }, [roomId]);

    useEffect(() => {
        if (!roomId) return;
        const fetchHostInfo = async () => {
            try {
                const token = localStorage.getItem("loginToken");
                const res = await fetch(
                    `https://connecthub.dikshant-ahalawat.live/meetings/${roomId}/participants`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const data = await res.json();
                if (data.hostUserId) setHostUserId(data.hostUserId);
            } catch (error) {
                console.error("Failed to fetch host info:", error);
            }
        };
        fetchHostInfo();
    }, [roomId]);

    // ✅ Finalize meeting — defined outside useEffect so endMeeting can call it too
    const finalizeMeetingEnd = useCallback(async () => {
        console.log("🏁 Calling /end...");
        const token = localStorage.getItem("loginToken");
        try {
            const res = await fetch('https://connecthub.dikshant-ahalawat.live/meetings/end', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ meetingId: roomId }),
            });

            if (res.ok) {
                toast.success("Meeting ended. AI is generating your report...");
            } else {
                const errData = await res.json().catch(() => ({}));
                toast.error(`Could not end meeting: ${errData.error || res.statusText}`);
            }
        } catch (err) {
            console.error("❌ Failed to call /end:", err.message);
            toast.error("Could not finalize meeting report.");
        }

        // ✅ Clean up audio elements
        document.querySelectorAll('audio').forEach(el => {
            el.srcObject = null;
            el.remove();
        });

        socket?.disconnect();
        clearMeetingStorage();
        navigate(`/report/${roomId}`, { replace: true });
    }, [roomId, socket, navigate]);

    // ✅ Attach local stream to video element for ALL users (not just host)
    useEffect(() => {
        if (localStreamReady && localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStreamReady, localStream]);

    // ✅ Chunked recording — 30s intervals, upload each chunk independently
    useEffect(() => {
        if (!localStreamReady || !localStream || !isHost || !roomId) return;

        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length === 0) {
            console.warn("⚠️ No audio tracks found to record.");
            return;
        }

        const audioStream = new MediaStream(audioTracks);
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';
        const options = mimeType ? { mimeType } : {};

        let chunkIndex = 0;
        let chunkBuffer = [];
        const CHUNK_INTERVAL_MS = 30_000;

        const uploadChunk = async (blob, index) => {
            if (!blob || blob.size === 0) {
                console.warn(`⚠️ Chunk ${index} is empty, skipping.`);
                return;
            }

            const formData = new FormData();
            formData.append('audio', blob, `chunk-${index}.webm`);
            formData.append('meetingId', roomId);
            formData.append('chunkIndex', String(index));

            const token = localStorage.getItem("loginToken");
            try {
                const res = await fetch('https://connecthub.dikshant-ahalawat.live/meetings/chunk', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                });

                if (res.ok) {
                    console.log(`✅ Chunk ${index} uploaded`);
                } else {
                    const errData = await res.json().catch(() => ({}));
                    console.error(`❌ Chunk ${index} upload failed:`, errData.error || res.statusText);
                }
            } catch (err) {
                // Non-fatal — meeting continues, this chunk will be re-transcribed via fallback
                console.error(`❌ Chunk ${index} network error:`, err.message);
            }
        };

        const scheduleNextStop = () => {
            chunkIntervalRef.current = setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
            }, CHUNK_INTERVAL_MS);
        };

        try {
            mediaRecorderRef.current = new MediaRecorder(audioStream, options);

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data?.size > 0) {
                    chunkBuffer.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                // Snapshot and clear buffer immediately
                const buffered = [...chunkBuffer];
                chunkBuffer = [];

                if (buffered.length > 0) {
                    const blob = new Blob(buffered, { type: mimeType || 'audio/webm' });
                    const currentIndex = chunkIndex++;
                    // Fire upload without blocking onstop
                    uploadChunk(blob, currentIndex).catch(err =>
                        console.error(`❌ Upload error for chunk ${currentIndex}:`, err)
                    );
                }

                if (isExitingRef.current) {
                    // ✅ Meeting ending — wait briefly for upload fetch to fire, then finalize
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await finalizeMeetingEnd();
                } else {
                    // ✅ Still in meeting — restart recorder for next 30s chunk
                    if (mediaRecorderRef.current?.state === 'inactive') {
                        try {
                            mediaRecorderRef.current.start();
                            console.log(`🎙️ Recording chunk ${chunkIndex}...`);
                            scheduleNextStop();
                        } catch (err) {
                            console.error("❌ Failed to restart MediaRecorder:", err.message);
                            toast.error("Recording interrupted. Report may be incomplete.");
                        }
                    }
                }
            };

            // Start first chunk + schedule first stop
            mediaRecorderRef.current.start();
            console.log("🎙️ Chunked recording started (30s intervals)");
            scheduleNextStop();

        } catch (err) {
            console.error("❌ Error starting MediaRecorder:", err);
            toast.error("Could not start recording. Meeting reports will be unavailable.");
        }

        return () => {
            if (chunkIntervalRef.current) {
                clearTimeout(chunkIntervalRef.current);
                chunkIntervalRef.current = null;
            }
        };
    }, [localStreamReady, localStream, isHost, roomId, finalizeMeetingEnd]);

    useEffect(() => {
        if (!socket) return;

        const handlePeerMicState = ({ userId: peerId, isMicOn }) => {
            setPeerMicState((prev) => {
                const updated = { ...prev, [peerId]: isMicOn };
                // Also map by username if we have it in participantNameMap
                const username = nameMapRef.current[peerId];
                if (username) updated[username] = isMicOn;
                return updated;
            });
        };

        const handleUserJoined = (data) => {
            if (data.hostUserId) setHostUserId(data.hostUserId);
        };

        const handleMeetingEnded = (data) => {
            if (data && data.meetingId) {
                toast.info("The host has ended the meeting.");
                clearMeetingStorage();
                navigate(`/report/${data.meetingId}`, { replace: true });
            }
        };

        socket.on("peer-mic-state", handlePeerMicState);
        socket.on("user-joined", handleUserJoined);
        socket.on("meeting-ended", handleMeetingEnded);

        return () => {
            socket.off("peer-mic-state", handlePeerMicState);
            socket.off("user-joined", handleUserJoined);
            socket.off("meeting-ended", handleMeetingEnded);
        };
    }, [socket, navigate, roomId, userId, participants.length]);

    useEffect(() => {
        window.history.pushState(null, document.title, window.location.href);

        const handlePopState = () => {
            window.history.pushState(null, document.title, window.location.href);

            if (chatOpenRef.current) {
                setIsChatOpen(false);
                chatOpenRef.current = false;
                return;
            }
            if (participantsOpenRef.current) {
                setIsParticipantsOpen(false);
                participantsOpenRef.current = false;
                return;
            }
            if (isHost) {
                setShowEndConfirmModal(true);
            } else {
                setShowLeaveConfirmModal(true);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isHost]);

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
        };
        updateTime();
        const timer = setInterval(updateTime, 1000 * 60);
        return () => clearInterval(timer);
    }, []);

    const handleMicToggle = async () => {
        const newState = await toggleMic();
        setIsMicOn(newState);
    };

    const handleVideoToggle = async () => {
        const newState = await toggleVideo();
        setIsVideoOn(newState);
    };

    const copyRoomId = async () => {
        if (!roomId) return;
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success("Room ID copied");
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const clearMeetingStorage = () => {
        localStorage.removeItem("roomId");
        localStorage.removeItem("meetTitle");
        localStorage.removeItem("isHost");
        localStorage.removeItem("livekitUrl");
        localStorage.removeItem("livekitToken");
    };

    const leaveMeeting = async () => {
        isExitingRef.current = true;

        if (localStream) localStream.getTracks().forEach(track => track.stop());

        // ✅ Remove all LiveKit audio elements appended to body
        document.querySelectorAll('audio').forEach(el => {
            el.srcObject = null;
            el.remove();
        });

        socket?.disconnect();

        const currentRoomId = roomId;
        const token = localStorage.getItem("loginToken");

        clearMeetingStorage();
        navigate("/home", { replace: true });

        try {
            await fetch(
                `https://connecthub.dikshant-ahalawat.live/meetings/${currentRoomId}/leave`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
        } catch (err) {
            console.error("Error leaving in background:", err);
        }
    };

    // ✅ endMeeting — sets exit flag, clears timer, stops recorder
    const endMeeting = async () => {
        if (!isHost) {
            leaveMeeting();
            return;
        }

        isExitingRef.current = true;

        // Cancel scheduled next chunk
        if (chunkIntervalRef.current) {
            clearTimeout(chunkIntervalRef.current);
            chunkIntervalRef.current = null;
        }

        if (mediaRecorderRef.current?.state === 'recording') {
            // onstop will handle: upload final chunk → finalizeMeetingEnd → navigate
            mediaRecorderRef.current.stop();
        } else {
            // Edge case: recorder inactive between chunk cycles
            await finalizeMeetingEnd();
        }
    };

    const handleMobileAction = async (action) => {
        setShowMoreMenu(false);
        if (action === 'info') setShowInfoModal(true);
        if (action === 'chat') setIsChatOpen(true);
        if (action === 'participants') setIsParticipantsOpen(true);
        if (action === 'screen-share') await toggleScreenShare();
    };

    if (isRejoining && !livekitToken) {
        return (
            <div className="layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: '#fff', fontSize: '1.2rem' }}>Rejoining meeting...</p>
            </div>
        );
    }

    return (
        <div className="layout">
            <header className="navbar">
                <div className="logo">ConnectHub</div>
            </header>

            <VideoGrid
                localVideoRef={localVideoRef}
                localStream={localStream}
                isMicOn={isMicOn}
                userName={userName}
                isHost={isHost}
                remoteStreams={remoteStreams}
                peerMicState={peerMicState}
                participantNameMap={participantNameMap}
                isAlone={isAlone}
            />

            <MeetingToolbar
                isHost={isHost}
                currentTime={currentTime}
                meetTitle={meetTitle}
                isMicOn={isMicOn}
                handleMicToggle={handleMicToggle}
                localStreamReady={localStreamReady}
                isVideoOn={isVideoOn}
                handleVideoToggle={handleVideoToggle}
                isScreenSharing={isScreenSharing}
                onScreenShareClick={toggleScreenShare}
                onEndClick={() => isHost ? setShowEndConfirmModal(true) : setShowLeaveConfirmModal(true)}
                onInfoClick={() => setShowInfoModal(true)}
                onChatClick={() => setIsChatOpen(true)}
                onParticipantsClick={() => setIsParticipantsOpen(true)}
                showMoreMenu={showMoreMenu}
                setShowMoreMenu={setShowMoreMenu}
                handleMobileAction={handleMobileAction}
            />

            <ChatPanel
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                socket={socket}
                roomId={roomId}
                userId={userId}
                userName={userName}
            />

            <ParticipantsPanel
                isOpen={isParticipantsOpen}
                onClose={() => setIsParticipantsOpen(false)}
                participants={participants}
                currentUserId={userId}
                hostUserId={hostUserId}
                isLocalUserHost={isHost}
            />

            {showInfoModal && (
                <InfoModal
                    meetTitle={meetTitle}
                    roomId={roomId}
                    copyRoomId={copyRoomId}
                    onClose={() => setShowInfoModal(false)}
                />
            )}

            {showEndConfirmModal && (
                <ConfirmationModal
                    title="End Meeting"
                    message="End the meeting for everyone?"
                    onConfirm={endMeeting}
                    onCancel={() => setShowEndConfirmModal(false)}
                />
            )}

            {showLeaveConfirmModal && (
                <ConfirmationModal
                    title="Leave Meeting"
                    message="Are you sure you want to leave?"
                    onConfirm={leaveMeeting}
                    onCancel={() => setShowLeaveConfirmModal(false)}
                />
            )}
        </div>
    );
}
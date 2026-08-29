import { useEffect, useState, useRef, useMemo, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./Styles/meeting.css";
import { useSocket } from "../Providers/Socket";
import { useWebRTC } from "../Hooks/useWebRTC";
import useScreenShare from "../Hooks/useScreenShare";
import { useParticipants } from "../Hooks/useParticipants";
import ChatPanel from "./ChatPanel";
import ParticipantsPanel from "./ParticipantsPanel";
import VideoGrid from "./VideoGrid";
import MeetingToolbar from "./MeetingToolbar";
import { InfoModal, ConfirmationModal } from "./MeetingModals";

export default function Meeting() {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const [roomId, setRoomId] = useState("");
    const [userId, setUserId] = useState("");
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
    const localVideoRef = useRef(null);
    const isExitingRef = useRef(false);
    const nameMapRef = useRef({});
    const chatOpenRef = useRef(isChatOpen);
    const participantsOpenRef = useRef(isParticipantsOpen);
    const meetTitle = localStorage.getItem("meetTitle");
    const userName = localStorage.getItem("userName") || "You";
    const { participants } = useParticipants(roomId, socket);

    useEffect(() => {
        if (socket && !socket.connected) {
            socket.connect();
        }
    }, [socket]);

    const {
        localStream,
        localStreamReady,
        remoteStreams,
        remoteNames, // Get names shared directly via signaling
        toggleMic,
        toggleVideo,
        localStreamRef,
        peerConnectionsRef,
    } = useWebRTC(socket, roomId, userId, userName);

    const {
        isScreenSharing,
        startScreenShare,
        stopScreenShare,
    } = useScreenShare({
        peerConnectionsRef,
        localStreamRef,
        localVideoRef,
        socket,
        roomId
    });

    const isAlone = !remoteStreams || Object.keys(remoteStreams).length === 0;

    const participantNameMap = useMemo(() => {
        const map = {};
        // 1. Start with API-fetched names
        participants.forEach((p) => {
            map[p._id] = p.username || "Unknown User";
        });
        // 2. Overlay with names shared directly via P2P signaling (instant)
        Object.entries(remoteNames).forEach(([pid, name]) => {
            map[pid] = name;
        });
        return map;
    }, [participants, remoteNames]);

    useLayoutEffect(() => {
        chatOpenRef.current = isChatOpen;
    }, [isChatOpen]);

    useLayoutEffect(() => {
        participantsOpenRef.current = isParticipantsOpen;
    }, [isParticipantsOpen]);

    useEffect(() => {
        nameMapRef.current = participantNameMap;
    }, [participantNameMap]);

    useEffect(() => {
        const storedRoomId = localStorage.getItem("roomId");
        const storedUserId = localStorage.getItem("userId");

        if (!storedRoomId || !storedUserId) {
            navigate("/home", { replace: true });
            return;
        }

        setRoomId(storedRoomId);
        setUserId(storedUserId);
        setIsHost(localStorage.getItem("isHost") === "true");
    }, [navigate]);

    useEffect(() => {
        if (!roomId) return;

        const fetchHostInfo = async () => {
            try {
                const token = localStorage.getItem("loginToken");
                const res = await fetch(`https://connecthub.dikshant-ahalawat.live/meetings/${roomId}/participants`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();

                if (data.hostUserId) {
                    setHostUserId(data.hostUserId);
                }
            } catch (error) {
                console.error("Failed to fetch host info:", error);
            }
        };

        fetchHostInfo();
    }, [roomId]);

    useEffect(() => {
        if (!localStreamReady) return;
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStreamReady, localStream]);

    useEffect(() => {
        if (!socket) return;

        const handlePeerMicState = ({ userId: peerId, isMicOn }) => {
            setPeerMicState((prev) => ({ ...prev, [peerId]: isMicOn }));
        };

        const handleRoomFull = () => {
            toast.error("This room is full (Max 2 people).");
            navigate("/home");
        };

        const handleUserLeft = (data) => {
            const leaverId = (typeof data === 'object' && data !== null) ? data.userId : data;
            const name = nameMapRef.current[leaverId] || "A participant";
            toast.info(`${name} left the meeting`);
        };

        const handleUserJoined = (data) => {
            if (data.hostUserId) {
                setHostUserId(data.hostUserId);
            }
        };

        const onUserConnected = () => {
            // Trigger participant refresh when someone connects
            participants.length > 0 && socket.emit('get-participants'); // Fallback if supported
        };

        socket.on("peer-mic-state", handlePeerMicState);
        socket.on("room-full", handleRoomFull);
        socket.on("user-left", handleUserLeft);
        socket.on("user-disconnected", handleUserLeft);
        socket.on("user-connected", onUserConnected);
        socket.on("user-joined", handleUserJoined);

        return () => {
            socket.off("peer-mic-state", handlePeerMicState);
            socket.off("room-full", handleRoomFull);
            socket.off("user-left", handleUserLeft);
            socket.off("user-disconnected", handleUserLeft);
            socket.off("user-connected", onUserConnected);
            socket.off("user-joined", handleUserJoined);
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

    const handleMicToggle = () => {
        const newState = toggleMic();
        setIsMicOn(newState);
        socket?.emit("mic-toggle", { isMicOn: newState });
    };

    const handleVideoToggle = () => setIsVideoOn(toggleVideo());

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
        window.history.replaceState(null, "", "/home");
    };

    const leaveMeeting = async () => {
        isExitingRef.current = true;
        
        // Stop media immediately
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }

        // Force disconnect to trigger instant backend cleanup
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

    const endMeeting = async () => {
        isExitingRef.current = true;
        
        // 1. Stop local media immediately
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }

        // Force disconnect to trigger instant backend cleanup
        socket?.disconnect();

        const currentRoomId = roomId;
        const token = localStorage.getItem("loginToken");

        // 2. Clear UI/Storage immediately (Instant redirection)
        clearMeetingStorage();
        toast.info("Ending meeting...");
        navigate("/home", { replace: true });

        // 3. Perform the background cleanup on the server
        try {
            const res = await fetch(
                `https://connecthub.dikshant-ahalawat.live/meetings/${currentRoomId}/end`,
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!res.ok) {
                // If ending failed (e.g. not host), at least try to leave
                fetch(`https://connecthub.dikshant-ahalawat.live/meetings/${currentRoomId}/leave`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }).catch(() => {});
            }
        } catch (err) {
            console.error("Error ending meeting in background:", err);
        }
    };

    const handleMobileAction = async (action) => {
        setShowMoreMenu(false);
        if (action === 'info') setShowInfoModal(true);
        if (action === 'chat') setIsChatOpen(true);
        if (action === 'participants') setIsParticipantsOpen(true);
        if (action === 'screen-share') {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                toast.error("Your browser does not support screen sharing.");
                return;
            }
            try {
                if (isScreenSharing) {
                    await stopScreenShare();
                } else {
                    await startScreenShare();
                }
            } catch (err) {
                if (err.name === 'NotAllowedError') {
                    toast.error("Permission denied. You must click 'Start now' on the system popup.");
                } else if (err.name === 'NotFoundError') {
                    toast.error("No screen found to share.");
                } else {
                    toast.error(`Error: ${err.message || "Failed to start"}`);
                }
            }
        }
    };

    return (
        <div className="layout">
            <header className="navbar">
                <div className="logo">ConnectHub</div>
            </header>

            <VideoGrid
                localVideoRef={localVideoRef}
                isMicOn={isMicOn}
                userName={userName}
                isHost={isHost}
                remoteStreams={remoteStreams}
                peerMicState={peerMicState}
                participantNameMap={participantNameMap}
                isAlone={isAlone}
            />

            <MeetingToolbar
                currentTime={currentTime}
                meetTitle={meetTitle}
                isMicOn={isMicOn}
                handleMicToggle={handleMicToggle}
                localStreamReady={localStreamReady}
                isVideoOn={isVideoOn}
                handleVideoToggle={handleVideoToggle}
                isScreenSharing={isScreenSharing}
                onScreenShareClick={isScreenSharing ? stopScreenShare : startScreenShare}
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
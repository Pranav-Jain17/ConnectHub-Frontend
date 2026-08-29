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

    const {
        localStream,
        localStreamReady,
        remoteStreams,
        toggleMic,
        toggleVideo,
        localStreamRef,
        peerConnectionsRef,
    } = useWebRTC(socket, roomId, userId);

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
        participants.forEach((p) => {
            map[p._id] = p.username || "Unknown User";
        });
        return map;
    }, [participants]);

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

        const handleMeetingEnded = () => {
            if (isExitingRef.current) return;
            clearMeetingStorage();
            toast.info("Meeting ended by host");
            navigate("/home");
        };

        const handleUserLeft = ({ userId: leaverId }) => {
            const name = nameMapRef.current[leaverId] || "A participant";
            toast.info(`${name} left the meeting`);
        };

        const handleUserJoined = (data) => {
            if (data.hostUserId) {
                setHostUserId(data.hostUserId);
            }
        };

        socket.on("peer-mic-state", handlePeerMicState);
        socket.on("room-full", handleRoomFull);
        socket.on("meeting-ended", handleMeetingEnded);
        socket.on("user-left", handleUserLeft);
        socket.on("user-joined", handleUserJoined); // Listen for join to sync host

        return () => {
            socket.off("peer-mic-state", handlePeerMicState);
            socket.off("meeting-ended", handleMeetingEnded);
            socket.off("room-full", handleRoomFull);
            socket.off("user-left", handleUserLeft);
            socket.off("user-joined", handleUserJoined);
        };
    }, [socket, navigate]);

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
        const token = localStorage.getItem("loginToken");
        try {
            const res = await fetch(
                `https://connecthub.dikshant-ahalawat.live/meetings/${roomId}/leave`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (res.ok || res.status === 404) {
                toast.success("Left meeting successfully");
                clearMeetingStorage();
                navigate("/home", { replace: true });
            } else {
                toast.error("Failed to leave meeting");
                isExitingRef.current = false;
            }
        } catch (err) {
            toast.error("Error leaving meeting");
            clearMeetingStorage();
            navigate("/home", { replace: true });
        }
    };

    const endMeeting = async () => {
        isExitingRef.current = true;
        const token = localStorage.getItem("loginToken");
        try {
            const res = await fetch(
                `https://connecthub.dikshant-ahalawat.live/meetings/${roomId}/end`,
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (res.ok) {
                clearMeetingStorage();
                toast.info("Meeting ended by host");
                navigate("/home", { replace: true });
            } else {
                toast.error("Failed to end meeting");
                isExitingRef.current = false;
            }
        } catch (err) {
            toast.error("Error ending meeting");
            navigate("/home", { replace: true });
        }
    };

    const handleMobileAction = (action) => {
        setShowMoreMenu(false);
        if (action === 'info') setShowInfoModal(true);
        if (action === 'chat') setIsChatOpen(true);
        if (action === 'participants') setIsParticipantsOpen(true);
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
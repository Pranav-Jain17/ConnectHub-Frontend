import React, { useEffect, useState, useRef } from "react";
import "./meeting.css";
import { useSocket } from "../Providers/Socket";
import { useWebRTC } from "../Hooks/useWebRTC";
import ChatPanel from "./ChatPanel";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ParticipantsPanel from "./ParticipantsPanel";
import useScreenShare from "../Hooks/useScreenShare";

export default function Meeting() {
    const [roomId, setRoomId] = useState("");
    const [userId, setUserId] = useState("");
    const [isMicOn, setIsMicOn] = useState(true);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isHost, setIsHost] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
    const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
    const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);

    const { socket } = useSocket();
    const localVideoRef = useRef(null);
    const navigate = useNavigate();
    const [peerMicState, setPeerMicState] = useState({});
    const [participants, setParticipants] = useState([]);

    const meetTitle = localStorage.getItem("meetTitle");
    const userName = localStorage.getItem("userName") || "You";

    useEffect(() => {
        const storedRoomId = localStorage.getItem("roomId");
        const storedUserId = localStorage.getItem("userId");

        if (!storedRoomId || !storedUserId) {
            console.warn("🚫 No active meeting found. Redirecting to home.");
            navigate("/home", { replace: true });
            return;
        }

        setRoomId(storedRoomId);
        setUserId(storedUserId);
        setIsHost(localStorage.getItem("isHost") === "true");
    }, [navigate]);

    const {
        localStream,
        localStreamReady,
        remoteStreams,
        toggleMic,
        toggleVideo,
        localStreamRef,
        peerConnectionsRef,
    } = useWebRTC(socket, roomId, userId);

    const isAlone = !remoteStreams || Object.keys(remoteStreams).length === 0;

    useEffect(() => {
        if (!localStreamReady) return;
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStreamReady, localStream]);

    useEffect(() => {
        if (!socket) return;

        const handlePeerMicState = ({ userId: peerId, isMicOn }) => {
            setPeerMicState((prev) => ({
                ...prev,
                [peerId]: isMicOn,
            }));
        };

        socket.on("peer-mic-state", handlePeerMicState);

        return () => {
            socket.off("peer-mic-state", handlePeerMicState);
        };
    }, [socket]);

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
            console.error("❌ Failed to copy:", err);
        }
    };

    const participantNameMap = React.useMemo(() => {
        const map = {};
        participants.forEach((p) => {
            map[p._id] = p.username || "Unknown User";
        });
        return map;
    }, [participants]);

    const clearMeetingStorage = () => {
        localStorage.removeItem("roomId");
        localStorage.removeItem("meetTitle");
        localStorage.removeItem("isHost");
        // 🔥 wipe browser history state
        window.history.replaceState(null, "", "/home");
    };

    useEffect(() => {
        if (!socket) return;

        const handleRoomFull = () => {
            toast.error("This room is full (Max 2 people).");
            navigate("/home");
        };

        const handleMeetingEnded = () => {
            clearMeetingStorage();
            toast.info("Meeting ended by host");
            navigate("/home");
        };

        socket.on("room-full", handleRoomFull);
        socket.on("meeting-ended", handleMeetingEnded);

        return () => {
            socket.off("meeting-ended", handleMeetingEnded);
            socket.off("room-full", handleRoomFull);
        };
    }, [socket, navigate]);

    const leaveMeeting = async () => {
        const token = localStorage.getItem("loginToken");
        const finalizeLeave = () => {
            clearMeetingStorage();
            navigate("/home", { replace: true });
        };

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
                finalizeLeave();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.message || "Failed to leave meeting");
                finalizeLeave();
            }
        } catch (err) {
            toast.error("Error leaving meeting");
            finalizeLeave();
        }
    };

    const endMeeting = async () => {
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

            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                clearMeetingStorage();
                toast.info("Meeting ended successfully");
                navigate("/home", { replace: true });
            } else {
                toast.error(data.message || "Failed to end meeting");
            }
        } catch (err) {
            toast.error("Error ending meeting");
            navigate("/home", { replace: true });
        }
    };

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

    return (
        <div className="layout">
            <header className="navbar">
                <div className="logo">ConnectHub</div>
            </header>

            <main className={`content-gap ${isAlone ? "single-mode" : "split-mode"}`}>
                <div className="video-container">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="local-video"
                    />
                    <span className="video-label">
                        <img
                            src={isMicOn ? "/assets/svg/mic.svg" : "/assets/svg/mic-off.svg"}
                            alt=""
                        />
                        {userName} {isHost && "(Host)"}
                    </span>
                </div>

                {remoteStreams && Object.entries(remoteStreams).map(([remoteUserId, stream]) => (
                    <RemoteVideo
                        key={remoteUserId}
                        stream={stream}
                        isMicOn={peerMicState[remoteUserId]}
                        name={participantNameMap[remoteUserId] || "Remote User"}
                    />
                ))}
            </main>

            <div className="toolbar">
                <div className="meet-title-box">
                    <span className="meet-title-value">Meet Title : {meetTitle}</span>
                </div>

                <div className="toolbuttons">
                    <button
                        className={`btn mic-btn ${!isMicOn ? "btn-off" : ""}`}
                        onClick={handleMicToggle}
                        disabled={!localStreamReady}
                    >
                        <img
                            src={isMicOn ? "/assets/svg/mic.svg" : "/assets/svg/mic-off.svg"}
                            alt=""
                        />
                    </button>

                    <button
                        className={`btn video-btn ${!isVideoOn ? "btn-off" : ""}`}
                        onClick={handleVideoToggle}
                        disabled={!localStreamReady}
                    >
                        <img
                            src={isVideoOn ? "/assets/svg/video.svg" : "/assets/svg/video-off.svg"}
                            alt=""
                        />
                    </button>

                    <button
                        className={`btn screen-btn ${isScreenSharing ? "btn-off" : ""}`}
                        onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                    >
                        <img
                            src="/assets/svg/screen-share.svg"
                            alt="Screen Share"
                        />
                    </button>

                    <button className="btn chat-btn" onClick={() => setIsChatOpen(true)}>
                        <img src="/assets/svg/chat.svg" alt="Chat" />
                    </button>

                    <button className="btn participant-btn" onClick={() => setIsParticipantsOpen(true)}>
                        <img src="/assets/svg/participants.svg" alt="participant" />
                    </button>

                    <button
                        className="btn end-btn"
                        onClick={() =>
                            isHost ? setShowEndConfirmModal(true) : setShowLeaveConfirmModal(true)
                        }
                    >
                        <img src="/assets/svg/endcall.svg" alt="End Call" />
                    </button>
                </div>

                <div className="room-id-box">
                    <span className="room-id-value">Room ID : {roomId}</span>
                    <button className="copy-btn" onClick={copyRoomId}>
                        <img src="/assets/svg/copyCode.svg" alt="Copy room id" />
                    </button>
                </div>
            </div>

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
                roomId={roomId}
                currentUserId={userId}
                socket={socket}
                participants={participants}
                setParticipants={setParticipants}
            />


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

function RemoteVideo({ stream, isMicOn = true, name = "Remote User" }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (!videoRef.current || !stream) return;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => { });
    }, [stream]);

    return (
        <div className="video-container">
            <video ref={videoRef} autoPlay playsInline className="remote-video" />
            <span className="video-label">
                <img
                    src={isMicOn ? "/assets/svg/mic.svg" : "/assets/svg/mic-off.svg"}
                    alt=""
                />
                {name}
            </span>
        </div>
    );
}

function ConfirmationModal({ title, message, onConfirm, onCancel }) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                onConfirm();
            } else if (e.key === 'Escape') {
                onCancel();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onConfirm, onCancel]);

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <h2>{title}</h2>
                <p>{message}</p>
                <div className="modal-buttons">
                    <button onClick={onConfirm} autoFocus>Yes</button>
                    <button onClick={onCancel}>Cancel</button>
                </div>
            </div>
        </div>
    );
}
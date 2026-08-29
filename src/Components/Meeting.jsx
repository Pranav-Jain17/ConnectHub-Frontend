// Meeting.jsx
import React, { useEffect, useState, useRef } from "react";
import "./meeting.css";
import { useSocket } from "../Providers/Socket";
import { useWebRTC } from "../Hooks/useWebRTC";
import ChatPanel from "./ChatPanel";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function Meeting() {
    console.log("🎬 Meeting: Component rendering");

    const [roomId, setRoomId] = useState("");
    const [userId, setUserId] = useState("");
    const [isMicOn, setIsMicOn] = useState(true);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isHost, setIsHost] = useState(false);

    const meetTitle = localStorage.getItem("meetTitle");
    const userName = localStorage.getItem("userName") || "You";

    const { socket } = useSocket();
    const localVideoRef = useRef(null);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const navigate = useNavigate();

    const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
    const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);

    // Load localStorage data only once
    useEffect(() => {
        const storedRoomId = localStorage.getItem("roomId") || "";
        const storedUserId = localStorage.getItem("userId") || "";
        const hostFlag = localStorage.getItem("isHost") === "true";

        setRoomId(storedRoomId);
        setUserId(storedUserId);
        setIsHost(hostFlag);
    }, []);

    // Join the room via socket whenever we (re)connect
    useEffect(() => {
        if (!socket || !roomId || !userId) return;
        console.log("📡 Emitting join-room:", { roomId, userId });
        socket.emit("join-room", roomId, userId);
    }, [socket, roomId, userId]);

    const {
        localStream,
        localStreamReady,
        remoteStreams,
        toggleMic,
        toggleVideo
    } = useWebRTC(socket, roomId, userId);

    useEffect(() => {
        if (!localStreamReady) return;
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            console.log("✅ Local video displayed");
        }
    }, [localStreamReady, localStream]);

    const handleMicToggle = () => setIsMicOn(toggleMic());
    const handleVideoToggle = () => setIsVideoOn(toggleVideo());

    const copyRoomId = async () => {
        if (!roomId) return;
        try {
            await navigator.clipboard.writeText(roomId);
        } catch (err) {
            console.error("❌ Failed to copy:", err);
        }
    };

    const clearMeetingStorage = () => {
        localStorage.removeItem("roomId");
        localStorage.removeItem("meetTitle");
        localStorage.removeItem("isHost");
    };

    // Listen for server signal that the meeting ended
    useEffect(() => {
        if (!socket) return;

        const handleRoomFull = () => {
            console.warn("Room is full. Redirecting home.");
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
        }

    }, [socket, navigate]);

    const leaveMeeting = async () => {
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

            if (res.status === 404) {
                clearMeetingStorage();
                navigate("/home");
                return;
            }
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.message || "Failed to leave meeting");
                return;
            }

            clearMeetingStorage();
            toast.success("Left meeting successfully");
            navigate("/home");
        } catch (err) {
            toast.error("Error leaving meeting");
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
            if (!res.ok) {
                toast.error(data.message || "Failed to end meeting");
                return;
            }

            clearMeetingStorage();
            toast.success("Meeting ended successfully");
            navigate("/home");
        } catch (err) {
            toast.error("Error ending meeting");
        }
    };

    return (
        <div className="layout">
            <header className="navbar">
                <div className="logo">ConnectHub</div>
            </header>

            <main className="content-gap">
                <div className="video-container">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="local-video"
                    />
                    <span className="video-label">
                        You {!isVideoOn && "(Camera Off)"} {!isMicOn && "(Muted)"}{" "}
                        {isHost && "(Host)"}
                    </span>
                </div>

                {Object.entries(remoteStreams).map(([remoteUserId, stream]) => (
                    <RemoteVideo key={remoteUserId} stream={stream} userId={remoteUserId} />
                ))}
            </main>

            <div className="toolbar">
                <div className="meet-title-box">
                    <span className="room-id-label">Title:</span>
                    <span className="room-id-value">{meetTitle}</span>
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

                    <button className="btn chat-btn" onClick={() => setIsChatOpen(true)}>
                        <img src="/assets/svg/chat.svg" alt="Chat" />
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
                    <span className="room-id-value">{roomId}</span>
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

function RemoteVideo({ stream, userId }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (!videoRef.current || !stream) return;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => console.error("Remote play err:", err));
    }, [stream]);

    return (
        <div className="video-container">
            <video ref={videoRef} autoPlay playsInline className="remote-video" />
            <span className="video-label">User {userId.substring(0, 8)}</span>
        </div>
    );
}

function ConfirmationModal({ title, message, onConfirm, onCancel }) {
    return (
        <div className="modal-backdrop">
            <div className="modal-box">
                <h2>{title}</h2>
                <p>{message}</p>
                <div className="modal-buttons">
                    <button onClick={onConfirm}>Yes</button>
                    <button onClick={onCancel}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

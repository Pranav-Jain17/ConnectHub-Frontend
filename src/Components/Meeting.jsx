// Meeting.jsx
import React, { useEffect, useState, useRef } from "react";
import "./meeting.css";
import { useSocket } from "../Providers/Socket";
import { useWebRTC } from "../Hooks/useWebRTC";
import ChatPanel from "./ChatPanel";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function Meeting() {
    console.log('🎬 Meeting: Component rendering');

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

        console.log('📦 localStorage roomId:', storedRoomId || "EMPTY");
        console.log('📦 localStorage userId:', storedUserId || "EMPTY");
        console.log('📦 localStorage isHost:', hostFlag);
    }, []);

    // Automatically join the room via socket once available
    useEffect(() => {
        if (!socket || !roomId || !userId) {
            console.log("⚠️ join-room skipped", { hasSocket: !!socket, roomId, userId });
            return;
        }
        console.log("📡 Emitting join-room on socket:", { roomId, userId, socketId: socket.id });
        socket.emit("join-room", roomId, userId);
    }, [socket, roomId, userId]);

    // WebRTC hook
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
            console.log('✅ Local video displayed');
        }
    }, [localStreamReady, localStream]);

    const handleMicToggle = () => {
        const newState = toggleMic();
        setIsMicOn(newState);
    };

    const handleVideoToggle = () => {
        const newState = toggleVideo();
        setIsVideoOn(newState);
    };

    const copyRoomId = async () => {
        if (!roomId) return;
        try {
            await navigator.clipboard.writeText(roomId);
            console.log('✅ Room ID copied to clipboard:', roomId);
        } catch (err) {
            console.error('❌ Failed to copy:', err);
        }
    };

    const clearMeetingStorage = () => {
        localStorage.removeItem("roomId");
        localStorage.removeItem("meetTitle");
        localStorage.removeItem("isHost");
    };

    // Listen for server broadcast that meeting ended
    useEffect(() => {
        if (!socket) return;

        const handleMeetingEnded = (payload) => {
            console.log("🛑 meeting-ended event received:", payload);
            clearMeetingStorage();
            toast.info("Meeting ended by host");
            navigate("/home");
        };

        socket.on("meeting-ended", handleMeetingEnded);
        return () => {
            socket.off("meeting-ended", handleMeetingEnded);
        };
    }, [socket, navigate]);

    // Single check on mount (detect 404 or meeting ended)
    useEffect(() => {
        if (!roomId) return;

        const checkMeetingStatusOnce = async () => {
            try {
                const res = await fetch(`https://connecthub.dikshant-ahalawat.live/meetings/${roomId}/status`);
                if (!res.ok) {
                    console.warn("⚠️ Meeting status check failed (not found or ended)");
                    clearMeetingStorage();
                    toast.info("Meeting not found / ended");
                    navigate("/home");
                    return;
                }
                // optional: inspect res.json() here for ended flag if available
            } catch (err) {
                console.error("❌ Meeting status check error:", err);
            }
        };

        checkMeetingStatusOnce();
    }, [roomId, navigate]);

    const leaveMeeting = async () => {
        const token = localStorage.getItem("loginToken");
        try {
            console.log(`🚪 Leaving meeting | roomId: ${roomId}`);
            const res = await fetch(`https://connecthub.dikshant-ahalawat.live/meetings/${roomId}/leave`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            if (res.status === 404) {
                console.warn("ℹ️ Meeting not found (probably ended)");
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
            console.log(`🛑 Ending meeting (host) | roomId: ${roomId}`);
            const res = await fetch(`https://connecthub.dikshant-ahalawat.live/meetings/${roomId}/end`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

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
                {/* Local Video */}
                <div className="video-container">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="local-video"
                    />
                    <span className="video-label">
                        You {!isVideoOn && "(Camera Off)"} {!isMicOn && "(Muted)"} {isHost && " (Host)"}
                    </span>
                </div>

                {/* Remote Videos */}
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
                    <button className={`btn mic-btn ${!isMicOn ? "btn-off" : ""}`} onClick={handleMicToggle} disabled={!localStreamReady}>
                        <img src={isMicOn ? "/assets/svg/mic.svg" : "/assets/svg/mic-off.svg"} alt="" />
                    </button>

                    <button className={`btn video-btn ${!isVideoOn ? "btn-off" : ""}`} onClick={handleVideoToggle} disabled={!localStreamReady}>
                        <img src={isVideoOn ? "/assets/svg/video.svg" : "/assets/svg/video-off.svg"} alt="" />
                    </button>

                    <button className="btn raiseHand-btn">
                        <img src="/assets/svg/raise-hand.svg" alt="Raise Hand" />
                    </button>

                    <button className="btn participants-btn">
                        <img src="/assets/svg/participants.svg" alt="Participants" />
                    </button>

                    <button className="btn chat-btn" onClick={() => setIsChatOpen(true)}>
                        <img src="/assets/svg/chat.svg" alt="Chat" />
                    </button>

                    <button className="btn end-btn" onClick={() => (isHost ? setShowEndConfirmModal(true) : setShowLeaveConfirmModal(true))}>
                        <img src="/assets/svg/endcall.svg" alt="End Call" />
                    </button>
                </div>

                <div className="room-id-box">
                    <span className="room-id-label">Room ID:</span>
                    <span className="room-id-value">{roomId}</span>
                    <button className="copy-btn" onClick={copyRoomId}>
                        <img src="/assets/svg/copyCode.svg" alt="copy room id" />
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
                <div className="modal-backdrop">
                    <div className="modal-box">
                        <h2>End Meeting</h2>
                        <p>Are you sure you want to end the meeting for everyone?</p>
                        <div className="modal-buttons">
                            <button onClick={() => { setShowEndConfirmModal(false); endMeeting(); }}>
                                Yes, End
                            </button>
                            <button onClick={() => setShowEndConfirmModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {showLeaveConfirmModal && (
                <div className="modal-backdrop">
                    <div className="modal-box">
                        <h2>Leave Meeting</h2>
                        <p>Are you sure you want to leave the meeting?</p>
                        <div className="modal-buttons">
                            <button onClick={() => { setShowLeaveConfirmModal(false); leaveMeeting(); }}>
                                Leave
                            </button>
                            <button onClick={() => setShowLeaveConfirmModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function RemoteVideo({ stream, userId }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(err => {
                console.error('Remote play error:', err);
            });
        }
    }, [stream]);

    return (
        <div className="video-container">
            <video ref={videoRef} autoPlay playsInline className="remote-video" />
            <span className="video-label">User {userId.substring(0, 8)}</span>
        </div>
    );
}

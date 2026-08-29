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

    // ** New state for confirmation modals **
    const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
    const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);

    console.log('🔌 Meeting: Socket object received:', socket ? 'EXISTS ✓' : 'NULL ✗');
    console.log('🔌 Meeting: Socket connected:', socket?.connected);

    // Load roomId, userId, isHost from localStorage
    useEffect(() => {
        const storedRoomId = localStorage.getItem("roomId") || "";
        const user = localStorage.getItem("userId") || "";
        const hostFlag = localStorage.getItem("isHost") === "true";

        setRoomId(storedRoomId);
        setUserId(user);
        setIsHost(hostFlag);

        console.log('📦 localStorage roomId:', storedRoomId || 'EMPTY');
        console.log('📦 localStorage userId:', user || 'EMPTY');
        console.log('📦 localStorage isHost:', hostFlag);
        console.log('✅ State set');
    }, []);

    // Join room on socket
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

    // Show local video when ready
    useEffect(() => {
        console.log('🎚️ localStreamReady changed:', localStreamReady);
        if (!localStreamReady) {
            console.log("⏳ Waiting for localStreamReady...");
            return;
        }
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
        console.log('\n📋 Copy button clicked');
        if (!roomId) {
            console.warn('⚠️ Cannot copy - roomId is empty');
            return;
        }
        try {
            await navigator.clipboard.writeText(roomId);
            console.log('✅ Room ID copied to clipboard:', roomId);
        } catch (err) {
            console.error('❌ Failed to copy:', err);
        }
    };

    const clearMeetingStorage = () => {
        console.log("🧹 Clearing meeting-related localStorage");
        localStorage.removeItem("roomId");
        localStorage.removeItem("meetTitle");
        localStorage.removeItem("isHost");
    };

    // Handle meeting-ended event from server (host ended meeting)
    useEffect(() => {
        if (!socket) {
            console.warn("⚠️ Meeting: socket not ready for meeting-ended listener");
            return;
        }
        const handleMeetingEnded = (payload) => {
            console.log("🛑 meeting-ended event received:", payload, "local roomId:", roomId);
            clearMeetingStorage();
            toast.info("Meeting ended by host");
            navigate("/home");
        };
        socket.on("meeting-ended", handleMeetingEnded);
        return () => {
            socket.off("meeting-ended", handleMeetingEnded);
        };
    }, [socket, roomId, navigate]);

    // --- NEW: polling + status-check fallback in case socket broadcast missed ---
    useEffect(() => {
        if (!roomId) return;

        let intervalId = null;
        const POLL_INTERVAL = 10000; // 10 seconds

        const checkMeetingStatus = async () => {
            try {
                const res = await fetch(`http://3.110.101.93:3000/meetings/${roomId}/status`);
                if (!res.ok) {
                    // treat as ended / not found room
                    throw new Error('Room not found / ended');
                }
                const data = await res.json();
                // adjust check depending on what your /status endpoint returns
                // assume { ended: boolean } or { exists: boolean }
                if (data.ended || data.exists === false) {
                    console.log('🔍 Polling detected meeting ended — redirecting');
                    clearMeetingStorage();
                    toast.info("Meeting ended");
                    navigate("/home");
                }
            } catch (err) {
                console.warn('⚠️ status-check failed or meeting likely ended:', err);
                // Optionally treat this as ended — uncomment if you want failure → redirect
                // clearMeetingStorage();
                // toast.info("Meeting ended");
                // navigate("/home");
            }
        };

        // initial check
        checkMeetingStatus();

        // then periodic checks
        intervalId = setInterval(checkMeetingStatus, POLL_INTERVAL);

        // cleanup on unmount
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [roomId, navigate]);

    // --- NEW: on socket reconnect, re-check status immediately ---
    useEffect(() => {
        if (!socket) return;
        const handleReconnect = () => {
            console.log('🔄 socket reconnected — checking meeting status');
            if (!roomId) return;
            fetch(`http://3.110.101.93:3000/meetings/${roomId}/status`)
                .then(res => {
                    if (!res.ok) throw new Error('Room fetch failed');
                    return res.json();
                })
                .then(data => {
                    if (data.ended || data.exists === false) {
                        clearMeetingStorage();
                        toast.info("Meeting ended");
                        navigate("/home");
                    }
                })
                .catch(err => {
                    console.warn('⚠️ status-check on reconnect failed or room ended', err);
                    // optionally redirect
                });
        };

        socket.on("connect", handleReconnect);
        return () => {
            socket.off("connect", handleReconnect);
        };
    }, [socket, roomId, navigate]);
    // --- end of polling fallback additions ---

    const leaveMeeting = async () => {
        if (!roomId) {
            console.warn("⚠️ leaveMeeting: roomId missing");
            return;
        }
        const token = localStorage.getItem("loginToken");
        if (!token) {
            console.warn("⚠️ leaveMeeting: loginToken missing");
        }
        try {
            console.log(`🚪 Leaving meeting (participant) | roomId: ${roomId}`);
            const res = await fetch(`http://3.110.101.93:3000/meetings/${roomId}/leave`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            });
            const data = await res.json().catch(() => ({}));
            console.log("📥 leaveMeeting response:", res.status, data);
            if (res.status === 404) {
                console.warn("ℹ️ Meeting not found (probably ended). Treating as left.");
                clearMeetingStorage();
                navigate("/home");
                return;
            }
            if (!res.ok) {
                console.error("❌ Failed to leave meeting", data);
                toast.error(data.message || data.error || `Failed to leave meeting (status: ${res.status})`);
                return;
            }
            console.log("✅ Left meeting successfully");
            clearMeetingStorage();
            toast.success("Meeting left successfully");
            navigate("/home");
        } catch (err) {
            console.error("❌ leaveMeeting error:", err);
            toast.error("Error leaving meeting");
        }
    };

    const endMeeting = async () => {
        if (!roomId) {
            console.warn("⚠️ endMeeting: roomId missing");
            return;
        }
        const token = localStorage.getItem("loginToken");
        if (!token) {
            console.warn("⚠️ endMeeting: loginToken missing");
        }
        try {
            console.log(`🛑 Ending meeting (host) | roomId: ${roomId}`);
            const res = await fetch(`http://3.110.101.93:3000/meetings/${roomId}/end`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            });
            const data = await res.json().catch(() => ({}));
            console.log("📥 endMeeting response:", res.status, data);
            if (!res.ok) {
                console.error("❌ Failed to end meeting", data);
                toast.error(data.message || data.error || `Failed to end meeting (status: ${res.status})`);
                return;
            }
            // inside endMeeting(), after successful fetch:
            if (res.ok) {
                console.log("✅ Meeting ended successfully");
                clearMeetingStorage();
                toast.success("Meeting ended successfully");
                // 🔹 Force-redirect host:
                navigate("/home");
                return;
            }
        } catch (err) {
            console.error("❌ endMeeting error:", err);
            toast.error("Error ending meeting");
        }
    };

    const handleEndOrLeave = () => {
        if (isHost) {
            setShowEndConfirmModal(true);
        } else {
            setShowLeaveConfirmModal(true);
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
                    <button
                        className={`btn mic-btn ${!isMicOn ? "btn-off" : ""}`}
                        onClick={handleMicToggle}
                        title={isMicOn ? "Mute microphone" : "Unmute microphone"}
                        disabled={!localStreamReady}
                    >
                        <img
                            src={isMicOn ? "/assets/svg/mic.svg" : "/assets/svg/mic-off.svg"}
                            alt={isMicOn ? "Mic On" : "Mic Off"}
                        />
                    </button>

                    <button
                        className={`btn video-btn ${!isVideoOn ? "btn-off" : ""}`}
                        onClick={handleVideoToggle}
                        title={isVideoOn ? "Turn off camera" : "Turn on camera"}
                        disabled={!localStreamReady}
                    >
                        <img
                            src={isVideoOn ? "/assets/svg/video.svg" : "/assets/svg/video-off.svg"}
                            alt={isVideoOn ? "Video On" : "Video Off"}
                        />
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

                    <button
                        className="btn end-btn"
                        onClick={handleEndOrLeave}
                        title={isHost ? "End meeting for everyone" : "Leave meeting"}
                    >
                        <img src="/assets/svg/endcall.svg" alt="End Call" />
                    </button>
                </div>

                <div className="room-id-box">
                    <span className="room-id-label">Title:</span> {/* changed label? keep previous */}
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

            {/* Confirmation Modal for Host: End Meeting */}
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

            {/* Confirmation Modal for Participant: Leave Meeting */}
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
            console.log('🎥 Remote video displayed for user:', userId);
            videoRef.current.play().catch(err => {
                console.error('Error playing remote video:', err);
            });
        }
    }, [stream, userId]);

    return (
        <div className="video-container">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="remote-video"
            />
            <span className="video-label">User {userId.substring(0, 8)}</span>
        </div>
    );
}

import React, { useEffect, useState, useRef } from "react";
import "./meeting.css";
import { useSocket } from "../Providers/Socket";
import { useWebRTC } from "../Hooks/useWebRTC";

export default function Meeting() {
    console.log('🎬 Meeting: Component rendering');

    const [roomId, setRoomId] = useState("");
    const [userId, setUserId] = useState("");
    const [isMicOn, setIsMicOn] = useState(true);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const meetTitle = localStorage.getItem("meetTitle");

    const { socket } = useSocket();
    const localVideoRef = useRef(null);

    console.log('🔌 Meeting: Socket object received:', socket ? 'EXISTS ✓' : 'NULL ✗');
    console.log('🔌 Meeting: Socket connected:', socket?.connected);

    // Load roomId and userId once
    useEffect(() => {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔧 Meeting: Load roomId useEffect running');

        const id = localStorage.getItem("roomId") || "";
        const user = localStorage.getItem("userId") || "";

        console.log('📦 localStorage roomId:', id || 'EMPTY');
        console.log('📦 localStorage userId:', user || 'EMPTY');

        setRoomId(id);
        setUserId(user);

        console.log('✅ State set');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }, []);

    // WebRTC Hook
    const {
        localStream,
        localStreamReady,
        remoteStreams,
        toggleMic,
        toggleVideo
    } = useWebRTC(socket, roomId, userId);

    useEffect(() => {
        console.log('🎚️ localStreamReady changed:', localStreamReady);
    }, [localStreamReady]);

    // Display local video when ready
    useEffect(() => {
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

    console.log('🎬 Meeting: Rendering UI');
    console.log('   Meet Title:', meetTitle || 'NONE');
    console.log('   Room ID:', roomId || 'NONE');
    console.log('   Remote streams count:', Object.keys(remoteStreams).length);
    console.log('   Local stream ready:', localStreamReady);

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
                        You {!isVideoOn && '(Camera Off)'} {!isMicOn && '(Muted)'}
                    </span>
                </div>

                {/* Remote Videos */}
                {Object.entries(remoteStreams).map(([remoteUserId, stream]) => (
                    <RemoteVideo
                        key={remoteUserId}
                        stream={stream}
                        userId={remoteUserId}
                    />
                ))}
            </main>

            <div className="toolbar">
                <div className="meet-title-box">
                    <span className="room-id-label">Title:</span>
                    <span className="room-id-value">{meetTitle}</span>
                </div>

                <div className="toolbuttons">
                    <button
                        className={`btn mic-btn ${!isMicOn ? 'btn-off' : ''}`}
                        onClick={handleMicToggle}
                        title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                        disabled={!localStreamReady}
                    >
                        <img
                            src={isMicOn ? "/assets/svg/mic.svg" : "/assets/svg/mic-off.svg"}
                            alt={isMicOn ? "Mic On" : "Mic Off"}
                        />
                    </button>

                    <button
                        className={`btn video-btn ${!isVideoOn ? 'btn-off' : ''}`}
                        onClick={handleVideoToggle}
                        title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
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
                    <button className="btn chat-btn">
                        <img src="/assets/svg/chat.svg" alt="Chat" />
                    </button>
                    <button className="btn end-btn">
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

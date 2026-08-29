import React, { useEffect, useState } from "react";
import "./meeting.css";
import { useSocket } from "../Providers/Socket";

export default function Meeting() {
    const [roomId, setRoomId] = useState("");
    const meetTitle = localStorage.getItem("meetTitle");

    const { socket } = useSocket();
    socket.emit("join-room", { roomId: "1", emailId: "any@ex.com" });

    useEffect(() => {
        const id = localStorage.getItem("roomId") || "";
        setRoomId(id);
    }, []);

    const copyRoomId = async () => {
        if (!roomId) return;
        try {
            await navigator.clipboard.writeText(roomId);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    return (
        <div className="layout">
            <header className="navbar">
                <div className="logo">ConnectHub</div>
            </header>

            <main className="content-gap"></main>

            <div className="toolbar">
                <div className="meet-title-box">
                    <span className="room-id-label">Title:</span>
                    <span className="room-id-value">{meetTitle}</span>
                </div>
                <div className="toolbuttons">
                    <button className="btn mic-btn"><img src="/assets/svg/mic.svg" alt="Mic" /></button>
                    <button className="btn video-btn"><img src="/assets/svg/video.svg" alt="Video" /></button>
                    <button className="btn raiseHand-btn"><img src="/assets/svg/raise-hand.svg" alt="Raise Hand" /></button>
                    <button className="btn participants-btn"><img src="/assets/svg/participants.svg" alt="Participants" /></button>
                    <button className="btn chat-btn"><img src="/assets/svg/chat.svg" alt="Chat" /></button>
                    <button className="btn end-btn"><img src="/assets/svg/endcall.svg" alt="End Call" /></button>
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

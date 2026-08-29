import { useEffect, useRef, useState } from "react";
import "./Styles/chatPanel.css";

export default function ChatPanel({ isOpen, onClose, socket, roomId, userId, userName }) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        if (!roomId) return;

        async function loadHistory() {
            try {
                const token = localStorage.getItem("loginToken");
                const res = await fetch(`https://connecthub.dikshant-ahalawat.live/chat/${roomId}`, {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });

                if (!res.ok) {
                    console.error("Chat history fetch failed. Status:", res.status);
                }

                const data = await res.json();
                setMessages(data);
            } catch (err) {
                console.error("ChatPanel: Error loading history:", err);
            }
        }
        loadHistory();
    }, [isOpen, roomId]);

    useEffect(() => {
        if (!socket) return;
        const handleReceive = (msg) => {
            setMessages(prev => [...prev, msg]);
        };
        socket.on("receive-chat-message", handleReceive);
        return () => {
            socket.off("receive-chat-message", handleReceive);
        };
    }, [socket]);

    const sendMessage = () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        if (!socket || !roomId) return;

        const payload = {
            roomId,
            senderId: userId,
            senderName: userName || "User",
            message: trimmed
        };

        socket.emit("send-chat-message", payload);
        setText("");
    };

    return (
        <div className={`chat-panel-wrapper ${isOpen ? "open" : ""}`}>
            <div className="chat-panel-backdrop" onClick={onClose} />
            <div className="chat-panel">
                <div className="chat-panel-header">
                    <h3>Meeting Chat</h3>
                    <button className="chat-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="chat-panel-body">
                    {messages.map((msg) => {
                        const isMe = msg.senderId === userId;
                        return (
                            <div key={msg._id || Math.random()} className={`chat-message-row ${isMe ? "me" : "other"}`}>
                                <div className="chat-message-meta">
                                    <span className="chat-sender">
                                        {isMe ? "You" : msg.senderName}
                                    </span>
                                </div>
                                <div className="chat-bubble">{msg.text || msg.message}</div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-panel-footer">
                    <textarea
                        className="chat-input"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Type a message..."
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                    />
                    <button className="chat-send-btn" onClick={sendMessage}>Send</button>
                </div>
            </div>
        </div>
    );
}
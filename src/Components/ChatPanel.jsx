import React, { useEffect, useRef, useState } from "react";
import "./chatPanel.css";

export default function ChatPanel({ isOpen, onClose, socket, roomId, userId, userName }) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");
    const messagesEndRef = useRef(null);

    console.log("💬 ChatPanel Rendered | isOpen:", isOpen, "| roomId:", roomId);

    // Auto scroll when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            console.log("⬇️ ChatPanel: Auto-scrolling to bottom");
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    // Load chat history when panel opens
    useEffect(() => {
        if (!isOpen) {
            console.log("🚪 ChatPanel closed — not loading history");
            return;
        }
        if (!roomId) {
            console.warn("⚠️ ChatPanel: Cannot load chat history — roomId missing");
            return;
        }

        console.log("📥 ChatPanel: Loading chat history for room:", roomId);

        async function loadHistory() {
            try {
                const token = localStorage.getItem("loginToken");

                console.log("📡 Fetching history from API...");

                const res = await fetch(`https://connecthub.dikshant-ahalawat.live/chat/${roomId}`, {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });

                if (!res.ok) {
                    console.error("❌ Chat history fetch failed. Status:", res.status);
                }

                const data = await res.json();
                console.log(`📜 Chat history loaded: ${data.length} messages`);

                setMessages(data);
            } catch (err) {
                console.error("❌ ChatPanel: Error loading history:", err);
            }
        }

        loadHistory();
    }, [isOpen, roomId]);

    // Listen for new messages from socket
    useEffect(() => {
        if (!socket) {
            console.warn("⚠️ ChatPanel: Socket not ready — cannot listen for messages");
            return;
        }

        console.log("🔌 ChatPanel: Socket listener attached -> receive-chat-message");

        const handleReceive = (msg) => {
            console.log("📨 ChatPanel: Received message via socket:", msg);
            setMessages(prev => [...prev, msg]);
        };

        socket.on("receive-chat-message", handleReceive);

        return () => {
            console.log("🔌 ChatPanel: Removing socket listener -> receive-chat-message");
            socket.off("receive-chat-message", handleReceive);
        };
    }, [socket]);

    // Send message
    const sendMessage = () => {
        const trimmed = text.trim();

        console.log("✏️ ChatPanel: Send attempt:", trimmed);

        if (!trimmed) {
            console.log("⚠️ ChatPanel: Ignoring empty message");
            return;
        }

        if (!socket || !roomId) {
            console.error("❌ ChatPanel: Cannot send — socket or roomId missing");
            return;
        }

        const payload = {
            roomId,
            senderId: userId,
            senderName: userName || "User",
            message: trimmed
        };

        console.log("📤 ChatPanel: Emitting message to socket:", payload);

        socket.emit("send-chat-message", payload);
        setText("");

        console.log("✅ ChatPanel: Message sent & input cleared");
    };

    useEffect(() => {
        // Only run in browsers that support visualViewport
        if (typeof window !== "undefined" && window.visualViewport) {
            const footer = document.querySelector(".chat-panel-footer");

            const adjustFooter = () => {
                const keyboardHeight = window.innerHeight - window.visualViewport.height - (window.visualViewport.offsetTop || 0);
                if (footer) {
                    footer.style.transform = keyboardHeight > 0
                        ? `translateY(-${keyboardHeight}px)`
                        : "";
                }
            };

            // Listen for viewport size changes (keyboard open/close)
            window.visualViewport.addEventListener("resize", adjustFooter);
            window.visualViewport.addEventListener("scroll", adjustFooter);

            return () => {
                window.visualViewport.removeEventListener("resize", adjustFooter);
                window.visualViewport.removeEventListener("scroll", adjustFooter);
            };
        }
    }, []);

    useEffect(() => {
        const onResize = () => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
        };

        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", onResize);
            return () => {
                window.visualViewport.removeEventListener("resize", onResize);
            };
        }
    }, [messages]);

    return (
        <div className={`chat-panel-wrapper ${isOpen ? "open" : ""}`}>
            <div
                className="chat-panel-backdrop"
                onClick={() => {
                    console.log("🚪 ChatPanel: Closing via backdrop click");
                    onClose();
                }}
            />

            <div className="chat-panel">
                <div className="chat-panel-header">
                    <h3>Meeting Chat</h3>
                    <button
                        className="chat-close-btn"
                        onClick={() => {
                            console.log("🚪 ChatPanel: Closing via X button");
                            onClose();
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div className="chat-panel-body">
                    {messages.map((msg) => {
                        const isMe = msg.senderId === userId;

                        console.log("📄 Rendering message:", msg);

                        return (
                            <div
                                key={msg._id || Math.random()}
                                className={`chat-message-row ${isMe ? "me" : "other"}`}
                            >
                                <div className="chat-message-meta">
                                    <span className="chat-sender">
                                        {isMe ? "You" : msg.senderName}
                                    </span>
                                </div>
                                <div className="chat-bubble">{msg.text}</div>
                            </div>
                        );
                    })}

                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-panel-footer">
                    <textarea
                        className="chat-input"
                        value={text}
                        onChange={(e) => {
                            console.log("⌨️ ChatPanel: Typing:", e.target.value);
                            setText(e.target.value);
                        }}
                        placeholder="Type a message..."
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                console.log("⏎ ChatPanel: Enter pressed — sending");
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                    />

                    <button
                        className="chat-send-btn"
                        onClick={() => {
                            console.log("📩 ChatPanel: Send button clicked");
                            sendMessage();
                        }}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}

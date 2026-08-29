import React, { useEffect, useState } from "react";
import "./participantsPanel.css";

export default function ParticipantsPanel({ isOpen, onClose, roomId, currentUserId, socket, participants, setParticipants }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isOpen || !roomId) return;

        const fetchParticipants = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem("loginToken");
                const res = await fetch(`https://connecthub.dikshant-ahalawat.live/meetings/${roomId}/participants`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Failed to fetch participants");
                }
                setParticipants(data.participants || []);

            } catch (err) {
                console.error("Fetch error:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchParticipants();
    }, [isOpen, roomId]);

    useEffect(() => {
        if (!socket) return;

        const handleUpdate = (newList) => {
            if (Array.isArray(newList)) {
                setParticipants(newList);
            }
        };

        socket.on("update-user-list", handleUpdate);

        return () => socket.off("update-user-list", handleUpdate);
    }, [socket]);

    const isCurrentUser = (userId) => {
        return String(userId) === String(currentUserId);
    };

    return (
        <div className={`participants-panel-wrapper ${isOpen ? "open" : ""}`}>
            <div className="participants-panel-backdrop" onClick={onClose} />
            <div className="participants-panel">

                <div className="participants-panel-header">
                    <h3>Participants ({participants.length})</h3>
                    <button className="participants-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="participants-panel-body">
                    {loading ? (
                        <div className="participants-loading">Loading...</div>
                    ) : error ? (
                        <div className="participants-error">{error}</div>
                    ) : participants.length === 0 ? (
                        <div className="participants-empty">No participants yet.</div>
                    ) : (
                        <div className="participants-list">
                            {participants.map((user) => (
                                <div key={user._id} className="participant-item">
                                    <div className="participant-avatar">
                                        {user.username ? user.username.charAt(0).toUpperCase() : "?"}
                                    </div>
                                    <div className="participant-info">
                                        <span className="participant-name">
                                            {user.username || "Unknown User"}
                                            {isCurrentUser(user._id) && " (You)"}
                                        </span>
                                        {/* <span className="participant-email">{user.email}</span> */}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
import { useEffect, useRef } from "react";
import "./Styles/participantsPanel.css";

export default function ParticipantsPanel({ isOpen, onClose, participants = [], currentUserId, isLocalUserHost }) {
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            window.history.pushState({ panel: "participants" }, "", window.location.href);
            const handlePopState = (event) => {
                event.preventDefault();
                if (onCloseRef.current) {
                    onCloseRef.current();
                }
            };
            window.addEventListener("popstate", handlePopState);

            return () => {
                window.removeEventListener("popstate", handlePopState);
                if (window.history.state && window.history.state.panel === "participants") {
                    window.history.back();
                }
            };
        }
    }, [isOpen]);

    const isCurrentUser = (participantId) => {
        return String(participantId) === String(currentUserId);
    };

    return (
        <div className={`participants-panel-wrapper ${isOpen ? "open" : ""}`}>
            <div className="participants-panel-backdrop" onClick={onClose} />

            <div className="participants-panel">

                <div className="participants-panel-header">
                    <h3>Participants ({participants?.length || 0})</h3>
                    <button className="participants-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="participants-panel-body">
                    {(!participants || participants.length === 0) ? (
                        <div className="participants-empty">No participants yet.</div>
                    ) : (
                        <div className="participants-list">
                            {participants.map((user) => {
                                if (!user) return null;

                                const isMe = isCurrentUser(user._id);
                                const amITheHost = isMe && isLocalUserHost;
                                const isRemoteHost = user.isHost === true || user.role === 'host';
                                const showHostBadge = amITheHost || isRemoteHost;

                                return (
                                    <div key={user._id} className="participant-item">
                                        <div className="participant-avatar">
                                            {user.username ? user.username.charAt(0).toUpperCase() : "?"}
                                        </div>
                                        <div className="participant-info">
                                            <span className="participant-name">
                                                {user.username || "Unknown User"}
                                                {isMe && " (You)"}
                                                {showHostBadge && (
                                                    <span className="host-badge"> (Host)</span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
import "./Styles/participantsPanel.css";

export default function ParticipantsPanel({ isOpen, onClose, participants = [], currentUserId, hostUserId }) {

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
                                const isHost = String(user._id) === String(hostUserId);

                                return (
                                    <div key={user._id} className="participant-item">
                                        <div className="participant-avatar">
                                            {user.username ? user.username.charAt(0).toUpperCase() : "?"}
                                        </div>
                                        <div className="participant-info">
                                            <span className="participant-name">
                                                {user.username || "Unknown User"}
                                                {isMe && <span style={{ color: "gray" }}> (You)</span>}
                                                {isHost && (
                                                    <span className="host-badge" style={{ color: "red", fontWeight: "bold", marginLeft: "5px" }}>
                                                        (Host)
                                                    </span>
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
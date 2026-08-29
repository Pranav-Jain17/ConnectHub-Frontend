import { useEffect } from "react";
import "./Styles/meetingModals.css";

export function InfoModal({ meetTitle, roomId, copyRoomId, onClose }) {
    return (
        <div className="info-modal-wrapper">
            <div className="meeting-modal-box info-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Meeting Info</h2>
                </div>

                <div className="modal-body">
                    <div className="input-group-modern">
                        <label>Meeting Title</label>
                        <div className="read-only-field">
                            {meetTitle || "Untitled Meeting"}
                        </div>
                    </div>

                    <div className="input-group-modern">
                        <label>Room ID</label>
                        <div className="read-only-field with-action">
                            <span>{roomId}</span>
                            <button onClick={copyRoomId} className="icon-btn" title="Copy Room ID">
                                <img src="/assets/svg/copyCode.svg" alt="Copy" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="btn-primary full-width">Close</button>
                </div>
            </div>

            <div className="transparent-backdrop" onClick={onClose}></div>
        </div>
    );
}

export function ConfirmationModal({ title, message, onConfirm, onCancel }) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') onConfirm();
            else if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onConfirm, onCancel]);

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="meeting-modal-box confirmation-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{title}</h2>
                </div>

                <div className="modal-body">
                    <p className="confirmation-message">{message}</p>
                </div>

                <div className="modal-footer">
                    <button className="btn-danger" onClick={onConfirm} autoFocus>Yes</button>
                    <button className="btn-secondary" onClick={onCancel}>Cancel</button>
                </div>
            </div>
        </div>
    );
}
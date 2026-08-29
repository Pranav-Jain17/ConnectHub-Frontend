import { useEffect } from "react";
import "./Styles/meeting-modals.css";

export function InfoModal({ meetTitle, roomId, copyRoomId, onClose }) {
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-box info-modal" onClick={(e) => e.stopPropagation()}>
                <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                    Meeting Info
                </h2>
                <div className="info-row" style={{ marginBottom: '1.2rem' }}>
                    <strong style={{ display: 'block', color: '#666', marginBottom: '5px', fontSize: '0.9rem' }}>
                        Meeting Title
                    </strong>
                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500', padding: '10px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        {meetTitle || "Untitled Meeting"}
                    </p>
                </div>
                <div className="info-row">
                    <strong style={{ display: 'block', color: '#666', marginBottom: '5px', fontSize: '0.9rem' }}>
                        Room ID
                    </strong>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f9fa', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <code style={{ fontSize: '1rem', color: '#333' }}>{roomId}</code>
                        <button
                            onClick={copyRoomId}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                            title="Copy Room ID"
                        >
                            <img src="/assets/svg/copyCode.svg" alt="Copy" style={{ width: '18px', height: '18px' }} />
                        </button>
                    </div>
                </div>
                <div className="modal-buttons" style={{ marginTop: '2rem' }}>
                    <button onClick={onClose} style={{ width: '100%', padding: '12px' }}>Close</button>
                </div>
            </div>
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
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <h2>{title}</h2>
                <p>{message}</p>
                <div className="modal-buttons">
                    <button className="btn-confirm-danger" onClick={onConfirm} autoFocus>Yes</button>
                    <button className="btn-cancel-grey" onClick={onCancel}>Cancel</button>
                </div>
            </div>
        </div>
    );
}
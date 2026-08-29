import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import './Styles/homeModals.css';

function HomeModals({ type, onClose, user, actions }) {
    const [inputValue, setInputValue] = useState("");
    const [settingsTab, setSettingsTab] = useState('general');
    const [isPasswordExpanding, setIsPasswordExpanding] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [joinMuted, setJoinMuted] = useState(() => localStorage.getItem('joinMuted') === 'true');
    const [joinVideoOff, setJoinVideoOff] = useState(() => localStorage.getItem('joinVideoOff') === 'true');

    useEffect(() => {
        if (type) {
            setInputValue("");
            setSettingsTab('general');
            setIsPasswordExpanding(false);
            setNewPassword("");
            setConfirmNewPassword("");
        }
    }, [type]);

    if (!type) return null;

    const togglePreference = (key, setter, value) => {
        const newValue = !value;
        setter(newValue);
        localStorage.setItem(key, newValue);
    };

    const handleSubmit = () => {
        if (type === 'create') {
            if (!inputValue) return toast.error("Meet Title is required!");
            actions.create(inputValue);
        } else if (type === 'join') {
            if (!inputValue) return toast.error("Room ID is required.");
            actions.join(inputValue);
        } else if (type === 'settings') {
            if (!newPassword || !confirmNewPassword) return toast.error("Please fill all fields");
            if (newPassword !== confirmNewPassword) return toast.error("Passwords do not match");
            actions.changePassword(newPassword);
        }
    };

    const renderContent = () => {
        switch (type) {
            case "create":
                return (
                    <>
                        <h2>New Meeting</h2>
                        <div className="input-group-modern">
                            <label>Meeting Title</label>
                            <input
                                autoFocus
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                                placeholder="e.g. Daily Standup"
                            />
                        </div>
                    </>
                );
            case "join":
                return (
                    <>
                        <h2>Join Meeting</h2>
                        <div className="input-group-modern">
                            <label>Room ID</label>
                            <input
                                autoFocus
                                type="text"
                                inputMode="numeric"
                                value={inputValue}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "" || /^[0-9]+$/.test(val)) setInputValue(val);
                                }}
                                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                                placeholder="e.g. 123456"
                            />
                        </div>
                    </>
                );
            case "profile":
                return (
                    <div className="profile-modal-content">
                        <div className="profile-header">
                            <div className="profile-avatar-large">
                                <img src="/assets/svg/profile.svg" alt="Avatar" />
                            </div>
                            <h3>{user.name}</h3>
                        </div>
                        <div className="profile-details-card">
                            <div className="detail-row">
                                <span className="detail-label">Username</span>
                                <span className="detail-value">{user.name}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Email</span>
                                <span className="detail-value">{user.email}</span>
                            </div>
                            {/* <div className="detail-row">
                                <span className="detail-label">Password</span>
                                <span className="detail-value" style={{ letterSpacing: '2px' }}>••••••••••••</span>
                            </div> */}
                        </div>
                    </div>
                );
            case "settings":
                return (
                    <div className="settings-container">
                        <h2>Settings</h2>
                        <div className="settings-tabs">
                            <button className={`tab-btn ${settingsTab === 'general' ? 'active' : ''}`} onClick={() => setSettingsTab('general')}>General</button>
                            <button className={`tab-btn ${settingsTab === 'security' ? 'active' : ''}`} onClick={() => setSettingsTab('security')}>Security</button>
                        </div>
                        <div className="settings-body">
                            {settingsTab === 'general' && (
                                <div className="settings-list fade-in">
                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span>Join Muted</span>
                                            <small>Microphone will be off when you join</small>
                                        </div>
                                        <label className="switch">
                                            <input type="checkbox" checked={joinMuted} onChange={() => togglePreference('joinMuted', setJoinMuted, joinMuted)} />
                                            <span className="slider round"></span>
                                        </label>
                                    </div>
                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span>Turn off Video</span>
                                            <small>Camera will be off when you join</small>
                                        </div>
                                        <label className="switch">
                                            <input type="checkbox" checked={joinVideoOff} onChange={() => togglePreference('joinVideoOff', setJoinVideoOff, joinVideoOff)} />
                                            <span className="slider round"></span>
                                        </label>
                                    </div>
                                </div>
                            )}
                            {settingsTab === 'security' && (
                                <div className="settings-list fade-in">
                                    {!isPasswordExpanding ? (
                                        <div className="setting-card">
                                            <div className="setting-info">
                                                <span>Password</span>
                                                <small>Protect your account</small>
                                            </div>
                                            <button className="btn-secondary" onClick={() => setIsPasswordExpanding(true)}>Change</button>
                                        </div>
                                    ) : (
                                        <div className="password-form fade-in">
                                            <h4>Set New Password</h4>
                                            <input
                                                autoFocus
                                                type="password"
                                                placeholder="New Password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                            />
                                            <input
                                                type="password"
                                                placeholder="Confirm Password"
                                                value={confirmNewPassword}
                                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                                            />
                                            <div className="form-actions-inline">
                                                <button className="btn-text" onClick={() => setIsPasswordExpanding(false)}>Cancel</button>
                                                <button className="btn-primary" onClick={handleSubmit}>Update</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="modal-backdrop" onClick={(e) => {
            if (e.target.className === 'modal-backdrop') onClose();
        }}>
            <div className="modal-box">
                {renderContent()}

                {type === 'create' || type === 'join' ? (
                    <div className="modal-footer">
                        <button className="btn-cancel" onClick={onClose}>Cancel</button>
                        <button className="btn-primary" onClick={handleSubmit}>
                            {type === 'create' ? 'Create' : 'Join'}
                        </button>
                    </div>
                ) : null}

                {type === 'profile' ? (
                    <div className="modal-footer">
                        <button className="btn-primary full-width" onClick={onClose}>Close</button>
                    </div>
                ) : null}

                {type === 'settings' && !isPasswordExpanding ? (
                    <div className="modal-footer">
                        <button className="btn-primary full-width" onClick={onClose}>Done</button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default HomeModals;
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import HomeModals from './HomeModals';
import './Styles/home.css';

function Home() {
    const navigate = useNavigate();
    const dropdownRef = useRef(null);

    const userName = localStorage.getItem("userName") || "User";
    const userEmail = localStorage.getItem("userEmail") || "user@example.com";
    const loginToken = localStorage.getItem("loginToken");

    const [showDropdown, setShowDropdown] = useState(false);
    const [modalType, setModalType] = useState(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const apiRequest = async (url, method, body = null) => {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${loginToken}`
        };
        const config = { method, headers };
        if (body) config.body = JSON.stringify(body);

        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) throw new Error(data.message || data.error || `Status: ${response.status}`);
        return data;
    };

    const handleCreateMeeting = async (title) => {
        try {
            const data = await apiRequest('https://connecthub.dikshant-ahalawat.live/meetings', 'POST', {
                title: title,
                scheduledAt: new Date().toISOString()
            });
            localStorage.setItem("roomId", data.roomId);
            localStorage.setItem("meetTitle", title);
            localStorage.setItem("isHost", "true");
            navigate("/meeting");
            setModalType(null);
        } catch (err) {
            toast.error(`Error: ${err.message}`);
        }
    };

    const handleJoinMeeting = async (roomId) => {
        try {
            const userId = localStorage.getItem("userId");
            if (!userId || !loginToken) {
                toast.error("User session missing.");
                return;
            }
            const data = await apiRequest(`https://connecthub.dikshant-ahalawat.live/meetings/${userId}/join`, 'POST', { roomId });
            localStorage.setItem("roomId", roomId);
            localStorage.setItem("meetTitle", data?.meeting?.title || `Meeting ${roomId}`);
            localStorage.setItem("isHost", "false");
            navigate("/meeting");
            setModalType(null);
        } catch (err) {
            toast.error(`Error: ${err.message}`);
        }
    };

    const handleChangePassword = async (newPassword) => {
        try {
            await apiRequest('https://connecthub.dikshant-ahalawat.live/auth/reset-password', 'POST', { newPassword });
            toast.success("Password updated successfully!");
            setModalType(null);
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleLogout = async () => {
        try {
            if (loginToken) await apiRequest('https://connecthub.dikshant-ahalawat.live/auth/logout', 'POST');
        } catch (err) {
            console.error(err);
        } finally {
            sessionStorage.clear();
            localStorage.clear();
            toast.success("Logged out successfully");
            navigate("/login");
        }
    };

    const openModal = (type) => {
        setModalType(type);
        setShowDropdown(false);
    };

    return (
        <div className="home-page">
            <div className="top-nav">
                <div className="nav-left">
                    <p className="app-logo">ConnectHub</p>
                </div>
                <div className="nav-right" ref={dropdownRef}>
                    <span className="user-display-name">Hi, {userName}</span>
                    <div className="profile-wrapper" onClick={() => setShowDropdown(!showDropdown)}>
                        <div className="profile-icon">
                            <img src="/assets/svg/profile.svg" alt="Profile" />
                        </div>
                        {showDropdown && (
                            <div className="profile-dropdown">
                                <button className="dropdown-item profile" onClick={() => openModal("profile")}>
                                    <img src="/assets/svg/profile.svg" alt="" className="icon-small" /> Profile
                                </button>
                                <button className="dropdown-item settings" onClick={() => openModal("settings")}>
                                    <img src="/assets/svg/settings.svg" alt="" className="icon-small" /> Settings
                                </button>
                                <button className="dropdown-item logout" onClick={handleLogout}>
                                    <img src="/assets/svg/logout.svg" alt="" className="icon-small" /> Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="home-container">
                <div className="home-left">
                    <h1>Welcome to ConnectHub</h1>
                    <p>Connect instantly with your team or friends.<br />Start or join a meeting with one click.</p>
                    <div className="home-buttons">
                        <button className="btn-join" onClick={() => openModal("join")}>Join Meet</button>
                        <button className="btn-create" onClick={() => openModal("create")}>Create Meet</button>
                    </div>
                </div>
                <div className="home-right">
                    <img src="/assets/signup.png" alt="Meeting illustration" />
                </div>
            </div>

            <HomeModals
                type={modalType}
                onClose={() => setModalType(null)}
                user={{ name: userName, email: userEmail }}
                actions={{
                    create: handleCreateMeeting,
                    join: handleJoinMeeting,
                    changePassword: handleChangePassword
                }}
            />
        </div>
    );
}

export default Home;
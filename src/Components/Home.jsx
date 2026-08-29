// Home.jsx
import React, { useState } from 'react';
import './home.css';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

function Home({ userId }) {
    const navigate = useNavigate();

    const createMeeting = async (meetTitle) => {
        const loginToken = localStorage.getItem("loginToken");
        const now = new Date().toISOString();

        const payload = {
            title: meetTitle,
            scheduledAt: now
        };

        const response = await fetch('http://3.110.101.93:3000/meetings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${loginToken}`
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || `Status: ${response.status}`);
        }

        return response.json();
    };

    const joinMeeting = async (userId, roomId, loginToken) => {
        const response = await fetch(
            `http://3.110.101.93:3000/meetings/${userId}/join`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${loginToken}`
                },
                credentials: 'include',
                body: JSON.stringify({ roomId })
            }
        );

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || `Status: ${response.status}`);
        }

        return response.json();
    };

    const logoutUser = async (loginToken) => {
        const response = await fetch('http://3.110.101.93:3000/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${loginToken}`
            },
            credentials: 'include'
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Status: ${response.status}`);
        }

        return response.json();
    };

    const handleLogout = async () => {
        const loginToken = localStorage.getItem("loginToken");
        try {
            if (loginToken) {
                await logoutUser(loginToken);
            }
        } catch (err) {
            console.error("Error while logging out:", err.message);
        } finally {
            sessionStorage.clear();
            localStorage.clear();
            toast.success("Logged out successfully");
            navigate("/login");
        }
    };

    // STATE for modals & input
    const [modalType, setModalType] = useState(null); // 'create' | 'join' | null
    const [inputValue, setInputValue] = useState("");

    const openCreateModal = () => {
        setInputValue("");
        setModalType("create");
    };

    const openJoinModal = () => {
        setInputValue("");
        setModalType("join");
    };

    const closeModal = () => {
        setInputValue("");
        setModalType(null);
    };

    const handleModalSubmit = async () => {
        if (!inputValue) {
            toast.error(
                modalType === "create"
                    ? "Meet Title is required !!"
                    : "Room ID is required."
            );
            return;
        }

        if (modalType === "create") {
            try {
                const data = await createMeeting(inputValue);
                const roomId = data.roomId;
                localStorage.setItem("roomId", roomId);
                localStorage.setItem("meetTitle", inputValue);
                localStorage.setItem("isHost", "true");
                navigate("/meeting");
            } catch (err) {
                toast.error(`Error creating meet: ${err.message}`);
            }
        } else if (modalType === "join") {
            const storedUserId = localStorage.getItem("userId");
            const loginToken = localStorage.getItem("loginToken");
            if (!storedUserId || !loginToken) {
                toast.error("User ID or login token missing.");
                closeModal();
                return;
            }
            localStorage.setItem("roomId", inputValue);
            try {
                const data = await joinMeeting(storedUserId, inputValue, loginToken);
                toast.success("Joined meet successfully!");
                if (data && data.title) {
                    localStorage.setItem("meetTitle", data.title);
                } else {
                    localStorage.setItem("meetTitle", `Meeting ${inputValue}`);
                }
                localStorage.setItem("isHost", "false");
                navigate("/meeting");
            } catch (err) {
                toast.error(`Error joining meet: ${err.message}`);
            }
        }

        closeModal();
    };

    return (
        <div className="home-page">

            <div className="top-nav">
                <div className="nav-left">
                    <p className="app-logo">ConnectHub</p>
                </div>

                <div className="nav-right">
                    <button className="btn-logout" onClick={handleLogout}>
                        Logout
                    </button>
                    <div className="profile-icon">
                        <img src="/assets/svg/profile.svg" alt="Profile" />
                    </div>
                </div>
            </div>

            <div className="home-container">
                <div className="home-left">
                    <h1>Welcome to ConnectHub</h1>
                    <p>
                        Connect instantly with your team or friends.
                        <br />
                        Start or join a meeting with one click.
                    </p>

                    <div className="home-buttons">
                        <button className="btn-join" onClick={openJoinModal}>
                            Join Meet
                        </button>
                        <button className="btn-create" onClick={openCreateModal}>
                            Create Meet
                        </button>
                    </div>
                </div>

                <div className="home-right">
                    <img src="/assets/signup.png" alt="Meeting illustration" />
                </div>
            </div>

            {/* Modal */}
            {modalType && (
                <div className="modal-backdrop">
                    <div className="modal-box">
                        <h2>
                            {modalType === "create"
                                ? "Enter Meeting Title"
                                : "Enter Room ID to Join"}
                        </h2>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={
                                modalType === "create"
                                    ? "e.g. Planning Meeting"
                                    : "e.g. abc123"
                            }
                        />
                        <div className="modal-buttons">
                            <button onClick={handleModalSubmit}>
                                {modalType === "create" ? "Create" : "Join"}
                            </button>
                            <button onClick={closeModal}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;

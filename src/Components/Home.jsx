import { useState, useEffect, useRef } from 'react';
import './Styles/home.css';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

function Home() {
    const navigate = useNavigate();
    const dropdownRef = useRef(null);
    const userName = localStorage.getItem("userName") || "User";
    const loginToken = localStorage.getItem("loginToken");
    const [showDropdown, setShowDropdown] = useState(false);
    const [modalType, setModalType] = useState(null);
    const [inputValue, setInputValue] = useState("");

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const createMeeting = async (meetTitle) => {
        const now = new Date().toISOString();
        const payload = { title: meetTitle, scheduledAt: now };
        const response = await fetch('https://connecthub.dikshant-ahalawat.live/meetings', {
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

    const joinMeeting = async (userId, roomId) => {
        const response = await fetch(
            `https://connecthub.dikshant-ahalawat.live/meetings/${userId}/join`,
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

    const handleLogout = async () => {
        try {
            if (loginToken) {
                await fetch('https://connecthub.dikshant-ahalawat.live/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${loginToken}`
                    },
                    credentials: 'include'
                });
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

    const openCreateModal = () => { setInputValue(""); setModalType("create"); };
    const openJoinModal = () => { setInputValue(""); setModalType("join"); };
    const closeModal = () => { setInputValue(""); setModalType(null); };

    const handleModalSubmit = async () => {
        if (!inputValue) {
            toast.error(modalType === "create" ? "Meet Title is required !!" : "Room ID is required.");
            return;
        }

        if (modalType === "create") {
            try {
                const data = await createMeeting(inputValue);
                localStorage.setItem("roomId", data.roomId);
                localStorage.setItem("meetTitle", inputValue);
                localStorage.setItem("isHost", "true");
                navigate("/meeting");
            } catch (err) {
                toast.error(`Error creating meet: ${err.message}`);
            }
        } else if (modalType === "join") {
            const storedUserId = localStorage.getItem("userId");
            if (!storedUserId || !loginToken) {
                toast.error("User session missing.");
                return;
            }
            localStorage.setItem("roomId", inputValue);
            try {
                const data = await joinMeeting(storedUserId, inputValue);
                toast.success("Joined meet successfully!");
                localStorage.setItem("meetTitle", data?.meeting?.title || `Meeting ${inputValue}`);
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

                <div className="nav-right" ref={dropdownRef}>
                    <span className="user-display-name">Hi, {userName}</span>
                    <div
                        className="profile-wrapper"
                        onClick={() => setShowDropdown(!showDropdown)}
                    >
                        <div className="profile-icon">
                            <img src="/assets/svg/profile.svg" alt="Profile" />
                        </div>

                        {showDropdown && (
                            <div className="profile-dropdown">
                                <div className="dropdown-user-info">
                                    <strong>{userName}</strong>
                                    <p>Online</p>
                                </div>
                                <hr />
                                <button className="dropdown-item logout" onClick={handleLogout}>
                                    <img src="/assets/svg/logout.svg" alt="" className="icon-small" />
                                    Logout
                                </button>
                            </div>
                        )}
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
                        <button className="btn-join" onClick={openJoinModal}>Join Meet</button>
                        <button className="btn-create" onClick={openCreateModal}>Create Meet</button>
                    </div>
                </div>

                <div className="home-right">
                    <img src="/assets/signup.png" alt="Meeting illustration" />
                </div>
            </div>

            {modalType && (
                <div className="modal-backdrop">
                    <div className="modal-box">
                        <h2>{modalType === "create" ? "Enter Meeting Title" : "Enter Room ID to Join"}</h2>
                        <input
                            autoFocus
                            type="text"
                            inputMode={modalType === "join" ? "numeric" : "text"}
                            value={inputValue}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (modalType === "join") {
                                    if (val === "" || /^[0-9]+$/.test(val)) setInputValue(val);
                                } else setInputValue(val);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleModalSubmit();
                                else if (e.key === "Escape") closeModal();
                            }}
                            placeholder={modalType === "create" ? "e.g. Planning Meeting" : "e.g. 123456"}
                        />
                        <div className="modal-buttons">
                            <button onClick={handleModalSubmit}>{modalType === "create" ? "Create" : "Join"}</button>
                            <button onClick={closeModal}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;
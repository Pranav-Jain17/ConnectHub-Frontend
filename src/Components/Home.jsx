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

        // const response = await fetch('https://connecthub-2.onrender.com/meetings', {
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

    const handleCreateMeet = async () => {
        const meetTitle = prompt("Enter meeting title:");

        if (!meetTitle) {
            alert('Title is required');
            return;
        }

        try {
            const data = await createMeeting(meetTitle);
            const roomId = data.roomId;

            localStorage.setItem("roomId", roomId);
            localStorage.setItem("meetTitle", meetTitle);

            navigate("/meeting");
        } catch (err) {
            alert(`Error creating meet: ${err.message}`);
        }
    };

    const joinMeeting = async (userId, roomId, loginToken) => {
        const response = await fetch(
            // https://connecthub-2.onrender.com/meetings/${userId}/join,
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

    const handleJoinMeet = async () => {
        const userId = localStorage.getItem("userId");
        const loginToken = localStorage.getItem("loginToken");

        if (!userId || !loginToken) {
            alert("User ID or login token missing.");
            return;
        }

        const roomId = prompt("Enter Room ID to join:");

        if (!roomId) {
            alert("Room ID is required.");
            return;
        }

        // ✅ store roomId for Meeting screen
        localStorage.setItem("roomId", roomId);

        try {
            const data = await joinMeeting(userId, roomId, loginToken);
            alert("Joined meet successfully!");

            // ✅ if backend returns a title, use it; else fallback
            if (data && data.title) {
                localStorage.setItem("meetTitle", data.title);
            } else {
                localStorage.setItem("meetTitle", `Meeting ${roomId}`);
            }

            navigate("/meeting");
        } catch (err) {
            alert(`Error joining meet: ${err.message}`);
        }
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
            localStorage.removeItem("loginToken");
            localStorage.removeItem("userId");
            localStorage.removeItem("roomId");
            localStorage.removeItem("meetTitle");

            toast.success("Logged out successfully");
            navigate("/login");          // Redirect to Login Page
        }
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
                        <button className="btn-join" onClick={handleJoinMeet}>
                            Join Meet
                        </button>
                        <button className="btn-create" onClick={handleCreateMeet}>
                            Create Meet
                        </button>
                    </div>
                </div>

                <div className="home-right">
                    <img src="/assets/signup.png" alt="Meeting illustration" />
                </div>
            </div>
        </div>
    );
}

export default Home;

import React, { useState } from 'react';
import './home.css';
import { useNavigate } from 'react-router-dom';

function Home({ userId }) {
    const navigate = useNavigate();

    const createMeeting = async (meetTitle) => {
        const loginToken = localStorage.getItem("loginToken");
        const now = new Date().toISOString();

        const payload = {
            title: meetTitle,
            scheduledAt: now
        };

        const response = await fetch('https://connecthub-2.onrender.com/meetings', {
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
            const meetId = data._id;
            const roomId = data.roomId;

            localStorage.setItem("meetId", meetId);
            localStorage.setItem("roomId", roomId);
            localStorage.setItem("meetTitle", meetTitle);

            navigate("/meeting");
        } catch (err) {
            alert(`Error creating meet: ${err.message}`);
        }
    };

    const joinMeeting = async (meetId, roomId, loginToken) => {
        const response = await fetch(
            `https://connecthub-2.onrender.com/meetings/${meetId}/join`,
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
        const meetId = localStorage.getItem("meetId");
        const loginToken = localStorage.getItem("loginToken");

        if (!meetId || !loginToken) {
            alert("Meet ID or login token missing.");
            return;
        }

        const roomId = prompt("Enter Room ID to join:");

        if (!roomId) {
            alert("Room ID is required.");
            return;
        }

        try {
            await joinMeeting(meetId, roomId, loginToken);
            alert("Joined meet successfully!");
            navigate("/meeting");
        } catch (err) {
            alert(`Error joining meet: ${err.message}`);
        }
    };

    return (
        <div className="home-page">
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

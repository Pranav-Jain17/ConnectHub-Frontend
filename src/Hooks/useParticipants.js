import { useState, useEffect, useCallback } from "react";

export const useParticipants = (roomId, socket) => {

    const [participants, setParticipants] = useState([]);

    const fetchParticipants = useCallback(async () => {
        if (!roomId) return;
        try {
            const token = localStorage.getItem("loginToken");
            const res = await fetch(`https://connecthub.dikshant-ahalawat.live/meetings/${roomId}/participants`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (res.ok) {
                setParticipants(data.participants || []);
            }
        } catch (err) {
            console.error("Failed to fetch participants:", err);
        }
    }, [roomId]);

    useEffect(() => {
        fetchParticipants();
    }, [fetchParticipants]);

    useEffect(() => {
        if (!socket) return;
        const handleUpdate = (newList) => {
            if (Array.isArray(newList)) {
                setParticipants(newList);
            } else {
                fetchParticipants();
            }
        };

        socket.on("update-user-list", handleUpdate);
        socket.on("user-joined", fetchParticipants);
        socket.on("user-left", fetchParticipants);

        return () => {
            socket.off("update-user-list", handleUpdate);
            socket.off("user-joined", fetchParticipants);
            socket.off("user-left", fetchParticipants);
        };
    }, [socket, fetchParticipants]);

    return { participants };
};
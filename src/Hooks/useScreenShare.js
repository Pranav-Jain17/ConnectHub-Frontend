import { useRef, useState } from "react";

export default function useScreenShare({
    peerConnectionsRef,
    localStreamRef,
    localVideoRef,
    socket,   // 🟢 Added: Needed to notify backend
    roomId    // 🟢 Added: Needed for socket event payload
}) {
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const screenStreamRef = useRef(null);

    const startScreenShare = async () => {
        try {
            // 1. Get the screen stream
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" },
                audio: false, // Change to true if you want to share system audio
            });

            const screenTrack = screenStream.getVideoTracks()[0];
            screenStreamRef.current = screenStream;

            // 2. Replace the video track for all connected peers
            // We use Promise.all to ensure we don't proceed until tracks are replaced
            const promises = Object.values(peerConnectionsRef.current).map((pc) => {
                const sender = pc.getSenders().find((s) => s.track?.kind === "video");

                if (sender) {
                    return sender.replaceTrack(screenTrack);
                }
                // If the user joined with video OFF, there might not be a video sender.
                // In a robust app, you would add a track here, but replaceTrack is safer for now.
                return Promise.resolve();
            });

            await Promise.all(promises);

            // 3. Update local view to show what you are sharing
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = screenStream;
            }

            // 4. Notify Backend
            if (socket && roomId) {
                socket.emit('start-screen-share', { roomId });
            }

            setIsScreenSharing(true);

            // 5. Handle "Stop Sharing" via Browser UI (floating toolbar)
            screenTrack.onended = () => {
                stopScreenShare();
            };

        } catch (error) {
            console.error("❌ Error starting screen share:", error);
        }
    };

    const stopScreenShare = async () => {
        try {
            // 1. Get the original camera track (if it exists)
            const cameraTrack = localStreamRef.current?.getVideoTracks()[0];

            // 2. Revert track on all peer connections
            const promises = Object.values(peerConnectionsRef.current).map((pc) => {
                const sender = pc.getSenders().find((s) => s.track?.kind === "video");

                if (sender) {
                    // Switch back to camera, or null if camera was off
                    return sender.replaceTrack(cameraTrack || null);
                }
                return Promise.resolve();
            });

            await Promise.all(promises);

            // 3. Revert local video view
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
            }

            // 4. Stop the screen share stream tracks
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((t) => t.stop());
                screenStreamRef.current = null;
            }

            // 5. Notify Backend
            if (socket && roomId) {
                socket.emit('stop-screen-share', { roomId });
            }

            setIsScreenSharing(false);

        } catch (error) {
            console.error("❌ Error stopping screen share:", error);
        }
    };

    return {
        isScreenSharing,
        startScreenShare,
        stopScreenShare,
    };
}
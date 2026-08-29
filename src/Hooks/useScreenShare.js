import { useRef, useState } from "react";

export default function useScreenShare({
    peerConnectionsRef,
    localStreamRef,
    localVideoRef,
    socket,
    roomId
}) {
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const screenStreamRef = useRef(null);

    const startScreenShare = async () => {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" },
                audio: false,
            });

            const screenTrack = screenStream.getVideoTracks()[0];
            screenStreamRef.current = screenStream;

            const promises = Object.values(peerConnectionsRef.current).map((pc) => {
                let sender = pc.getSenders().find((s) => s.track?.kind === "video");

                if (!sender) {
                    const transceiver = pc.getTransceivers().find(
                        (t) => t.receiver.track.kind === "video"
                    );
                    sender = transceiver?.sender;
                }

                if (sender) {
                    return sender.replaceTrack(screenTrack);
                }
                return Promise.resolve();
            });

            await Promise.all(promises);

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = screenStream;
            }

            if (socket && roomId) {
                socket.emit('start-screen-share', { roomId });
            }

            setIsScreenSharing(true);

            screenTrack.onended = () => {
                stopScreenShare();
            };

        } catch (error) {
            console.error("Error starting screen share:", error);
        }
    };

    const stopScreenShare = async () => {
        try {
            const cameraTrack = localStreamRef.current?.getVideoTracks()[0];

            const promises = Object.values(peerConnectionsRef.current).map((pc) => {
                let sender = pc.getSenders().find((s) => s.track?.kind === "video");

                if (!sender) {
                    const transceiver = pc.getTransceivers().find(
                        (t) => t.receiver.track.kind === "video"
                    );
                    sender = transceiver?.sender;
                }

                if (sender) {
                    return sender.replaceTrack(cameraTrack || null);
                }
                return Promise.resolve();
            });

            await Promise.all(promises);

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
            }

            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((t) => t.stop());
                screenStreamRef.current = null;
            }

            if (socket && roomId) {
                socket.emit('stop-screen-share', { roomId });
            }

            setIsScreenSharing(false);

        } catch (error) {
            console.error("Error stopping screen share:", error);
        }
    };

    return {
        isScreenSharing,
        startScreenShare,
        stopScreenShare,
    };
}
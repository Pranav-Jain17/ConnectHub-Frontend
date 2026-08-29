import { useRef, useState } from "react";

export default function useScreenShare({
    peerConnectionsRef,
    localStreamRef,
    localVideoRef,
}) {
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const screenStreamRef = useRef(null);

    const startScreenShare = async () => {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        screenStreamRef.current = screenStream;

        Object.values(peerConnectionsRef.current).forEach((pc) => {
            const sender = pc
                .getSenders()
                .find((s) => s.track?.kind === "video");

            sender?.replaceTrack(screenTrack);
        });

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);

        screenTrack.onended = stopScreenShare;
    };

    const stopScreenShare = () => {
        const cameraTrack =
            localStreamRef.current?.getVideoTracks?.()[0];

        Object.values(peerConnectionsRef.current).forEach((pc) => {
            const sender = pc
                .getSenders()
                .find((s) => s.track?.kind === "video");

            if (sender && cameraTrack) sender.replaceTrack(cameraTrack);
        });

        if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }

        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;

        setIsScreenSharing(false);
    };

    return {
        isScreenSharing,
        startScreenShare,
        stopScreenShare,
    };
}

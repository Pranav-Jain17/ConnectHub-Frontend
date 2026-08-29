import { useEffect, useRef } from "react";
import "./Styles/video-grid.css";

export default function VideoGrid({
    localVideoRef,
    isMicOn,
    userName,
    isHost,
    remoteStreams,
    peerMicState,
    participantNameMap,
    isAlone
}) {
    return (
        <main className={`content-gap ${isAlone ? "single-mode" : "split-mode"}`}>
            <div className="video-container">
                <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="local-video"
                />
                <span className="video-label">
                    <img
                        src={isMicOn ? "/assets/svg/mic.svg" : "/assets/svg/mic-off.svg"}
                        alt=""
                    />
                    {userName} {isHost && "(Host)"}
                </span>
            </div>

            {remoteStreams && Object.entries(remoteStreams).map(([remoteUserId, stream]) => (
                <RemoteVideo
                    key={remoteUserId}
                    stream={stream}
                    isMicOn={peerMicState[remoteUserId]}
                    name={participantNameMap[remoteUserId] || "Remote User"}
                />
            ))}
        </main>
    );
}

function RemoteVideo({ stream, isMicOn = true, name = "Remote User" }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (!videoRef.current || !stream) return;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => { });
    }, [stream]);

    return (
        <div className="video-container">
            <video ref={videoRef} autoPlay playsInline className="remote-video" />
            <span className="video-label">
                <img
                    src={isMicOn ? "/assets/svg/mic.svg" : "/assets/svg/mic-off.svg"}
                    alt=""
                />
                {name}
            </span>
        </div>
    );
}
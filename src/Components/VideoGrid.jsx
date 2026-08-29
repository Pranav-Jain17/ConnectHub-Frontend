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
    const remoteTracks = remoteStreams ? Object.values(remoteStreams) : [];

    // Detect active screen share
    const activeScreenShare = remoteTracks.find(t => t.isScreenShare && t.kind === 'video');

    // Only camera feeds (no screen shares)
    const cameraFeeds = remoteTracks.filter(t => !t.isScreenShare && t.kind === 'video');

    // ✅ Screen share mode — big stage + vertical sidebar
    if (activeScreenShare) {
        return (
            <main className="content-gap presentation-mode">
                {/* Big screen share stage */}
                <div className="presentation-stage">
                    <ScreenVideo
                        stream={activeScreenShare.stream}
                        name={`${activeScreenShare.participantName || participantNameMap[activeScreenShare.participant?.identity] || "Remote User"}'s Screen`}
                    />
                </div>

                {/* Vertical sidebar with all participants */}
                <aside className="participants-sidebar">
                    <div className="sidebar-scroll-area">

                        {/* Local user */}
                        <div className="sidebar-item">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className="sidebar-video local-sidebar-video"
                            />
                            <span className="sidebar-label">
                                <img
                                    src={isMicOn ? "/assets/svg/mic.svg" : "/assets/svg/mic-off.svg"}
                                    alt=""
                                />
                                {userName} {isHost && "(Host)"}
                            </span>
                        </div>

                        {/* Remote camera feeds */}
                        {cameraFeeds.map((t) => (
                            <div className="sidebar-item" key={t.participant?.sid}>
                                <SidebarVideo
                                    stream={t.stream}
                                    name={t.participantName || participantNameMap[t.participant?.identity] || "Remote User"}
                                    isMicOn={peerMicState[t.participant?.identity]}
                                />
                            </div>
                        ))}
                    </div>
                </aside>
            </main>
        );
    }

    // ✅ Normal grid mode — auto layout based on participant count
    const totalCount = 1 + cameraFeeds.length; // local + remote cameras
    const gridClass = getGridClass(totalCount);

    return (
        <main className={`content-gap video-grid ${gridClass}`}>
            {/* Local user */}
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

            {/* Remote camera feeds */}
            {cameraFeeds.map((t) => (
                <RemoteVideo
                    key={t.participant?.sid}
                    stream={t.stream}
                    isMicOn={peerMicState[t.participant?.identity]}
                    name={t.participantName || participantNameMap[t.participant?.identity] || "Remote User"}
                />
            ))}
        </main>
    );
}

// ✅ Dynamically pick grid layout based on participant count
function getGridClass(count) {
    if (count === 1) return "grid-1";
    if (count === 2) return "grid-2";
    if (count === 3) return "grid-3";
    if (count === 4) return "grid-4";
    return "grid-many"; // 5+
}

// ✅ Big screen share view
function ScreenVideo({ stream, name }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (!videoRef.current || !stream) return;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
    }, [stream]);

    return (
        <div className="screen-container">
            <video ref={videoRef} autoPlay playsInline className="screen-video" />
            <span className="video-label">{name}</span>
        </div>
    );
}

// ✅ Sidebar participant tile
function SidebarVideo({ stream, isMicOn = true, name = "Remote User" }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (!videoRef.current || !stream) return;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
    }, [stream]);

    return (
        <>
            <video ref={videoRef} autoPlay playsInline className="sidebar-video" />
            <span className="sidebar-label">
                <img
                    src={isMicOn ? "/assets/svg/mic.svg" : "/assets/svg/mic-off.svg"}
                    alt=""
                />
                {name}
            </span>
        </>
    );
}

// ✅ Regular grid remote participant
function RemoteVideo({ stream, isMicOn = true, name = "Remote User" }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (!videoRef.current || !stream) return;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
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
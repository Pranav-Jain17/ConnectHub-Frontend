import "./Styles/meeting-toolbar.css";

export default function MeetingToolbar({
    currentTime,
    meetTitle,
    isMicOn,
    handleMicToggle,
    localStreamReady,
    isVideoOn,
    handleVideoToggle,
    isScreenSharing,
    onScreenShareClick,
    onEndClick,
    onInfoClick,
    onChatClick,
    onParticipantsClick,
    showMoreMenu,
    setShowMoreMenu,
    handleMobileAction
}) {
    return (
        <div className="toolbar">
            <div className="toolbar-left">
                <div className="meet-info-text">
                    <span className="time-display">{currentTime}</span>
                    <span className="separator">|</span>
                    <span className="title-display">{meetTitle || "Meeting"}</span>
                </div>
            </div>

            <div className="toolbar-center">
                <button
                    className={`btn mic-btn ${!isMicOn ? "btn-off" : ""}`}
                    onClick={handleMicToggle}
                    disabled={!localStreamReady}
                >
                    <img src={isMicOn ? "/assets/svg/mic.svg" : "/assets/svg/mic-off.svg"} alt="" />
                </button>

                <button
                    className={`btn video-btn ${!isVideoOn ? "btn-off" : ""}`}
                    onClick={handleVideoToggle}
                    disabled={!localStreamReady}
                >
                    <img src={isVideoOn ? "/assets/svg/video.svg" : "/assets/svg/video-off.svg"} alt="" />
                </button>

                <button
                    className={`btn screen-btn ${isScreenSharing ? "btn-off" : ""}`}
                    onClick={onScreenShareClick}
                >
                    <img src="/assets/svg/screen-share.svg" alt="Screen Share" />
                </button>

                <button className="btn end-btn" onClick={onEndClick}>
                    <img src="/assets/svg/endcall.svg" alt="End Call" />
                </button>
            </div>

            <div className="toolbar-right">
                <div className="desktop-actions">
                    <button className="btn info-btn" onClick={onInfoClick}>
                        <img src="/assets/svg/info.svg" alt="Info" />
                    </button>
                    <button className="btn chat-btn" onClick={onChatClick}>
                        <img src="/assets/svg/chat.svg" alt="Chat" />
                    </button>
                    <button className="btn participant-btn" onClick={onParticipantsClick}>
                        <img src="/assets/svg/participants.svg" alt="participant" />
                    </button>
                </div>

                <div className="mobile-actions">
                    <button
                        className={`btn more-btn ${showMoreMenu ? 'active' : ''}`}
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                    >
                        <img src="/assets/svg/tri-dot.svg" alt="More" />
                    </button>

                    {showMoreMenu && (
                        <div className="mobile-menu-dropdown">
                            <div className="menu-item" onClick={() => handleMobileAction('info')}>
                                <img src="/assets/svg/info.svg" alt="Info" />
                                <span>Info</span>
                            </div>
                            <div className="menu-item" onClick={() => handleMobileAction('chat')}>
                                <img src="/assets/svg/chat.svg" alt="" />
                                <span>Chat</span>
                            </div>
                            <div className="menu-item" onClick={() => handleMobileAction('participants')}>
                                <img src="/assets/svg/participants.svg" alt="" />
                                <span>Participants</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
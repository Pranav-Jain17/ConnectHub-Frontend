import { useEffect, useState, useRef, useMemo, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./Styles/meeting.css";
import { useSocket } from "../Providers/Socket";
import { useWebRTC } from "../Hooks/useWebRTC";
// import useScreenShare from "../Hooks/useScreenShare";
import { useParticipants } from "../Hooks/useParticipants";
import ChatPanel from "./ChatPanel";
import ParticipantsPanel from "./ParticipantsPanel";
import VideoGrid from "./VideoGrid";
import MeetingToolbar from "./MeetingToolbar";
import { InfoModal, ConfirmationModal } from "./MeetingModals";

export default function Meeting() {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const [roomId, setRoomId] = useState("");
    const [userId, setUserId] = useState("");
    const [livekitUrl, setLivekitUrl] = useState("");
    const [livekitToken, setLivekitToken] = useState("");
    const [isHost, setIsHost] = useState(false);
    const [hostUserId, setHostUserId] = useState(null);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [peerMicState, setPeerMicState] = useState({});
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
    const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
    const [currentTime, setCurrentTime] = useState("");
    const localVideoRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const isExitingRef = useRef(false);
    const nameMapRef = useRef({});
    const chatOpenRef = useRef(isChatOpen);
    const participantsOpenRef = useRef(isParticipantsOpen);
    const meetTitle = localStorage.getItem("meetTitle");
    const userName = localStorage.getItem("userName") || "You";
    const { participants } = useParticipants(roomId, socket);

    useEffect(() => {
        if (socket && !socket.connected) {
            socket.connect();
        }
    }, [socket]);

    const {
        localStream,
        localStreamReady,
        remoteStreams,
        toggleMic,
        toggleVideo,
    } = useWebRTC(livekitUrl, livekitToken);

    // const {
    //     isScreenSharing,
    //     startScreenShare,
    //     stopScreenShare,
    // } = useScreenShare({
    //     peerConnectionsRef,
    //     localStreamRef,
    //     localVideoRef,
    //     socket,
    //     roomId
    // });

    const isAlone = !remoteStreams || Object.keys(remoteStreams).length === 0;

    const participantNameMap = useMemo(() => {
        const map = {};
        participants.forEach((p) => {
            map[p._id] = p.username || "Unknown User";
        });
        Object.values(remoteStreams).forEach(({ participant }) => {
            if (participant) {
                map[participant.identity] = participant.identity;
            }
        });
        return map;
    }, [participants, remoteStreams]);

    useLayoutEffect(() => {
        chatOpenRef.current = isChatOpen;
    }, [isChatOpen]);

    useLayoutEffect(() => {
        participantsOpenRef.current = isParticipantsOpen;
    }, [isParticipantsOpen]);

    useEffect(() => {
        nameMapRef.current = participantNameMap;
    }, [participantNameMap]);

    useEffect(() => {
        const storedRoomId = localStorage.getItem("roomId");
        const storedUserId = localStorage.getItem("userId");
        const url = localStorage.getItem("livekitUrl");
        const token = localStorage.getItem("livekitToken");

        if (!storedRoomId || !storedUserId || !url || !token) {
            navigate("/home", { replace: true });
            return;
        }

        setRoomId(storedRoomId);
        setUserId(storedUserId);
        setLivekitUrl(url);
        setLivekitToken(token);
        setIsHost(localStorage.getItem("isHost") === "true");
    }, [navigate]);

    useEffect(() => {
        if (!roomId) return;

        const fetchHostInfo = async () => {
            try {
                const token = localStorage.getItem("loginToken");
                const res = await fetch(`https://connecthub.dikshant-ahalawat.live/meetings/${roomId}/participants`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();

                if (data.hostUserId) {
                    setHostUserId(data.hostUserId);
                }
            } catch (error) {
                console.error("Failed to fetch host info:", error);
            }
        };

        fetchHostInfo();
    }, [roomId]);

    useEffect(() => {
        if (!localStreamReady) return;
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }

        if (isHost && localStream) {
            const audioTracks = localStream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.warn("No audio tracks found to record.");
                return;
            }

            const audioStream = new MediaStream(audioTracks);
            const options = { mimeType: 'audio/webm' };

            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn(`${options.mimeType} is not supported. Falling back to default.`);
                delete options.mimeType;
            }

            try {
                mediaRecorderRef.current = new MediaRecorder(audioStream, options);

                mediaRecorderRef.current.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorderRef.current.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType || 'audio/webm' });
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'meeting.webm');
                    formData.append('meetingId', roomId);
                    audioChunksRef.current = []; // Clear chunks for next time

                    try {
                        const token = localStorage.getItem("loginToken");
                        toast.info("Uploading audio for report...");
                        
                        fetch(`https://connecthub.dikshant-ahalawat.live/meetings/end`, {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                            body: formData,
                        }).then(async (res) => {
                            if (res.ok) {
                                toast.success("Upload complete. AI is processing...");
                            } else {
                                const errData = await res.json().catch(() => ({ message: "Unknown server error" }));
                                toast.error(`Error: ${errData.message || res.statusText}`);
                            }
                        }).catch((error) => {
                            console.error('Failed to upload audio:', error);
                            toast.error('Could not save meeting report.');
                        });

                        socket?.disconnect();

                        clearMeetingStorage();
                        navigate(`/report/${roomId}`, { replace: true });

                    } catch (error) {
                        console.error('Failed to upload audio:', error);
                        toast.error('Could not save meeting report. Check console for details.');
                    } finally {
                        console.log("Upload fetch process finished.");
                    }
                };

                mediaRecorderRef.current.start();
            } catch (error) {
                console.error("Error starting MediaRecorder:", error);
                toast.error("Could not start recording. Meeting reports will be unavailable.");
            }
        }
    }, [localStreamReady, localStream, isHost, roomId]);

    useEffect(() => {
        if (!socket) return;

        const handlePeerMicState = ({ userId: peerId, isMicOn }) => {
            setPeerMicState((prev) => ({ ...prev, [peerId]: isMicOn }));
        };

        // const handleRoomFull = () => {
        //     toast.error("This room is full (Max 2 people).");
        //     navigate("/home");
        // };

        // const handleUserLeft = (data) => {
        //     const leaverId = (typeof data === 'object' && data !== null) ? data.userId : data;
            
        //     if (leaverId === hostUserId && !isHost) {
        //         toast.info("The host has ended the meeting.");
        //         clearMeetingStorage();
        //         navigate(`/report/${roomId}`, { replace: true });
        //         return;
        //     }

        //     const name = nameMapRef.current[leaverId] || "A participant";
        //     toast.info(`${name} left the meeting`);
        // };

        const handleUserJoined = (data) => {
            if (data.hostUserId) {
                setHostUserId(data.hostUserId);
            }
        };

        // const onUserConnected = () => {
        //     participants.length > 0 && socket.emit('get-participants');
        // };

        const handleMeetingEnded = (data) => {
            if (data && data.meetingId) {
                toast.info("The host has ended the meeting.");
                clearMeetingStorage();
                navigate(`/report/${data.meetingId}`, { replace: true });
            }
        };

        socket.on("peer-mic-state", handlePeerMicState);
        // socket.on("room-full", handleRoomFull);
        // socket.on("user-left", handleUserLeft);
        // socket.on("user-disconnected", handleUserLeft);
        // socket.on("user-connected", onUserConnected);
        socket.on("user-joined", handleUserJoined);
        socket.on("meeting-ended", handleMeetingEnded);

        return () => {
            socket.off("peer-mic-state", handlePeerMicState);
            // socket.off("room-full", handleRoomFull);
            // socket.off("user-left", handleUserLeft);
            // socket.off("user-disconnected", handleUserLeft);
            // socket.off("user-connected", onUserConnected);
            socket.off("user-joined", handleUserJoined);
            socket.off("meeting-ended", handleMeetingEnded);
        };
    }, [socket, navigate, roomId, userId, participants.length]);

    useEffect(() => {
        window.history.pushState(null, document.title, window.location.href);

        const handlePopState = () => {
            window.history.pushState(null, document.title, window.location.href);

            if (chatOpenRef.current) {
                setIsChatOpen(false);
                chatOpenRef.current = false;
                return;
            }

            if (participantsOpenRef.current) {
                setIsParticipantsOpen(false);
                participantsOpenRef.current = false;
                return;
            }

            if (isHost) {
                setShowEndConfirmModal(true);
            } else {
                setShowLeaveConfirmModal(true);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isHost]);

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
        };
        updateTime();
        const timer = setInterval(updateTime, 1000 * 60);
        return () => clearInterval(timer);
    }, []);

    const handleMicToggle = async () => {
        const newState = await toggleMic();
        setIsMicOn(newState);
        socket?.emit("mic-toggle", { isMicOn: newState });
    };

    const handleVideoToggle = () => setIsVideoOn(toggleVideo());

    const copyRoomId = async () => {
        if (!roomId) return;
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success("Room ID copied");
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const clearMeetingStorage = () => {
        localStorage.removeItem("roomId");
        localStorage.removeItem("meetTitle");
        localStorage.removeItem("isHost");
        localStorage.removeItem("livekitUrl");
        localStorage.removeItem("livekitToken");
        window.history.replaceState(null, "", "/home");
    };

    const leaveMeeting = async () => {
        isExitingRef.current = true;
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }

        socket?.disconnect();

        const currentRoomId = roomId;
        const token = localStorage.getItem("loginToken");

        clearMeetingStorage();
        navigate("/home", { replace: true });

        try {
            await fetch(
                `https://connecthub.dikshant-ahalawat.live/meetings/${currentRoomId}/leave`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
        } catch (err) {
            console.error("Error leaving in background:", err);
        }
    };

    const endMeeting = async () => {
        if (!isHost) {
            leaveMeeting();
            return;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
    };

    const handleMobileAction = async (action) => {
        setShowMoreMenu(false);
        if (action === 'info') setShowInfoModal(true);
        if (action === 'chat') setIsChatOpen(true);
        if (action === 'participants') setIsParticipantsOpen(true);
        // if (action === 'screen-share') {
        //     if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        //         toast.error("Your browser does not support screen sharing.");
        //         return;
        //     }
        //     try {
        //         if (isScreenSharing) {
        //             await stopScreenShare();
        //         } else {
        //             await startScreenShare();
        //         }
        //     } catch (err) {
        //         if (err.name === 'NotAllowedError') {
        //             toast.error("Permission denied. You must click 'Start now' on the system popup.");
        //         } else if (err.name === 'NotFoundError') {
        //             toast.error("No screen found to share.");
        //         } else {
        //             toast.error(`Error: ${err.message || "Failed to start"}`);
        //         }
        //     }
        // }
    };

    return (
        <div className="layout">
            <header className="navbar">
                <div className="logo">ConnectHub</div>
            </header>

            <VideoGrid
                localVideoRef={localVideoRef}
                isMicOn={isMicOn}
                userName={userName}
                isHost={isHost}
                remoteStreams={remoteStreams}
                peerMicState={peerMicState}
                participantNameMap={participantNameMap}
                isAlone={isAlone}
            />

            <MeetingToolbar
                isHost={isHost}
                currentTime={currentTime}
                meetTitle={meetTitle}
                isMicOn={isMicOn}
                handleMicToggle={handleMicToggle}
                localStreamReady={localStreamReady}
                isVideoOn={isVideoOn}
                handleVideoToggle={handleVideoToggle}
                // isScreenSharing={isScreenSharing}
                // onScreenShareClick={isScreenSharing ? stopScreenShare : startScreenShare}
                onEndClick={() => isHost ? setShowEndConfirmModal(true) : setShowLeaveConfirmModal(true)}
                onInfoClick={() => setShowInfoModal(true)}
                onChatClick={() => setIsChatOpen(true)}
                onParticipantsClick={() => setIsParticipantsOpen(true)}
                showMoreMenu={showMoreMenu}
                setShowMoreMenu={setShowMoreMenu}
                handleMobileAction={handleMobileAction}
            />

            <ChatPanel
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                socket={socket}
                roomId={roomId}
                userId={userId}
                userName={userName}
            />

            <ParticipantsPanel
                isOpen={isParticipantsOpen}
                onClose={() => setIsParticipantsOpen(false)}
                participants={participants}
                currentUserId={userId}
                hostUserId={hostUserId}
                isLocalUserHost={isHost}
            />

            {showInfoModal && (
                <InfoModal
                    meetTitle={meetTitle}
                    roomId={roomId}
                    copyRoomId={copyRoomId}
                    onClose={() => setShowInfoModal(false)}
                />
            )}

            {showEndConfirmModal && (
                <ConfirmationModal
                    title="End Meeting"
                    message="End the meeting for everyone?"
                    onConfirm={endMeeting}
                    onCancel={() => setShowEndConfirmModal(false)}
                />
            )}

            {showLeaveConfirmModal && (
                <ConfirmationModal
                    title="Leave Meeting"
                    message="Are you sure you want to leave?"
                    onConfirm={leaveMeeting}
                    onCancel={() => setShowLeaveConfirmModal(false)}
                />
            )}
        </div>
    );
}
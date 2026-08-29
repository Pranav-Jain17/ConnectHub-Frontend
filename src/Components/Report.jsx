import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useSocket } from "../Providers/Socket";
import "./Styles/report.css";

export default function Report() {
    const { meetingId } = useParams();
    const { socket } = useSocket();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (socket && !socket.connected) {
            socket.connect();
        }
        
        if (socket && meetingId) {
            console.log(`Joining report notification room: ${meetingId}`);
            socket.emit("join-room", meetingId, localStorage.getItem("userId"), localStorage.getItem("userName"));
        }
    }, [socket, meetingId]);

    const fetchReport = useCallback(async (isSilent = false) => {
        try {
            if (!isSilent) setLoading(true);
            setError(null);
            
            const token = localStorage.getItem("loginToken");
            if (!token) {
                throw new Error("Authentication token not found.");
            }

            const res = await fetch(`https://connecthub.dikshant-ahalawat.live/meetings/${meetingId}/report`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Failed to fetch report.");
            }

            const data = await res.json();
            console.log("Current report status:", data.reportStatus);
            setReport(data);
        } catch (err) {
            console.error("Fetch report error:", err);
            setError(err.message);
            if (!isSilent) toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }, [meetingId]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    // Layer 1: Socket Listener (Instant)
    useEffect(() => {
        if (!socket) return;

        const handleReportReady = (data) => {
            console.log("Socket event 'report-ready' received:", data);
            // Check both meetingId (long ID) and roomId (short code) to match URL parameter
            if (data.meetingId === meetingId || data.roomId === meetingId) {
                toast.success("AI report is ready!");
                fetchReport(true); 
            }
        };

        socket.on("report-ready", handleReportReady);

        return () => {
            socket.off("report-ready", handleReportReady);
        };
    }, [socket, meetingId, fetchReport]);

    // Layer 2: Polling Fallback (Every 5 seconds if still processing or in initial 'none' state)
    useEffect(() => {
        let intervalId;

        // Start polling if the report is in 'none' or 'processing' status
        if (report && (report.reportStatus === 'processing' || report.reportStatus === 'none')) {
            console.log("Starting polling for report completion...");
            intervalId = setInterval(() => {
                fetchReport(true);
            }, 5000);
        }

        return () => {
            if (intervalId) {
                console.log("Stopping polling.");
                clearInterval(intervalId);
            }
        };
    }, [report, fetchReport]);

    if (loading) {
        return <div className="report-container">Loading report...</div>;
    }

    if (error) {
        return <div className="report-container">Error: {error}</div>;
    }

    if (!report) {
        return <div className="report-container">No report found.</div>;
    }

    if (report.reportStatus === 'failed') {
        return (
            <div className="report-layout">
                <header className="navbar">
                    <Link to="/home" className="logo">ConnectHub</Link>
                </header>
                <div className="report-container processing-state">
                    <div className="report-card">
                        <h2 style={{ color: '#dc3545' }}>Report Generation Failed</h2>
                        <p>We encountered an error while processing your meeting transcript.</p>
                        <p>Please try re-generating or contact support if the issue persists.</p>
                        <Link to="/home" className="btn-view-report" style={{ display: 'inline-block', width: 'auto', marginTop: '1rem' }}>Back to Home</Link>
                    </div>
                </div>
            </div>
        );
    }

    if (report.reportStatus === 'processing' || !report.report) {
        return (
            <div className="report-layout">
                <header className="navbar">
                    <Link to="/home" className="logo">ConnectHub</Link>
                </header>
                <div className="report-container processing-state">
                    <div className="report-card">
                        <h2>AI is analyzing your meeting...</h2>
                        <p>AI is still processing your meeting transcript to generate a summary, key topics, and action items.</p>
                        <p><strong>This usually takes about a minute. The report will appear here automatically when ready.</strong></p>
                        <div className="loading-spinner-container">
                             <div className="loading-spinner"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const handleDownloadPDF = async () => {
        try {
            const token = localStorage.getItem("loginToken");
            const res = await fetch(`https://connecthub.dikshant-ahalawat.live/meetings/${meetingId}/report/download`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || "Failed to download PDF.");
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Meeting_Report_${meetingId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error("Download error:", err);
            toast.error(err.message);
        }
    };

    return (
        <div className="report-layout">
            <header className="navbar">
                <Link to="/home" className="logo">ConnectHub</Link>
            </header>
            <div className="report-container">
                <div className="report-header">
                    <h1>Meeting Report</h1>
                    <button
                        onClick={handleDownloadPDF}
                        className="btn-download"
                        style={{ border: 'none', cursor: 'pointer' }}
                    >
                        Download PDF
                    </button>
                </div>
                <div className="report-card">
                    <h2>{report.title || "Meeting"}</h2>
                    <div className="report-section">
                        <h3>Summary</h3>
                        <p>{report.report?.summary || "No summary available."}</p>
                    </div>
                    <div className="report-section">
                        <h3>Key Topics</h3>
                        <ul>
                            {report.report?.key_topics?.map((topic, index) => (
                                <li key={index}>{topic}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="report-section">
                        <h3>Action Items</h3>
                        <ul>
                            {report.report?.action_items?.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="report-section">
                        <h3>Full Transcript</h3>
                        <div className="transcript">
                            <p>{report.transcript || "No transcript available."}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

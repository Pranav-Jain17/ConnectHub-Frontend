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
    }, [socket]);

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
            console.log("Report data fetched:", data.reportStatus);
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

    useEffect(() => {
        if (!socket) return;

        const handleReportReady = (data) => {
            console.log("Socket event 'report-ready' received:", data);
            if (data.meetingId === meetingId) {
                toast.success("AI report is ready!");
                fetchReport(true); // Silent fetch to update data
            }
        };

        socket.on("report-ready", handleReportReady);

        return () => {
            socket.off("report-ready", handleReportReady);
        };
    }, [socket, meetingId, fetchReport]);

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

    const downloadUrl = `https://connecthub.dikshant-ahalawat.live/meetings/${meetingId}/report/download?token=${localStorage.getItem("loginToken")}`;

    return (
        <div className="report-layout">
            <header className="navbar">
                <Link to="/home" className="logo">ConnectHub</Link>
            </header>
            <div className="report-container">
                <div className="report-header">
                    <h1>Meeting Report</h1>
                    <a
                        href={downloadUrl}
                        className="btn-download"
                        target="_blank" 
                        rel="noopener noreferrer"
                    >
                        Download PDF
                    </a>
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

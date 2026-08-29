import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import "./Styles/report.css";

export default function Report() {
    const { meetingId } = useParams();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchReport = async () => {
            try {
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
                setReport(data);
            } catch (err) {
                setError(err.message);
                toast.error(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [meetingId]);

    if (loading) {
        return <div className="report-container">Loading report...</div>;
    }

    if (error) {
        return <div className="report-container">Error: {error}</div>;
    }

    if (!report) {
        return <div className="report-container">No report found.</div>;
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
                        <p>{report.report.summary || "No summary available."}</p>
                    </div>
                    <div className="report-section">
                        <h3>Key Topics</h3>
                        <ul>
                            {report.report.key_topics?.map((topic, index) => (
                                <li key={index}>{topic}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="report-section">
                        <h3>Action Items</h3>
                        <ul>
                            {report.report.action_items?.map((item, index) => (
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

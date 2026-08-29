import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from "react-toastify";
import "./Styles/login.css";

function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!token) {
        return (
            <div className="login-page">
                <div className="login-container" style={{ justifyContent: 'center' }}>
                    <div className="login-form-side" style={{ width: '100%', maxWidth: '400px' }}>
                        <h2 style={{ color: 'red' }}>Invalid Link</h2>
                        <p>This password reset link is missing a valid token.</p>
                        <button className="btn-login" onClick={() => navigate('/login')}>
                            Return to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast.error("Passwords do not match!");
            return;
        }
        setIsSubmitting(true);

        try {
            const response = await fetch('https://connecthub.dikshant-ahalawat.live/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: token,
                    newPassword: password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to reset password');
            }
            toast.success("Password reset successful! Please login.");
            navigate('/login');

        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container" style={{ justifyContent: 'center' }}>
                <div className="login-form-side" style={{ width: '100%', maxWidth: '450px' }}>
                    <h2>Set New Password</h2>
                    <p style={{ marginBottom: '20px', color: '#666' }}>
                        Please create a new password for your account.
                    </p>

                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>New Password</label>
                            <input
                                type="password"
                                placeholder="Enter new password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>

                        <div className="form-group">
                            <label>Confirm Password</label>
                            <input
                                type="password"
                                placeholder="Confirm new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-login"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Resetting..." : "Reset Password"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default ResetPassword;
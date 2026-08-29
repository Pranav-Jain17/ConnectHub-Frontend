import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import "./signup.css";

function Signup() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        try {
            const response = await fetch('https://connecthub.dikshant-ahalawat.live/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || `Status: ${response.status}`);
            }

            const data = await response.json();
            toast.success('User created successfully');
            setTimeout(() => {
                navigate('/login');
            }, 1500);

        } catch (err) {
            setError(err.message || 'Signup failed');
            toast.error(`Error: ${err.message || 'Signup failed'}`);
        }
    };

    return (
        <div className="signup-page">
            <div className="signup-container">
                <div className="signup-image-side">
                    <img src="/assets/signup.png" alt="Join us" />
                </div>
                <div className="signup-form-side">
                    <h2>Create Account</h2>
                    {error && <div className="error-message">{error}</div>}
                    <form className="signup-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Username</label>
                            <input
                                type="text"
                                placeholder="Enter your Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                placeholder="Enter your Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="password-input-wrapper">
                            <label>Password</label>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                className="password-toggle-icon"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex="-1"
                            >
                                {showPassword ? (
                                    <img src="./assets/svg/showPswd.svg" alt="Show" />
                                ) : (
                                    <img src="./assets/svg/hidePswd.svg" alt="Hide" />
                                )}
                            </button>
                        </div>
                        <button type="submit" className="btn-signup">Sign Up</button>
                    </form>
                    <div className="login-link">
                        Already have an account? <a href="/">Log In</a>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Signup;
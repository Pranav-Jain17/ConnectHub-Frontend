import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "./login.css";

function Login() {
    const [identifier, setIdentifier] = useState('');
    const [useEmail, setUseEmail] = useState(true);
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const body = { password };

        if (useEmail) {
            body.email = identifier;
        } else {
            body.username = identifier;
        }

        try {
            const response = await fetch('https://connecthub-2.onrender.com/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`Status: ${response.status}`);
            }

            const data = await response.json();
            const loginToken = data.token;

            if (!rememberMe) {
                sessionStorage.setItem('loginToken', loginToken);
            }
            localStorage.setItem('loginToken', loginToken);
            navigate('/home');
        } catch (err) {
            setError('! Enter a valid email/username or password');
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-image-side">
                    <img src="public/assets/signup.png" alt="Welcome back" />
                </div>
                <div className="login-form-side">
                    <h2>Hello,<br />Welcome Back</h2>
                    {error && <div className="error-message">{error}</div>}
                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="form-options toggle-login-type">
                            <label>
                                <input
                                    type="radio"
                                    name="loginType"
                                    value="email"
                                    checked={useEmail}
                                    onChange={() => setUseEmail(true)}
                                    autoComplete='username'
                                />
                                Login with Email
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="loginType"
                                    value="username"
                                    checked={!useEmail}
                                    onChange={() => setUseEmail(false)}
                                    autoComplete="username"
                                />
                                Login with Username
                            </label>
                        </div>
                        <div className="form-group">
                            <label>{useEmail ? "Email" : "Username"}</label>
                            <input
                                type="text"
                                placeholder={useEmail ? "Enter your Email" : "Enter your Username"}
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                                autoComplete={useEmail ? "email" : "username"}
                            />
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                placeholder="Enter your Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                        </div>
                        <div className="remember-options">
                            <label className="remember-me">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                Remember Me
                            </label>
                            <a className="forgot-password" href="/forgot-password">Forgot Password?</a>
                        </div>
                        <button type="submit" className="btn-login">Login</button>
                    </form>
                    <div className="register-link">
                        Don’t Have An Account? <a href="/signup">Click Here</a>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;

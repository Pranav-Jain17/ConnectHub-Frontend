import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import "./Styles/login.css";
import { toast } from "react-toastify";

function Login() {
    const [identifier, setIdentifier] = useState('');
    const [useEmail, setUseEmail] = useState(true);
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const passwordRef = useRef(null);
    const cursorPosRef = useRef(null);
    const [isResetMode, setIsResetMode] = useState(false);
    const [resetEmail, setResetEmail] = useState('');

    const handleTogglePassword = () => {
        const input = passwordRef.current;
        if (input) {
            cursorPosRef.current = input.selectionStart;
        }
        setShowPassword(prev => !prev);
    };

    useLayoutEffect(() => {
        const input = passwordRef.current;
        if (input && cursorPosRef.current !== null) {
            input.setSelectionRange(cursorPosRef.current, cursorPosRef.current);
            input.focus();
        }
    }, [showPassword]);

    useEffect(() => {
        const token = localStorage.getItem('loginToken');
        if (token) {
            navigate('/home', { replace: true });
        }
    }, [navigate]);

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
            const response = await fetch('https://connecthub.dikshant-ahalawat.live/auth/login', {
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
            localStorage.setItem('userId', data.userId);
            localStorage.setItem('userName', data.username);
            localStorage.setItem('userEmail', data.email);
            toast.success("Logged in successfully!");
            navigate('/home', { replace: true });
        } catch (err) {
            setError('! Enter a valid email/username or password');
        }
    };

    // Forgot password handler and resetting it via request on email
    const handleResetRequest = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('https://connecthub.dikshant-ahalawat.live/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail })
            });
            if (response.ok) {
                toast.success("If that email exists, we've sent a reset link!");
                setIsResetMode(false);
                setResetEmail('');
            } else {
                toast.error("Something went wrong. Please try again.");
            }
        } catch (err) {
            toast.error("Unable to send request. Check your connection.");
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-image-side">
                    <img src="/assets/signup.png" alt="Welcome back" />
                </div>
                <div className="login-form-side">
                    <h2>Hello,<br />{isResetMode ? "Reset Password" : "Welcome Back"}</h2>

                    {error && !isResetMode && <div className="error-message">{error}</div>}

                    {isResetMode ? (
                        <form className="login-form" onSubmit={handleResetRequest}>
                            <p style={{ marginBottom: '20px', color: '#666' }}>
                                Enter your email address and we'll send you a link to reset your password.
                            </p>
                            <div className="form-group">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    placeholder="Enter your registered email"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>

                            <button type="submit" className="btn-login">Send Reset Link</button>

                            <div className="register-link">
                                <span
                                    onClick={() => setIsResetMode(false)}
                                    style={{ cursor: 'pointer', color: '#007bff', textDecoration: 'underline' }}
                                >
                                    Back to Login
                                </span>
                            </div>
                        </form>
                    ) : (
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
                                <div className="password-input-wrapper">
                                    <input
                                        ref={passwordRef}
                                        type={showPassword ? "text" : "password"}
                                        className={showPassword ? "unmasked-password" : "masked-password"}
                                        placeholder="Enter your Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle-icon"
                                        onClick={handleTogglePassword}
                                        tabIndex="-1"
                                    >
                                        {showPassword ? (
                                            <img src="./assets/svg/showPswd.svg" alt="Show Password" />
                                        ) : (
                                            <img src="./assets/svg/hidePswd.svg" alt="Hide Password" />
                                        )}
                                    </button>
                                </div>
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

                                <span
                                    className="forgot-password"
                                    onClick={() => setIsResetMode(true)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    Forgot Password?
                                </span>
                            </div>

                            <button type="submit" className="btn-login">Login</button>
                        </form>
                    )}

                    {!isResetMode && (
                        <div className="register-link">
                            Don’t Have An Account? <a href="/signup">Click Here</a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Login;

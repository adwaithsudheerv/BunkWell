import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Lock, KeyRound, ArrowLeft, CheckCircle2, ShieldCheck, Mail } from 'lucide-react';

export default function LoginPage() {
  const { login, loginWithGoogle, sendOTP, resetPasswordWithOTP } = useAuth();
  const navigate = useNavigate();

  // Mode: 'login' | 'forgot_send' | 'forgot_verify'
  const [view, setView] = useState('login');

  // Login form
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot password OTP flow
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [devCode, setDevCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  // Google Login modal
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const isLoginValid = identifier.trim().length > 0 && password.length >= 6;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;

    setLoading(true);
    try {
      await login(identifier, password);
      toast.success('Welcome back to Bunkwell! 🎓');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Sorry, your password was incorrect.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!resetIdentifier.trim()) {
      toast.error('Enter your email or username');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await sendOTP(resetIdentifier.trim());
      setMaskedEmail(res.maskedEmail || res.email);
      if (res.code) {
        setDevCode(res.code);
        toast.success(`Security code sent! (Dev Code: ${res.code})`, { duration: 6000 });
      } else {
        toast.success(res.message || 'Security code sent to your email!');
      }
      setView('forgot_verify');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not find account. Check info and try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResetWithOTP = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      toast.error('Please enter the 6-digit verification code');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setOtpLoading(true);
    try {
      await resetPasswordWithOTP(resetIdentifier.trim(), otp.trim(), newPassword);
      toast.success('Password changed successfully! Logged in. 🎉');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid verification code. Try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleGoogleSubmit = async (e) => {
    e.preventDefault();
    if (!googleEmail.trim()) {
      toast.error('Please enter your Gmail address');
      return;
    }

    setGoogleLoading(true);
    try {
      await loginWithGoogle({
        email: googleEmail.trim().toLowerCase(),
        name: googleName.trim() || googleEmail.split('@')[0],
        googleId: 'g_' + btoa(googleEmail).replace(/=/g, '').slice(0, 16)
      });
      toast.success('Signed in with Google! 🚀');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
      setShowGoogleModal(false);
    }
  };

  return (
    <div className="ig-auth-container">
      <div className="ig-auth-wrapper">
        {/* Main Auth Box */}
        <div className="ig-card">
          {/* Logo / Header */}
          <div className="ig-brand-header">
            <h1 className="ig-logo-text">Bunkwell</h1>
            <p className="ig-tagline">Smart Student Attendance System</p>
          </div>

          {/* VIEW 1: NORMAL INSTAGRAM LOGIN */}
          {view === 'login' && (
            <>
              <form onSubmit={handleLogin} className="ig-form">
                {/* Identifier input */}
                <div className="ig-input-group">
                  <input
                    type="text"
                    id="login-id"
                    placeholder=" "
                    className="ig-input"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                    autoComplete="username"
                  />
                  <label htmlFor="login-id" className="ig-floating-label">
                    Phone number, username, or email
                  </label>
                </div>

                {/* Password input */}
                <div className="ig-input-group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="login-pass"
                    placeholder=" "
                    className="ig-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <label htmlFor="login-pass" className="ig-floating-label">
                    Password
                  </label>
                  {password.length > 0 && (
                    <button
                      type="button"
                      className="ig-show-btn"
                      onClick={() => setShowPassword(p => !p)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  )}
                </div>

                {/* Log In Button */}
                <button
                  type="submit"
                  className={`ig-primary-btn ${!isLoginValid ? 'ig-btn-disabled' : ''}`}
                  disabled={!isLoginValid || loading}
                >
                  {loading ? 'Logging in…' : 'Log In'}
                </button>
              </form>

              {/* OR Divider */}
              <div className="ig-divider">
                <div className="ig-divider-line"></div>
                <span className="ig-divider-text">OR</span>
                <div className="ig-divider-line"></div>
              </div>

              {/* Log In with Google */}
              <button
                type="button"
                className="ig-alt-login-btn"
                onClick={() => setShowGoogleModal(true)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Log in with Google / Gmail</span>
              </button>

              {/* Forgot password */}
              <div className="ig-forgot-wrap">
                <button
                  type="button"
                  className="ig-forgot-link"
                  onClick={() => {
                    setResetIdentifier(identifier);
                    setView('forgot_send');
                  }}
                >
                  Forgot password?
                </button>
              </div>
            </>
          )}

          {/* VIEW 2: INSTAGRAM "TROUBLE LOGGING IN?" SEND OTP */}
          {view === 'forgot_send' && (
            <div className="ig-forgot-card">
              <div className="ig-lock-icon-circle">
                <Lock size={32} />
              </div>
              <h2 className="ig-forgot-title">Trouble logging in?</h2>
              <p className="ig-forgot-desc">
                Enter your email or username and we'll send you a 6-digit security code to reset your password.
              </p>

              <form onSubmit={handleSendOTP} className="ig-form">
                <div className="ig-input-group">
                  <input
                    type="text"
                    id="reset-id"
                    placeholder=" "
                    className="ig-input"
                    value={resetIdentifier}
                    onChange={e => setResetIdentifier(e.target.value)}
                    required
                    autoFocus
                  />
                  <label htmlFor="reset-id" className="ig-floating-label">
                    Email or Username
                  </label>
                </div>

                <button
                  type="submit"
                  className="ig-primary-btn"
                  disabled={!resetIdentifier.trim() || otpLoading}
                >
                  {otpLoading ? 'Sending Security Code…' : 'Send Security Code'}
                </button>
              </form>

              <div className="ig-divider">
                <div className="ig-divider-line"></div>
                <span className="ig-divider-text">OR</span>
                <div className="ig-divider-line"></div>
              </div>

              <Link to="/register" className="ig-create-account-link">
                Create new account
              </Link>

              <div className="ig-back-to-login-box">
                <button
                  type="button"
                  className="ig-back-login-btn"
                  onClick={() => setView('login')}
                >
                  Back to login
                </button>
              </div>
            </div>
          )}

          {/* VIEW 3: VERIFY 6-DIGIT OTP AND CHANGE PASSWORD */}
          {view === 'forgot_verify' && (
            <div className="ig-forgot-card">
              <div className="ig-lock-icon-circle" style={{ borderColor: '#10b981', color: '#10b981' }}>
                <KeyRound size={32} />
              </div>
              <h2 className="ig-forgot-title">Enter Security Code</h2>
              <p className="ig-forgot-desc">
                Enter the 6-digit code sent to <strong style={{ color: '#fff' }}>{maskedEmail}</strong>.
              </p>

              {devCode && (
                <div className="ig-code-pill">
                  🔑 Code: <strong>{devCode}</strong>
                </div>
              )}

              <form onSubmit={handleResetWithOTP} className="ig-form">
                <div className="ig-input-group">
                  <input
                    type="text"
                    id="reset-otp"
                    placeholder=" "
                    className="ig-input"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    autoFocus
                    style={{ letterSpacing: '6px', textAlign: 'center', fontSize: '18px', fontWeight: 700 }}
                  />
                  <label htmlFor="reset-otp" className="ig-floating-label" style={{ textAlign: 'center', width: '100%' }}>
                    ######
                  </label>
                </div>

                <div className="ig-input-group">
                  <input
                    type="password"
                    id="new-pass"
                    placeholder=" "
                    className="ig-input"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <label htmlFor="new-pass" className="ig-floating-label">
                    New Password (min 6 characters)
                  </label>
                </div>

                <button
                  type="submit"
                  className="ig-primary-btn"
                  disabled={otp.length < 6 || newPassword.length < 6 || otpLoading}
                >
                  {otpLoading ? 'Verifying & Resetting…' : 'Reset Password & Log In'}
                </button>
              </form>

              <div className="ig-resend-wrap">
                <button
                  type="button"
                  className="ig-resend-link"
                  onClick={handleSendOTP}
                  disabled={otpLoading}
                >
                  Didn't get a code? Request new code
                </button>
              </div>

              <div className="ig-back-to-login-box">
                <button
                  type="button"
                  className="ig-back-login-btn"
                  onClick={() => setView('login')}
                >
                  Back to login
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Secondary Box: "Don't have an account? Sign up" */}
        {view === 'login' && (
          <div className="ig-secondary-card">
            <p className="ig-secondary-text">
              Don't have an account?{' '}
              <Link to="/register" className="ig-link-bold">
                Sign up
              </Link>
            </p>
          </div>
        )}

        {/* App Links & Footer */}
        <div className="ig-footer">
          <div className="ig-footer-links">
            <span>About</span>
            <span>Help</span>
            <span>API</span>
            <span>Privacy</span>
            <span>Terms</span>
            <span>Security</span>
            <span>Bunkwell Pro</span>
          </div>
          <div className="ig-footer-copy">
            &copy; {new Date().getFullYear()} BUNKWELL FROM STUDENT NETWORK
          </div>
        </div>
      </div>

      {/* Google Login Modal */}
      {showGoogleModal && (
        <div className="ig-modal-overlay">
          <div className="ig-modal-box">
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" style={{ margin: '0 auto 8px' }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <h3 style={{ fontSize: 17, color: '#fff', margin: 0 }}>Sign in with Google</h3>
              <p style={{ fontSize: 12, color: '#8e8e8e', marginTop: 4 }}>
                Enter your Gmail address to access your Bunkwell account
              </p>
            </div>

            <form onSubmit={handleGoogleSubmit} className="ig-form">
              <div className="ig-input-group">
                <input
                  type="email"
                  id="google-email"
                  placeholder=" "
                  className="ig-input"
                  value={googleEmail}
                  onChange={e => setGoogleEmail(e.target.value)}
                  required
                  autoFocus
                />
                <label htmlFor="google-email" className="ig-floating-label">
                  Gmail Address
                </label>
              </div>

              <div className="ig-input-group">
                <input
                  type="text"
                  id="google-name"
                  placeholder=" "
                  className="ig-input"
                  value={googleName}
                  onChange={e => setGoogleName(e.target.value)}
                />
                <label htmlFor="google-name" className="ig-floating-label">
                  Full Name (Optional)
                </label>
              </div>

              <button
                type="submit"
                className="ig-primary-btn"
                disabled={googleLoading || !googleEmail.trim()}
              >
                {googleLoading ? 'Connecting…' : 'Continue'}
              </button>

              <button
                type="button"
                className="ig-cancel-btn"
                onClick={() => setShowGoogleModal(false)}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

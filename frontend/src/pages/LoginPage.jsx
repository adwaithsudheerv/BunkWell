import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Lock, KeyRound, ArrowLeft, CheckCircle2, ShieldCheck, Mail, UserCheck } from 'lucide-react';

export default function LoginPage() {
  const { login, sendOTP, verifyOTP, resetPasswordWithOTP } = useAuth();
  const navigate = useNavigate();

  // Mode: 'login' | 'forgot_send' | 'forgot_verify'
  const [view, setView] = useState('login');

  // Login form
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot credentials / OTP recovery flow
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [recoveredUsername, setRecoveredUsername] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [devCode, setDevCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const isLoginValid = identifier.trim().length > 0 && password.length >= 6;

  // 1. Direct Login
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;

    setLoading(true);
    try {
      await login(identifier.trim(), password);
      toast.success('Welcome back to Bunkwell! 🎓');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Sorry, your password or User ID was incorrect.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // 2. Request OTP via Email
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) {
      toast.error('Enter your registered Email ID or User ID');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await sendOTP(recoveryEmail.trim());
      setMaskedEmail(res.maskedEmail || res.email);
      if (res.code) {
        setDevCode(res.code);
        toast.success(`Security code sent! (Dev Code: ${res.code})`, { duration: 6000 });
      } else {
        toast.success(res.message || '6-digit security code sent to your registered email!');
      }
      setView('forgot_verify');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not find account. Check info and try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  // 3. Reset Password & Retrieve User ID with OTP
  const handleResetWithOTP = async (e) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length < 6) {
      toast.error('Please enter the 6-digit security code');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await resetPasswordWithOTP(recoveryEmail.trim(), otp.trim(), newPassword);
      toast.success(res.message || 'Password changed successfully! Logged in. 🎉');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired code. Please request a new one.');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="ig-auth-container">
      <div className="ig-auth-wrapper">
        {/* Main Auth Card */}
        <div className="ig-card">
          {/* Logo / Header */}
          <div className="ig-brand-header">
            <h1 className="ig-logo-text">Bunkwell</h1>
            <p className="ig-tagline">Smart Student Attendance System</p>
          </div>

          {/* VIEW 1: USER ID & PASSWORD LOGIN */}
          {view === 'login' && (
            <>
              <form onSubmit={handleLogin} className="ig-form">
                {/* User ID / Username */}
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
                    User ID, Username, or Email
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

              {/* Forgot User ID or Password Link */}
              <div className="ig-forgot-wrap" style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #262626' }}>
                <button
                  type="button"
                  className="ig-forgot-link"
                  onClick={() => {
                    setRecoveryEmail(identifier);
                    setView('forgot_send');
                  }}
                >
                  Forgot User ID or Password?
                </button>
              </div>
            </>
          )}

          {/* VIEW 2: RECOVER ACCOUNT VIA REGISTERED EMAIL OTP */}
          {view === 'forgot_send' && (
            <div className="ig-forgot-card">
              <div className="ig-lock-icon-circle">
                <Lock size={32} />
              </div>
              <h2 className="ig-forgot-title">Forgot User ID or Password?</h2>
              <p className="ig-forgot-desc">
                Enter your registered Email ID. We'll send you a secure 6-digit verification code to recover your User ID and set a new password.
              </p>

              <form onSubmit={handleSendOTP} className="ig-form">
                <div className="ig-input-group">
                  <input
                    type="text"
                    id="recovery-id"
                    placeholder=" "
                    className="ig-input"
                    value={recoveryEmail}
                    onChange={e => setRecoveryEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  <label htmlFor="recovery-id" className="ig-floating-label">
                    Registered Email ID or User ID
                  </label>
                </div>

                <button
                  type="submit"
                  className="ig-primary-btn"
                  disabled={!recoveryEmail.trim() || otpLoading}
                >
                  {otpLoading ? 'Sending Security Code…' : 'Send 6-Digit Code'}
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

          {/* VIEW 3: VERIFY OTP & RESET PASSWORD */}
          {view === 'forgot_verify' && (
            <div className="ig-forgot-card">
              <div className="ig-lock-icon-circle" style={{ borderColor: '#10b981', color: '#10b981' }}>
                <KeyRound size={32} />
              </div>
              <h2 className="ig-forgot-title">Enter Security Code</h2>
              <p className="ig-forgot-desc">
                Enter the 6-digit code sent to <strong style={{ color: '#fff' }}>{maskedEmail}</strong> to verify ownership of your account.
              </p>

              {devCode && (
                <div className="ig-code-pill">
                  🔑 Verification Code: <strong>{devCode}</strong>
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
                    style={{ letterSpacing: '6px', textAlign: 'center', fontSize: '20px', fontWeight: 700 }}
                  />
                  <label htmlFor="reset-otp" className="ig-floating-label" style={{ textAlign: 'center', width: '100%' }}>
                    ######
                  </label>
                </div>

                <div className="ig-input-group">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
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
                  {newPassword.length > 0 && (
                    <button
                      type="button"
                      className="ig-show-btn"
                      onClick={() => setShowNewPassword(p => !p)}
                    >
                      {showNewPassword ? 'Hide' : 'Show'}
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  className="ig-primary-btn"
                  disabled={otp.length < 6 || newPassword.length < 6 || otpLoading}
                >
                  {otpLoading ? 'Verifying & Saving…' : 'Save New Password & Log In'}
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

        {/* Security & Verification Notice */}
        <div style={{ textAlign: 'center', margin: '14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#8e8e8e', fontSize: 12 }}>
          <ShieldCheck size={14} style={{ color: '#10b981' }} />
          <span>Protected with Bcrypt Hashing & Email OTP Recovery</span>
        </div>

        {/* App Links & Footer */}
        <div className="ig-footer">
          <div className="ig-footer-links">
            <span>About</span>
            <span>Help</span>
            <span>Security</span>
            <span>Privacy</span>
            <span>Terms</span>
            <span>Bunkwell Pro</span>
          </div>
          <div className="ig-footer-copy">
            &copy; {new Date().getFullYear()} BUNKWELL FROM STUDENT NETWORK
          </div>
        </div>
      </div>
    </div>
  );
}
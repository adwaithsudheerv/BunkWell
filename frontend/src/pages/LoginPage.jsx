import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { User, Lock, Eye, EyeOff, GraduationCap, Sparkles, KeyRound, X, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const { login, loginWithGoogle, forgotPassword } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotData, setForgotData] = useState({ identifier: '', newPassword: '' });
  const [forgotLoading, setForgotLoading] = useState(false);

  // Google Login modal (Prompt for Gmail)
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.identifier.trim()) {
      toast.error('Please enter your Username or Email address');
      return;
    }
    if (!form.password) {
      toast.error('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await login(form.identifier, form.password);
      toast.success('Welcome back! 🎓');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
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
      const msg = err.response?.data?.message || err.message || 'Google sign-in failed';
      toast.error(msg);
    } finally {
      setGoogleLoading(false);
      setShowGoogleModal(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotData.identifier.trim()) {
      toast.error('Please enter your Username or Email');
      return;
    }
    if (!forgotData.newPassword || forgotData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setForgotLoading(true);
    try {
      await forgotPassword(forgotData.identifier.trim(), forgotData.newPassword);
      toast.success('Password reset successfully! 🔑');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Password reset failed';
      toast.error(msg);
    } finally {
      setForgotLoading(false);
      setShowForgotModal(false);
    }
  };

  return (
    <section className="form-main">
      <div className="form-content" style={{ maxWidth: '480px' }}>
        <div className="circle-1"></div>
        <div className="circle-2"></div>
        <div className="circle-3"></div>

        <div className="box" style={{ padding: '38px 36px 32px' }}>
          <div className="brand-icon-wrap" style={{ marginBottom: 12 }}>
            <div className="brand-icon" style={{ width: 48, height: 48, borderRadius: 14 }}>
              <GraduationCap size={24} />
            </div>
          </div>

          <h3 style={{ fontSize: 26, marginBottom: 4 }}>Welcome Back</h3>
          <p className="sub-text" style={{ marginBottom: 20 }}>
            Sign in to track your attendance & smart bunks
          </p>

          {/* Quick Google Sign In Button */}
          <button
            type="button"
            onClick={() => setShowGoogleModal(true)}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 30,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: 'pointer',
              marginBottom: 18,
              transition: 'background 0.2s, border-color 0.2s',
            }}
          >
            {/* Google SVG Icon */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Continue with Google / Gmail
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Or with credentials
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          </div>

          <form onSubmit={handleSubmit}>
            {/* Username / Email field */}
            <div className="input-box" style={{ marginBottom: 18 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <User size={13} className="text-amber-400" /> Username, Email ID or Student Roll No
              </label>
              <input
                type="text"
                placeholder="e.g. adwaith24 or your@email.com"
                className="input-control"
                value={form.identifier}
                onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
                required
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div className="input-box" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Lock size={13} className="text-amber-400" /> Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: 11, cursor: 'pointer', padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Enter your password"
                className="input-control"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="pass-toggle-btn"
                onClick={() => setShowPass(p => !p)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button type="submit" className="btn-auth" disabled={loading} style={{ marginTop: 22 }}>
              {loading ? (
                <>
                  <span style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                  Signing In…
                </>
              ) : 'Sign In'}
            </button>
          </form>

          <p style={{ marginTop: 22 }}>
            Don't have an account yet?{' '}
            <Link to="/register" className="gradient-text">
              Create Account
            </Link>
          </p>
        </div>
      </div>

      {/* Google Login Modal */}
      {showGoogleModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="box animate-in" style={{ width: '100%', maxWidth: '420px', padding: '28px 28px 24px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <h4 style={{ color: '#fff', fontSize: 17, margin: 0 }}>Login with Google</h4>
              </div>
              <button onClick={() => setShowGoogleModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 18 }}>
              Enter your Gmail ID to log in or instantly recover access to your Bunkwell account:
            </p>
            <form onSubmit={handleGoogleSubmit}>
              <div className="input-box" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Gmail Address</label>
                <input
                  type="email"
                  placeholder="yourname@gmail.com"
                  className="input-control"
                  value={googleEmail}
                  onChange={e => setGoogleEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="input-box" style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Your Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Adwaith Sudheer"
                  className="input-control"
                  value={googleName}
                  onChange={e => setGoogleName(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-auth" disabled={googleLoading} style={{ marginTop: 0 }}>
                {googleLoading ? 'Signing in…' : 'Continue to Dashboard'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="box animate-in" style={{ width: '100%', maxWidth: '420px', padding: '28px 28px 24px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={20} className="text-amber-400" />
                <h4 style={{ color: '#fff', fontSize: 17, margin: 0 }}>Reset Password</h4>
              </div>
              <button onClick={() => setShowForgotModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 18 }}>
              Enter your Username or Email address and choose a new password:
            </p>
            <form onSubmit={handleForgotSubmit}>
              <div className="input-box" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Username or Email</label>
                <input
                  type="text"
                  placeholder="e.g. adwaith24 or your@email.com"
                  className="input-control"
                  value={forgotData.identifier}
                  onChange={e => setForgotData(f => ({ ...f, identifier: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="input-box" style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>New Password (min 6 chars)</label>
                <input
                  type="password"
                  placeholder="New secure password"
                  className="input-control"
                  value={forgotData.newPassword}
                  onChange={e => setForgotData(f => ({ ...f, newPassword: e.target.value }))}
                  required
                  minLength={6}
                />
              </div>
              <button type="submit" className="btn-auth" disabled={forgotLoading} style={{ marginTop: 0 }}>
                {forgotLoading ? 'Resetting…' : 'Reset & Log In'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

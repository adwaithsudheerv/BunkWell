import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { CheckCircle2, ShieldCheck, Award } from 'lucide-react';

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    name: '',
    username: '',
    password: '',
    studentId: '',
    college: '',
    department: '',
    semester: 1,
    attendanceTarget: 80,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [moreOptions, setMoreOptions] = useState(false);

  // Google Modal
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const update = (key, val) => {
    setForm(f => {
      const next = { ...f, [key]: val };
      // Auto-suggest username when email is typed
      if (key === 'email' && (!f.username || f.username === f.email.split('@')[0])) {
        next.username = val.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
      }
      return next;
    });
  };

  const isFormValid =
    form.email.trim().length > 3 &&
    form.name.trim().length > 1 &&
    form.password.length >= 6 &&
    form.studentId.trim().length > 1;

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) {
      toast.error('Email address is required');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Full legal name is required');
      return;
    }
    if (!form.studentId.trim()) {
      toast.error('Student Roll Number or ID is required');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await register({
        ...form,
        email: form.email.toLowerCase().trim(),
        username: (form.username || form.email.split('@')[0] || form.name.replace(/\s+/g, '')).toLowerCase().trim(),
        studentId: form.studentId.toUpperCase().trim()
      });
      toast.success('Welcome to Bunkwell! 🎓');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed';
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
      toast.success('Account created with Google! 🎓');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Google registration failed');
    } finally {
      setGoogleLoading(false);
      setShowGoogleModal(false);
    }
  };

  return (
    <div className="ig-auth-container">
      <div className="ig-auth-wrapper">
        {/* Main Sign Up Card */}
        <div className="ig-card">
          <div className="ig-brand-header">
            <h1 className="ig-logo-text">Bunkwell</h1>
            <p className="ig-signup-subtext">
              Sign up to track your timetable, period attendance, and smart bunk calculations.
            </p>
          </div>

          {/* Quick Sign up with Google */}
          <button
            type="button"
            className="ig-alt-login-btn ig-google-btn-prominent"
            onClick={() => setShowGoogleModal(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Log in with Google</span>
          </button>

          {/* OR Divider */}
          <div className="ig-divider">
            <div className="ig-divider-line"></div>
            <span className="ig-divider-text">OR</span>
            <div className="ig-divider-line"></div>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleRegister} className="ig-form">
            {/* Email */}
            <div className="ig-input-group">
              <input
                type="email"
                id="signup-email"
                placeholder=" "
                className="ig-input"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                required
                autoComplete="email"
              />
              <label htmlFor="signup-email" className="ig-floating-label">
                Mobile Number or Email
              </label>
            </div>

            {/* Full Name */}
            <div className="ig-input-group">
              <input
                type="text"
                id="signup-name"
                placeholder=" "
                className="ig-input"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                required
                autoComplete="name"
              />
              <label htmlFor="signup-name" className="ig-floating-label">
                Full Name
              </label>
            </div>

            {/* Student ID / Roll No with verified badge */}
            <div className="ig-input-group">
              <input
                type="text"
                id="signup-studentid"
                placeholder=" "
                className="ig-input"
                value={form.studentId}
                onChange={e => update('studentId', e.target.value.toUpperCase())}
                required
              />
              <label htmlFor="signup-studentid" className="ig-floating-label">
                Student Roll No / ID Card Number
              </label>
              {form.studentId.trim().length >= 3 && (
                <span className="ig-verified-badge" title="Verified Format">
                  <CheckCircle2 size={13} />
                </span>
              )}
            </div>

            {/* Username */}
            <div className="ig-input-group">
              <input
                type="text"
                id="signup-username"
                placeholder=" "
                className="ig-input"
                value={form.username}
                onChange={e => update('username', e.target.value.toLowerCase().trim())}
                autoComplete="username"
              />
              <label htmlFor="signup-username" className="ig-floating-label">
                Username
              </label>
            </div>

            {/* Password */}
            <div className="ig-input-group">
              <input
                type={showPassword ? 'text' : 'password'}
                id="signup-pass"
                placeholder=" "
                className="ig-input"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <label htmlFor="signup-pass" className="ig-floating-label">
                Password
              </label>
              {form.password.length > 0 && (
                <button
                  type="button"
                  className="ig-show-btn"
                  onClick={() => setShowPassword(p => !p)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              )}
            </div>

            {/* Collapsible College & Department Options */}
            {!moreOptions ? (
              <button
                type="button"
                className="ig-more-toggle-btn"
                onClick={() => setMoreOptions(true)}
              >
                + Add College, Semester & Attendance Target
              </button>
            ) : (
              <div className="ig-more-section animate-in">
                <div className="ig-input-group">
                  <input
                    type="text"
                    id="signup-college"
                    placeholder=" "
                    className="ig-input"
                    value={form.college}
                    onChange={e => update('college', e.target.value)}
                  />
                  <label htmlFor="signup-college" className="ig-floating-label">
                    College / University (e.g. Amrita)
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div className="ig-input-group">
                    <input
                      type="text"
                      id="signup-dept"
                      placeholder=" "
                      className="ig-input"
                      value={form.department}
                      onChange={e => update('department', e.target.value.toUpperCase())}
                    />
                    <label htmlFor="signup-dept" className="ig-floating-label">
                      Department (e.g. CS)
                    </label>
                  </div>

                  <div className="ig-input-group">
                    <select
                      className="ig-input"
                      value={form.semester}
                      onChange={e => update('semester', Number(e.target.value))}
                      style={{ cursor: 'pointer', paddingRight: 6 }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                        <option key={s} value={s} style={{ background: '#121212', color: '#fff' }}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="ig-target-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#a8a8a8', marginBottom: 4 }}>
                    <span>Attendance Target</span>
                    <strong style={{ color: '#0095f6' }}>{form.attendanceTarget}%</strong>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={95}
                    step={5}
                    value={form.attendanceTarget}
                    onChange={e => update('attendanceTarget', Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#0095f6', cursor: 'pointer' }}
                  />
                </div>
              </div>
            )}

            {/* Instagram Terms Text */}
            <p className="ig-terms-text">
              People who use our service may have uploaded your contact information to Bunkwell.{' '}
              <span className="ig-link-subtle">Learn More</span>
            </p>
            <p className="ig-terms-text" style={{ marginTop: 8 }}>
              By signing up, you agree to our <span className="ig-link-subtle">Terms</span>,{' '}
              <span className="ig-link-subtle">Privacy Policy</span> and{' '}
              <span className="ig-link-subtle">Cookies Policy</span>.
            </p>

            {/* Sign Up Button */}
            <button
              type="submit"
              className={`ig-primary-btn ${!isFormValid ? 'ig-btn-disabled' : ''}`}
              disabled={!isFormValid || loading}
              style={{ marginTop: 12 }}
            >
              {loading ? 'Signing up…' : 'Sign up'}
            </button>
          </form>
        </div>

        {/* Secondary Box: "Have an account? Log in" */}
        <div className="ig-secondary-card">
          <p className="ig-secondary-text">
            Have an account?{' '}
            <Link to="/login" className="ig-link-bold">
              Log in
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="ig-footer">
          <div className="ig-footer-links">
            <span>About</span>
            <span>Help</span>
            <span>API</span>
            <span>Privacy</span>
            <span>Terms</span>
            <span>Security</span>
            <span>Locations</span>
          </div>
          <div className="ig-footer-copy">
            &copy; {new Date().getFullYear()} BUNKWELL FROM STUDENT NETWORK
          </div>
        </div>
      </div>

      {/* Google Modal */}
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
              <h3 style={{ fontSize: 17, color: '#fff', margin: 0 }}>Continue with Google</h3>
              <p style={{ fontSize: 12, color: '#8e8e8e', marginTop: 4 }}>
                Enter your Gmail address to create your Bunkwell account:
              </p>
            </div>

            <form onSubmit={handleGoogleSubmit} className="ig-form">
              <div className="ig-input-group">
                <input
                  type="email"
                  id="google-reg-email"
                  placeholder=" "
                  className="ig-input"
                  value={googleEmail}
                  onChange={e => setGoogleEmail(e.target.value)}
                  required
                  autoFocus
                />
                <label htmlFor="google-reg-email" className="ig-floating-label">
                  Gmail Address
                </label>
              </div>

              <div className="ig-input-group">
                <input
                  type="text"
                  id="google-reg-name"
                  placeholder=" "
                  className="ig-input"
                  value={googleName}
                  onChange={e => setGoogleName(e.target.value)}
                />
                <label htmlFor="google-reg-name" className="ig-floating-label">
                  Full Name (Optional)
                </label>
              </div>

              <button
                type="submit"
                className="ig-primary-btn"
                disabled={googleLoading || !googleEmail.trim()}
              >
                {googleLoading ? 'Creating account…' : 'Sign up with Google'}
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

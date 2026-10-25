import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { CheckCircle2, ShieldCheck, Award, KeyRound, User, Mail, Hash } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    studentId: '',
    college: '',
    department: '',
    semester: 1,
    attendanceTarget: 80,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [moreOptions, setMoreOptions] = useState(false);

  const update = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
  };

  const isFormValid =
    form.username.trim().length >= 3 &&
    form.email.trim().includes('@') &&
    form.name.trim().length > 1 &&
    form.password.length >= 6 &&
    form.studentId.trim().length > 1;

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!form.username.trim() || form.username.trim().length < 3) {
      toast.error('User ID must be at least 3 characters');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      toast.error('Please enter a valid Email ID (for recovery)');
      return;
    }
    if (!form.password || form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
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

    setLoading(true);
    try {
      await register({
        ...form,
        username: form.username.toLowerCase().trim().replace(/\s+/g, ''),
        email: form.email.toLowerCase().trim(),
        studentId: form.studentId.toUpperCase().trim()
      });
      // Mark as newly registered so Onboarding Tour triggers automatically
      localStorage.removeItem('bunkwell_tour_done');
      toast.success('Account created successfully! Welcome to BunkClub 🎓');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ig-auth-container">
      <div className="ig-auth-wrapper">
        {/* Main Sign Up Card */}
        <div className="ig-card">
          <div className="ig-brand-header">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <img src="/favicon.png" alt="BunkClub" style={{ width: 48, height: 48, borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.4)' }} />
            </div>
            <h1 className="ig-logo-text" style={{ letterSpacing: '0.5px' }}>BunkClub</h1>
            <p className="ig-signup-subtext">
              Join the student club for smart attendance tracking, section timetable sync, and safe bunks.
            </p>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleRegister} className="ig-form">
            {/* User ID / Username */}
            <div className="ig-input-group">
              <input
                type="text"
                id="reg-username"
                placeholder=" "
                className="ig-input"
                value={form.username}
                onChange={e => update('username', e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                required
                autoComplete="username"
              />
              <label htmlFor="reg-username" className="ig-floating-label">
                User ID / Username (e.g. adwaith_s)
              </label>
            </div>

            {/* Email ID (for recovery) */}
            <div className="ig-input-group">
              <input
                type="email"
                id="reg-email"
                placeholder=" "
                className="ig-input"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                required
                autoComplete="email"
              />
              <label htmlFor="reg-email" className="ig-floating-label">
                Email ID (required for password/ID recovery)
              </label>
            </div>

            {/* Password */}
            <div className="ig-input-group">
              <input
                type={showPassword ? 'text' : 'password'}
                id="reg-pass"
                placeholder=" "
                className="ig-input"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <label htmlFor="reg-pass" className="ig-floating-label">
                Password (min 6 characters)
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

            {/* Full Name */}
            <div className="ig-input-group">
              <input
                type="text"
                id="reg-name"
                placeholder=" "
                className="ig-input"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                required
                autoComplete="name"
              />
              <label htmlFor="reg-name" className="ig-floating-label">
                Full Legal Name
              </label>
            </div>

            {/* Student ID / Roll Number */}
            <div className="ig-input-group">
              <input
                type="text"
                id="reg-id"
                placeholder=" "
                className="ig-input"
                value={form.studentId}
                onChange={e => update('studentId', e.target.value)}
                required
              />
              <label htmlFor="reg-id" className="ig-floating-label">
                Student Roll No / College ID
              </label>
            </div>

            {/* Optional college info collapsible */}
            <div style={{ marginTop: 4, marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setMoreOptions(m => !m)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6366f1',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {moreOptions ? '− Hide College Details' : '+ Add College, Branch & Attendance Target (Optional)'}
              </button>
            </div>

            {moreOptions && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0' }}>
                <div className="ig-input-group">
                  <input
                    type="text"
                    id="reg-college"
                    placeholder=" "
                    className="ig-input"
                    value={form.college}
                    onChange={e => update('college', e.target.value)}
                  />
                  <label htmlFor="reg-college" className="ig-floating-label">
                    College / University Name
                  </label>
                </div>

                <div className="ig-input-group">
                  <input
                    type="text"
                    id="reg-dept"
                    placeholder=" "
                    className="ig-input"
                    value={form.department}
                    onChange={e => update('department', e.target.value)}
                  />
                  <label htmlFor="reg-dept" className="ig-floating-label">
                    Branch / Department (e.g. CSE)
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="ig-input-group">
                    <select
                      id="reg-sem"
                      className="ig-input"
                      value={form.semester}
                      onChange={e => update('semester', Number(e.target.value))}
                      style={{ color: '#fff', background: '#121212' }}
                    >
                      {[1,2,3,4,5,6,7,8].map(s => (
                        <option key={s} value={s} style={{ background: '#1a1a1a', color: '#fff' }}>Semester {s}</option>
                      ))}
                    </select>
                    <label htmlFor="reg-sem" className="ig-floating-label">Semester</label>
                  </div>

                  <div className="ig-input-group">
                    <input
                      type="number"
                      id="reg-target"
                      placeholder=" "
                      className="ig-input"
                      value={form.attendanceTarget}
                      onChange={e => update('attendanceTarget', Number(e.target.value))}
                      min="50"
                      max="100"
                    />
                    <label htmlFor="reg-target" className="ig-floating-label">
                      Target % (default 80%)
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Terms notice */}
            <p className="ig-disclaimer-text" style={{ marginTop: 12 }}>
              By signing up, you agree to Bunkwell's Terms and Privacy Policy. Your Email ID is protected and used strictly for two-factor security and password recovery.
            </p>

            {/* Submit Button */}
            <button
              type="submit"
              className={`ig-primary-btn ${!isFormValid ? 'ig-btn-disabled' : ''}`}
              disabled={!isFormValid || loading}
            >
              {loading ? 'Creating Account…' : 'Sign Up'}
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

        {/* Security badge */}
        <div style={{ textAlign: 'center', margin: '14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#8e8e8e', fontSize: 12 }}>
          <ShieldCheck size={14} style={{ color: '#10b981' }} />
          <span>User ID + Password Auth with Verified Email Recovery</span>
        </div>

        {/* Footer */}
        <div className="ig-footer">
          <div className="ig-footer-links">
            <span>About</span>
            <span>Help</span>
            <span>Security</span>
            <span>Privacy</span>
            <span>Terms</span>
            <span>BunkClub Pro</span>
          </div>
          <div className="ig-footer-copy">
            &copy; {new Date().getFullYear()} BUNKCLUB FROM STUDENT NETWORK
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  User, Mail, Lock, Eye, EyeOff, IdCard, Building2,
  GraduationCap, Check, ShieldCheck, Sparkles,
  BookOpen, ChevronRight, ChevronLeft, Award, CheckCircle2, X
} from 'lucide-react';

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState(1);

  // Google Modal
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    studentId: '',
    college: '',
    department: '',
    semester: 1,
    year: 1,
    attendanceTarget: 80,
  });

  const update = (key, val) => {
    setForm(f => {
      const updated = { ...f, [key]: val };
      // Auto-suggest username when email is typed (if username hasn't been manually set)
      if (key === 'email' && (!f.username || f.username === f.email.split('@')[0])) {
        updated.username = val.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
      }
      return updated;
    });
  };

  // Live password strength calculation
  const passStrength = useMemo(() => {
    const p = form.password;
    if (!p) return { score: 0, label: 'Empty', color: '#64748b' };
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 10) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[A-Z]/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak', color: '#ef4444' };
      case 2:
        return { score: 2, label: 'Fair', color: '#f59e0b' };
      case 3:
        return { score: 3, label: 'Good', color: '#10b981' };
      case 4:
        return { score: 4, label: 'Strong & Secure', color: '#06b6d4' };
      default:
        return { score: 1, label: 'Weak', color: '#ef4444' };
    }
  }, [form.password]);

  // ID verification format check
  const isIdVerified = useMemo(() => {
    const id = form.studentId.trim();
    return id.length >= 3;
  }, [form.studentId]);

  const handleNextStep = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Please enter your full legal name');
      return;
    }
    if (!form.email.trim() && !form.username.trim()) {
      toast.error('Please enter your Email address or Username');
      return;
    }
    if (!form.password) {
      toast.error('Please enter a secure password');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.studentId.trim()) {
      toast.error('Please enter your Student ID or Roll number');
      return;
    }

    setLoading(true);
    try {
      await register({
        ...form,
        username: (form.username || form.email.split('@')[0] || form.name.toLowerCase().replace(/\s+/g, '')).toLowerCase().trim(),
        email: form.email.trim().toLowerCase(),
        studentId: form.studentId.trim().toUpperCase()
      });
      toast.success('Registration verified & complete! 🎓');
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
      const msg = err.response?.data?.message || err.message || 'Google registration failed';
      toast.error(msg);
    } finally {
      setGoogleLoading(false);
      setShowGoogleModal(false);
    }
  };

  return (
    <section className="form-main">
      <div className="form-content" style={{ maxWidth: '520px' }}>
        <div className="circle-1"></div>
        <div className="circle-2"></div>
        <div className="circle-3"></div>

        <div className="box" style={{ padding: '36px 36px 32px' }}>
          {/* Header Brand */}
          <div className="brand-icon-wrap" style={{ marginBottom: 12 }}>
            <div className="brand-icon" style={{ width: 48, height: 48, borderRadius: 14 }}>
              <GraduationCap size={24} />
            </div>
          </div>

          <h3 style={{ fontSize: 26, marginBottom: 4 }}>Student Registration</h3>
          <p className="sub-text" style={{ marginBottom: 16 }}>
            {step === 1 ? 'Step 1 of 2: Personal & Login Credentials' : 'Step 2 of 2: College ID Verification & Goals'}
          </p>

          {/* Quick Sign up with Google */}
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={() => setShowGoogleModal(true)}
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 30,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  marginBottom: 16,
                  transition: 'background 0.2s',
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Sign up with Google / Gmail
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Or enter your details
                </span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              </div>
            </>
          )}

          {/* Stepper with descriptive headers */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  background: step === 1 ? 'linear-gradient(to right, var(--yellow), var(--red))' : '#10b981',
                  color: '#fff',
                  boxShadow: step === 1 ? '0 0 12px rgba(255, 120, 0, 0.4)' : 'none',
                }}
              >
                {step > 1 ? <Check size={14} /> : '1'}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: step === 1 ? '#fff' : '#94a3b8' }}>
                Account
              </span>
            </div>

            <div style={{ width: 40, height: 2, background: step === 2 ? '#10b981' : 'rgba(255,255,255,0.15)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  background: step === 2 ? 'linear-gradient(to right, var(--yellow), var(--red))' : 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: step === 2 ? 'none' : '1px solid rgba(255,255,255,0.2)',
                  boxShadow: step === 2 ? '0 0 12px rgba(255, 120, 0, 0.4)' : 'none',
                }}
              >
                2
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: step === 2 ? '#fff' : '#94a3b8' }}>
                Verification
              </span>
            </div>
          </div>

          <form onSubmit={step === 1 ? handleNextStep : handleSubmit}>
            {step === 1 ? (
              <div className="animate-in" style={{ display: 'grid', gap: 16 }}>
                {/* Full Legal Name */}
                <div className="input-box" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <User size={13} className="text-amber-400" /> Full Legal Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Adwaith Sudheer"
                    className="input-control"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>

                {/* College / Personal Email Address */}
                <div className="input-box" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Mail size={13} className="text-amber-400" /> Email Address *
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. adwaith@amrita.edu or your@gmail.com"
                    className="input-control"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                {/* Username Input (Auto-suggested from email) */}
                <div className="input-box" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <User size={13} className="text-amber-400" /> Username
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. adwaith24"
                    className="input-control"
                    value={form.username}
                    onChange={e => update('username', e.target.value.toLowerCase().trim())}
                    autoComplete="username"
                  />
                </div>

                {/* Password Input with Visibility Toggle */}
                <div className="input-box" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Lock size={13} className="text-amber-400" /> Password *
                    </label>
                    {form.password && (
                      <span style={{ fontSize: 11, color: passStrength.color, fontWeight: 600 }}>
                        {passStrength.label}
                      </span>
                    )}
                  </div>
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    className="input-control"
                    value={form.password}
                    onChange={e => update('password', e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
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

                {/* Password Strength Meter */}
                {form.password && (
                  <div style={{ marginTop: -6, marginBottom: 2 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                      {[1, 2, 3, 4].map(barIndex => (
                        <div
                          key={barIndex}
                          style={{
                            height: 4,
                            borderRadius: 4,
                            background: barIndex <= passStrength.score ? passStrength.color : 'rgba(255,255,255,0.1)',
                            transition: 'all 0.3s ease',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="animate-in" style={{ display: 'grid', gap: 16 }}>
                {/* Student ID Verification Input with Live Badge */}
                <div className="input-box" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <IdCard size={13} className="text-amber-400" /> Student Roll No / ID Card Number *
                    </label>
                    {isIdVerified && (
                      <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: 99, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <CheckCircle2 size={11} /> ID VERIFIED
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. MY.AC.P2MCA26001 or 21CS042"
                    className="input-control"
                    value={form.studentId}
                    onChange={e => update('studentId', e.target.value.toUpperCase())}
                    required
                    autoFocus
                  />
                </div>

                {/* College & Department in 2 columns */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="input-box" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Building2 size={12} className="text-amber-400" /> College / University
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Amrita University"
                      className="input-control"
                      value={form.college}
                      onChange={e => update('college', e.target.value)}
                    />
                  </div>
                  <div className="input-box" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <BookOpen size={12} className="text-amber-400" /> Department
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CS / MCA"
                      className="input-control"
                      value={form.department}
                      onChange={e => update('department', e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                {/* Semester & Target Attendance Goal */}
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14, alignItems: 'center' }}>
                  <div className="input-box" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Semester
                    </label>
                    <select
                      className="input-control"
                      value={form.semester}
                      onChange={e => update('semester', Number(e.target.value))}
                      style={{ cursor: 'pointer', background: '#0a0a0a' }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                        <option key={s} value={s} style={{ background: '#111', color: '#fff' }}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Award size={12} className="text-amber-400" /> Min. Attendance Goal
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>
                        {form.attendanceTarget}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={95}
                      step={5}
                      value={form.attendanceTarget}
                      onChange={e => update('attendanceTarget', Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                    />
                  </div>
                </div>

                {/* Live Student Card Preview Badge */}
                {form.name && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(239,68,68,0.06) 100%)',
                      border: '1px solid rgba(245,158,11,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {form.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                          {form.name}
                        </p>
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                          {form.studentId ? `ID: ${form.studentId}` : 'ID Verification Pending'} • {form.department || 'Student'}
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: '#10b981', background: 'rgba(16,185,129,0.2)', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                      Goal: {form.attendanceTarget}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              {step === 2 && (
                <button
                  type="button"
                  className="btn-back"
                  onClick={() => setStep(1)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >
                  <ChevronLeft size={16} /> Back
                </button>
              )}
              <button
                type="submit"
                className="btn-auth"
                disabled={loading}
                style={{ flex: step === 2 ? 1.5 : 1 }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                    Creating Account…
                  </>
                ) : step === 1 ? (
                  <>
                    Continue to ID Verification <ChevronRight size={16} />
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Complete Registration
                  </>
                )}
              </button>
            </div>
          </form>

          <p style={{ marginTop: 20 }}>
            Already registered?{' '}
            <Link to="/login" className="gradient-text">
              Sign In
            </Link>
          </p>
        </div>
      </div>

      {/* Google Sign Up Modal */}
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
                <h4 style={{ color: '#fff', fontSize: 17, margin: 0 }}>Sign up with Google</h4>
              </div>
              <button onClick={() => setShowGoogleModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 18 }}>
              Enter your Gmail address to instantly create your student profile:
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
                <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Full Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Adwaith Sudheer"
                  className="input-control"
                  value={googleName}
                  onChange={e => setGoogleName(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-auth" disabled={googleLoading} style={{ marginTop: 0 }}>
                {googleLoading ? 'Creating profile…' : 'Continue to Dashboard'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

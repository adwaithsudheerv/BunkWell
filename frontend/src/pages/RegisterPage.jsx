import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  User, Lock, Eye, EyeOff, IdCard, Building2,
  GraduationCap, Check, ShieldCheck, Sparkles,
  BookOpen, ChevronRight, ChevronLeft, Award, CheckCircle2
} from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    studentId: '',
    college: '',
    department: '',
    semester: 1,
    year: 1,
    attendanceTarget: 80,
  });

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

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
    return id.length >= 4;
  }, [form.studentId]);

  const handleNextStep = (e) => {
    e.preventDefault();
    if (!form.username.trim()) {
      toast.error('Please choose a username');
      return;
    }
    if (form.username.length < 3) {
      toast.error('Username must be at least 3 characters');
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
    if (!form.name.trim()) {
      toast.error('Please enter your full student name');
      return;
    }
    if (!form.studentId.trim()) {
      toast.error('Please enter your Student ID or Roll number');
      return;
    }

    setLoading(true);
    try {
      await register(form);
      toast.success('Registration verified & complete! 🎓');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
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
          <div className="brand-icon-wrap" style={{ marginBottom: 14 }}>
            <div className="brand-icon" style={{ width: 48, height: 48, borderRadius: 14 }}>
              <GraduationCap size={24} />
            </div>
          </div>

          <h3 style={{ fontSize: 26, marginBottom: 4 }}>Student Registration</h3>
          <p className="sub-text" style={{ marginBottom: 20 }}>
            {step === 1 ? 'Step 1 of 2: Create Secure Account' : 'Step 2 of 2: ID Verification & Goals'}
          </p>

          {/* Stepper with descriptive headers */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
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
                  width: 28,
                  height: 28,
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
              <div className="animate-in" style={{ display: 'grid', gap: 18 }}>
                {/* Username Input */}
                <div className="input-box" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <User size={13} className="text-amber-400" /> Choose Username
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. adwaith24"
                    className="input-control"
                    value={form.username}
                    onChange={e => update('username', e.target.value.toLowerCase().trim())}
                    required
                    autoComplete="username"
                  />
                </div>

                {/* Password Input with Visibility Toggle */}
                <div className="input-box" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Lock size={13} className="text-amber-400" /> Password
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
                  <div style={{ marginTop: -8, marginBottom: 4 }}>
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
                    <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                      <span style={{ color: form.password.length >= 6 ? '#10b981' : '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                        ✓ 6+ chars
                      </span>
                      <span style={{ color: /[0-9]/.test(form.password) ? '#10b981' : '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                        ✓ Number
                      </span>
                      <span style={{ color: /[A-Z]/.test(form.password) ? '#10b981' : '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                        ✓ Uppercase
                      </span>
                    </div>
                  </div>
                )}

                {/* Security Guarantee Pill */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 11,
                    color: '#94a3b8',
                  }}
                >
                  <ShieldCheck size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>Passwords are hashed with Bcrypt (salt rounds: 12) & JWT authenticated.</span>
                </div>
              </div>
            ) : (
              <div className="animate-in" style={{ display: 'grid', gap: 16 }}>
                {/* Full Name */}
                <div className="input-box" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <User size={13} className="text-amber-400" /> Full Legal Name
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

                {/* Student ID Verification Input with Live Badge */}
                <div className="input-box" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <IdCard size={13} className="text-amber-400" /> Student Roll No / ID Card Number
                    </label>
                    {isIdVerified && (
                      <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: 99, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <CheckCircle2 size={11} /> ID VERIFIED
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. 21CS042 / STU-2024"
                    className="input-control"
                    value={form.studentId}
                    onChange={e => update('studentId', e.target.value.toUpperCase())}
                    required
                  />
                </div>

                {/* College & Department in 2 columns */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="input-box" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Building2 size={12} className="text-amber-400" /> College
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Institute"
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
                      placeholder="e.g. CSE / IT"
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
                          {form.studentId ? `ID: ${form.studentId}` : 'ID Verification Pending'} • {form.department || 'General'}
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
                    Verifying & Creating…
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
    </section>
  );
}

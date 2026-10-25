import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    username: '', password: '', name: '', studentId: '',
    college: '', department: '', semester: 1, year: 1,
  });

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 1) { 
      if (!form.username || !form.password) {
        toast.error('Please enter a username and password');
        return;
      }
      setStep(2); 
      return; 
    }

    if (!form.name || !form.studentId) {
      toast.error('Please enter your full name and student ID');
      return;
    }

    setLoading(true);
    try {
      await register(form);
      toast.success('Welcome to Bunkwell! 🎓');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="form-main">
      <div className="form-content">
        <div className="circle-1"></div>
        <div className="circle-2"></div>
        <div className="circle-3"></div>

        <div className="box">
          <div className="brand-icon-wrap">
            <div className="brand-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
          </div>

          <h3>Create Account</h3>
          <p className="sub-text">Join Bunkwell and track smarter</p>

          {/* Clean 2-step indicator */}
          <div className="step-tracker">
            <div className={`step-num ${step === 1 ? 'active' : 'done'}`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <div className="step-divider"></div>
            <div className={`step-num ${step === 2 ? 'active' : ''}`}>
              2
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 ? (
              <>
                <div className="input-box">
                  <input
                    type="text"
                    placeholder="Choose Username"
                    className="input-control"
                    value={form.username}
                    onChange={e => update('username', e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>

                <div className="input-box">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Password (min 6 chars)"
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
                    {showPass ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="input-box">
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="input-control"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="input-box">
                  <input
                    type="text"
                    placeholder="Student ID / Roll No (e.g. CS202401)"
                    className="input-control"
                    value={form.studentId}
                    onChange={e => update('studentId', e.target.value)}
                    required
                  />
                </div>

                <div className="input-box">
                  <input
                    type="text"
                    placeholder="College / Institution"
                    className="input-control"
                    value={form.college}
                    onChange={e => update('college', e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '22px' }}>
                  <div>
                    <input
                      type="text"
                      placeholder="Department (e.g. CSE)"
                      className="input-control"
                      value={form.department}
                      onChange={e => update('department', e.target.value)}
                    />
                  </div>
                  <div>
                    <select
                      className="input-control"
                      value={form.semester}
                      onChange={e => update('semester', Number(e.target.value))}
                      style={{ cursor: 'pointer' }}
                    >
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              {step === 2 && (
                <button
                  type="button"
                  className="btn-back"
                  onClick={() => setStep(1)}
                  style={{ flex: 1 }}
                >
                  ← Back
                </button>
              )}
              <button
                type="submit"
                className="btn-auth"
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                    Creating…
                  </>
                ) : step === 1 ? 'Next →' : 'Sign Up'}
              </button>
            </div>
          </form>

          <p>
            Already have an account?{' '}
            <Link to="/login" className="gradient-text">
              Login
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

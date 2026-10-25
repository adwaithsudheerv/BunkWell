import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Lock, KeyRound, ArrowLeft, CheckCircle2, ShieldCheck, Mail, User, Eye, EyeOff, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const { login, sendOTP, resetPasswordWithOTP } = useAuth();
  const navigate = useNavigate();

  // Mode: 'login' | 'forgot_send' | 'forgot_verify'
  const [view, setView] = useState('login');

  // Login form
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Recovery flow
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [devCode, setDevCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const isLoginValid = identifier.trim().length > 0 && password.length >= 6;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;

    setLoading(true);
    try {
      await login(identifier.trim(), password);
      toast.success('Welcome back to BunkClub! 🎓');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Sorry, your password or User ID was incorrect.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

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
        toast.success(`Verification code sent! (Code: ${res.code})`, { duration: 6000 });
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-black text-slate-100 font-sans">
      {/* Ambient glassmorphic lighting */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background: `
            radial-gradient(circle 650px at 15% 15%, rgba(245, 158, 11, 0.16), transparent 70%),
            radial-gradient(circle 750px at 85% 85%, rgba(139, 92, 246, 0.18), transparent 70%),
            radial-gradient(circle 500px at 50% 45%, rgba(239, 68, 68, 0.09), transparent 70%)
          `
        }}
      />

      {/* Decorative background grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none -z-20 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      <div className="w-full max-w-md relative z-10 flex flex-col gap-4">
        {/* Main Glassmorphic Card */}
        <div className="w-full rounded-3xl p-7 sm:p-9 backdrop-blur-2xl bg-white/[0.035] border border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.75)] relative overflow-hidden">
          {/* Top highlight sheen */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

          {/* Logo & Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-red-500/20 border border-amber-500/30 p-2 shadow-lg shadow-orange-500/20 mb-3">
              <img src="/favicon.png" alt="BunkClub" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-1.5">
              BunkClub
            </h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
              <Sparkles size={12} className="text-amber-400" /> Smart Attendance & Safe Bunk Intelligence
            </p>
          </div>

          {/* VIEW 1: NORMAL LOGIN */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* User ID / Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  User ID or Email
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="e.g. adwaith_s or mail@gmail.com"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:bg-white/[0.08] transition-all"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryEmail(identifier);
                      setView('forgot_send');
                    }}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-11 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:bg-white/[0.08] transition-all"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3.5 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!isLoginValid || loading}
                className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white font-semibold text-sm hover:opacity-95 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2"
              >
                {loading ? 'Logging in…' : 'Log In'}
              </button>
            </form>
          )}

          {/* VIEW 2: FORGOT PASSWORD / RECOVER USER ID */}
          {view === 'forgot_send' && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-2">
                <Lock size={22} />
              </div>
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold text-white">Recover Your Account</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Enter your registered Email ID or User ID. We'll send you a 6-digit verification code to reset your password and confirm your User ID.
                </p>
              </div>

              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Registered Email or User ID
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                      <Mail size={16} />
                    </div>
                    <input
                      type="text"
                      value={recoveryEmail}
                      onChange={e => setRecoveryEmail(e.target.value)}
                      placeholder="e.g. student@gmail.com"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:bg-white/[0.08] transition-all"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!recoveryEmail.trim() || otpLoading}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-red-500 text-white font-semibold text-sm hover:opacity-95 active:scale-[0.98] disabled:opacity-50 transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2"
                >
                  {otpLoading ? 'Sending Security Code…' : 'Send 6-Digit Code'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setView('login')}
                className="w-full py-2.5 text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={14} /> Back to Log In
              </button>
            </div>
          )}

          {/* VIEW 3: ENTER OTP & NEW PASSWORD */}
          {view === 'forgot_verify' && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <KeyRound size={22} />
              </div>
              <div className="text-center mb-3">
                <h2 className="text-lg font-bold text-white">Enter Security Code</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Sent to <strong className="text-white">{maskedEmail}</strong>
                </p>
              </div>

              {devCode && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center text-xs text-amber-300">
                  🔑 Verification Code: <strong>{devCode}</strong>
                </div>
              )}

              <form onSubmit={handleResetWithOTP} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                    6-Digit Security Code
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="######"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-3 text-center text-xl tracking-[8px] font-mono font-bold text-white focus:outline-none focus:border-emerald-400 focus:bg-white/[0.08] transition-all"
                    required
                    maxLength={6}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    New Password (min 6 characters)
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Choose a strong password"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-11 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:bg-white/[0.08] transition-all"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(p => !p)}
                      className="absolute right-3.5 text-slate-400 hover:text-white transition-colors"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={otp.length < 6 || newPassword.length < 6 || otpLoading}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm hover:opacity-95 active:scale-[0.98] disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
                >
                  {otpLoading ? 'Verifying & Saving…' : 'Save New Password & Log In'}
                </button>
              </form>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={otpLoading}
                  className="text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Resend code
                </button>
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Back to login
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Secondary Glass Card: Sign Up Prompt */}
        {view === 'login' && (
          <div className="w-full rounded-2xl p-4 backdrop-blur-xl bg-white/[0.025] border border-white/10 text-center">
            <p className="text-xs text-slate-400">
              Don't have an account?{' '}
              <Link to="/register" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors ml-1">
                Join BunkClub
              </Link>
            </p>
          </div>
        )}

        {/* Security badge footer */}
        <div className="flex items-center justify-center gap-1.5 text-slate-500 text-xs">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Secured with Bcrypt Hashing & Verified Email OTP</span>
        </div>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Lock, User, Eye, EyeOff, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const { login, register, checkUsername } = useAuth();
  const navigate = useNavigate();

  // Mode: 'login' | 'register'
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusHint, setStatusHint] = useState(null); // { type: 'existing' | 'new', message: string }

  // Check username on blur
  const handleUsernameBlur = async () => {
    const clean = username.trim().toLowerCase().replace(/\s+/g, '');
    if (clean.length >= 3) {
      try {
        const res = await checkUsername(clean);
        if (res.exists) {
          setStatusHint({ type: 'existing', message: `Welcome back @${clean}! Enter your password to enter.` });
          setMode('login');
        } else {
          setStatusHint({ type: 'new', message: `@${clean} is available! Enter password to create account.` });
          setMode('register');
        }
      } catch (err) {}
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '');

    if (!cleanUsername || cleanUsername.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }
    if (!password || password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    if (mode === 'register' && confirmPassword && password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(cleanUsername, password);
        toast.success(`Welcome back @${cleanUsername}! 🎓`);
      } else {
        await register({
          username: cleanUsername,
          password,
        });
        toast.success(`Account created! Welcome @${cleanUsername} 🎉`);
      }
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Authentication failed';
      // If user not found during login, offer to create account
      if (err.response?.data?.notFound) {
        setMode('register');
        setStatusHint({ type: 'new', message: `Username not registered yet. Create your account with this password!` });
        toast(msg, { icon: '💡' });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#07090e] text-white font-sans selection:bg-blue-600 selection:text-white">
      {/* Ambient Glassmorphic Lighting Background */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background: `
            radial-gradient(circle 700px at 15% 15%, rgba(0, 71, 255, 0.20), transparent 70%),
            radial-gradient(circle 700px at 85% 85%, rgba(37, 99, 235, 0.15), transparent 70%),
            radial-gradient(circle 450px at 50% 50%, rgba(0, 71, 255, 0.10), transparent 70%)
          `
        }}
      />

      {/* Decorative Grid Mesh */}
      <div
        className="fixed inset-0 pointer-events-none -z-20 opacity-15"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px)',
          backgroundSize: '36px 36px'
        }}
      />

      {/* Glassmorphic Container */}
      <div className="w-full max-w-[420px] backdrop-blur-3xl bg-white/[0.04] border border-white/10 rounded-3xl p-7 sm:p-9 shadow-[0_16px_50px_rgba(0,0,0,0.6)] relative overflow-hidden animate-[fadeIn_0.3s_ease-out]">
        {/* Subtle glass highlight stripe */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-6">
          <h1 className="bunkclub-brand text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center justify-center">
            <span>Bunk</span><span className="text-blue-500">Club</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 tracking-wide uppercase font-semibold">
            {mode === 'login' ? 'Sign in with your username & password' : 'Create your 24/7 attendance tracker'}
          </p>
        </div>

        {/* Mode Toggle Tabs (Inkcrypt style) */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-white/5 border border-white/10 mb-5 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setMode('login'); setStatusHint(null); }}
            className={`py-2.5 rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setStatusHint(null); }}
            className={`py-2.5 rounded-xl transition-all ${
              mode === 'register'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Status Hint */}
        {statusHint && (
          <div className={`p-3 rounded-xl mb-4 text-xs font-semibold flex items-center gap-2 border ${
            statusHint.type === 'existing'
              ? 'bg-blue-600/15 border-blue-500/30 text-blue-300'
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
          }`}>
            <Sparkles size={14} className="flex-shrink-0" />
            <span>{statusHint.message}</span>
          </div>
        )}

        {/* Form: ONLY Username and Password */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Username
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-500 font-bold text-sm">@</span>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onBlur={handleUsernameBlur}
                className="w-full pl-8 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:border-blue-500 focus:bg-white/[0.07] transition-all"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Password
              </label>
            </div>
            <div className="relative flex items-center">
              <Lock size={16} className="absolute left-3.5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'login' ? 'Enter your password' : 'Choose a password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:border-blue-500 focus:bg-white/[0.07] transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-slate-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm Password (only on register) */}
          {mode === 'register' && (
            <div className="animate-[fadeIn_0.2s_ease-out]">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Confirm Password
              </label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3.5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:border-blue-500 focus:bg-white/[0.07] transition-all"
                  required
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-lg shadow-blue-500/30 active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              'Processing...'
            ) : mode === 'login' ? (
              <>
                Log In to BunkClub <ArrowRight size={16} />
              </>
            ) : (
              <>
                Create Account <Sparkles size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-6 pt-5 border-t border-white/10 text-center text-xs text-slate-400">
          <p>
            {mode === 'login' ? (
              <>
                New student?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('register'); setStatusHint(null); }}
                  className="text-blue-400 font-bold hover:underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setStatusHint(null); }}
                  className="text-blue-400 font-bold hover:underline"
                >
                  Log in here
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Lock, User, Eye, EyeOff, Sparkles, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const { register, checkUsername } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);

  const handleUsernameBlur = async () => {
    const clean = username.trim().toLowerCase().replace(/\s+/g, '');
    if (clean.length >= 3) {
      try {
        const res = await checkUsername(clean);
        setUsernameTaken(res.exists);
        if (res.exists) {
          toast(`@${clean} is already registered. You can log in!`, { icon: 'ℹ️' });
        }
      } catch (e) {}
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
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: cleanUsername,
        password,
      });
      toast.success(`Account created! Welcome @${cleanUsername} 🎉`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed';
      toast.error(msg);
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
            Sign up with just a username & password
          </p>
        </div>

        {/* Username taken prompt */}
        {usernameTaken && (
          <div className="p-3 rounded-xl mb-4 bg-blue-600/15 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center justify-between">
            <span>@{username} already exists!</span>
            <Link to="/login" className="text-white underline font-bold">Log in here →</Link>
          </div>
        )}

        {/* Form: ONLY Username and Password */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Choose Username
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-500 font-bold text-sm">@</span>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="choose_username"
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
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Choose Password
            </label>
            <div className="relative flex items-center">
              <Lock size={16} className="absolute left-3.5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
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

          {/* Confirm Password */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Confirm Password
            </label>
            <div className="relative flex items-center">
              <Lock size={16} className="absolute left-3.5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:border-blue-500 focus:bg-white/[0.07] transition-all"
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-lg shadow-blue-500/30 active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              'Creating Account...'
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
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 font-bold hover:underline">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

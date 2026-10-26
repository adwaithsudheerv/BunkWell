import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Lock, User, Eye, EyeOff, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const { register, checkUsername } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingUserNotice, setExistingUserNotice] = useState(null);

  // If there is a last logged-in user on this device, show a quick-login pill
  const lastUser = localStorage.getItem('bunkclub_last_username');

  // Debounced check if username is already registered as they type
  useEffect(() => {
    const clean = username.trim().toLowerCase().replace(/\s+/g, '');
    if (clean.length < 3) {
      setExistingUserNotice(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await checkUsername(clean);
        if (res.exists) {
          setExistingUserNotice(clean);
          toast(`@${clean} is already registered! Taking you to login...`, { icon: 'ℹ️' });
          navigate('/login', {
            state: {
              prefilledUsername: clean,
              autoNotice: `Welcome back @${clean}! You are already registered. Enter password to log in.`
            }
          });
        } else {
          setExistingUserNotice(null);
        }
      } catch (e) {}
    }, 400);

    return () => clearTimeout(timer);
  }, [username, navigate]);

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
      localStorage.setItem('bunkclub_last_username', cleanUsername);
      toast.success(`Account created! Welcome @${cleanUsername} 🎉`);
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 409 || err.response?.data?.message?.includes('already taken')) {
        toast(`@${cleanUsername} is already registered! Redirecting to login...`, { icon: 'ℹ️' });
        navigate('/login', {
          state: {
            prefilledUsername: cleanUsername,
            autoNotice: `Welcome back @${cleanUsername}! Enter password to log in.`
          }
        });
        return;
      }
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
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="relative mx-auto mb-3.5 w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500/25 rounded-2xl blur-lg" />
            <div className="relative w-16 h-16 rounded-2xl bg-black/80 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/20 overflow-hidden">
              <img
                src="/logo-blue.png"
                alt="BunkClub"
                className="w-13 h-13 object-contain drop-shadow"
              />
            </div>
          </div>
          <h1 className="bunkclub-brand text-3xl font-extrabold tracking-tight text-white flex items-center justify-center">
            <span>Bunk</span><span className="text-blue-500">Club</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1.5 tracking-wide uppercase font-semibold">
            Create an Account
          </p>
        </div>

        {/* Existing user quick pill if remembered on device */}
        {lastUser && (
          <div className="mb-4 p-3 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-between text-xs animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-200">Registered as <b>@{lastUser}</b>?</span>
            </div>
            <Link
              to="/login"
              state={{ prefilledUsername: lastUser }}
              className="text-blue-300 hover:text-white font-extrabold underline text-xs"
            >
              Log In →
            </Link>
          </div>
        )}

        {/* Form: Username and Password */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
              Choose Username
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400 font-bold text-sm">@</span>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="choose_username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full pl-8 pr-4 py-3 rounded-2xl bg-[#131722] border border-slate-700 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
              Choose Password
            </label>
            <div className="relative flex items-center">
              <Lock size={16} className="absolute left-3.5 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-2xl bg-[#131722] border border-slate-700 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-slate-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
              Confirm Password
            </label>
            <div className="relative flex items-center">
              <Lock size={16} className="absolute left-3.5 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#131722] border border-slate-700 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm disabled:opacity-50 transition-all shadow-lg shadow-blue-500/30 active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
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
        <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 font-extrabold hover:underline">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

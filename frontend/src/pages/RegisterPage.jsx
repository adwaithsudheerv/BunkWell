import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { CheckCircle2, ShieldCheck, User, Mail, Lock, Hash, GraduationCap, Eye, EyeOff, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center p-4 py-8 relative overflow-hidden bg-black text-slate-100 font-sans">
      {/* Ambient glassmorphic lighting */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background: `
            radial-gradient(circle 650px at 15% 15%, rgba(0, 71, 255, 0.16), transparent 70%),
            radial-gradient(circle 750px at 85% 85%, rgba(37, 99, 235, 0.14), transparent 70%),
            radial-gradient(circle 500px at 50% 45%, rgba(29, 78, 216, 0.08), transparent 70%)
          `
        }}
      />

      {/* Decorative grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none -z-20 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      <div className="w-full max-w-lg relative z-10 flex flex-col gap-4">
        {/* Main Glassmorphic Card */}
        <div className="w-full rounded-3xl p-7 sm:p-9 backdrop-blur-2xl bg-white/[0.035] border border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.75)] relative overflow-hidden">
          {/* Top highlight sheen */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

          {/* Logo & Brand Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <img src="/logo-white.png" alt="BunkClub" className="h-10 sm:h-11 w-auto object-contain filter drop-shadow-[0_4px_12px_rgba(0,71,255,0.3)]" />
            </div>
            <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5 font-medium">
              Smart Attendance, Section Timetable Sync & Bunk IQ
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-3.5">
            {/* User ID / Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Choose User ID <span className="text-blue-400">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <User size={15} />
                </div>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => update('username', e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                  placeholder="e.g. adwaith_s"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white/[0.08] transition-all"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email ID <span className="text-blue-400">*</span> (Used for OTP password/ID recovery)
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <Mail size={15} />
                </div>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  placeholder="e.g. yourname@gmail.com"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white/[0.08] transition-all"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password <span className="text-blue-400">*</span> (min 6 characters)
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <Lock size={15} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder="Create a secure password"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-11 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white/[0.08] transition-all"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3.5 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Full Name & Student ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-blue-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="e.g. Adwaith S"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white/[0.08] transition-all"
                  required
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Roll No / Student ID <span className="text-blue-400">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400 pointer-events-none">
                    <Hash size={14} />
                  </div>
                  <input
                    type="text"
                    value={form.studentId}
                    onChange={e => update('studentId', e.target.value)}
                    placeholder="e.g. 24MCA041"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white/[0.08] transition-all uppercase"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Collapsible College Details */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setMoreOptions(m => !m)}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors py-1"
              >
                {moreOptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {moreOptions ? 'Hide College & Target Details' : '+ Add College, Course & Attendance Target (Optional)'}
              </button>
            </div>

            {moreOptions && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 animate-[fadeIn_0.2s_ease-out]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      College / University
                    </label>
                    <input
                      type="text"
                      value={form.college}
                      onChange={e => update('college', e.target.value)}
                      placeholder="e.g. Amrita Mysore"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Department / Course
                    </label>
                    <input
                      type="text"
                      value={form.department}
                      onChange={e => update('department', e.target.value)}
                      placeholder="e.g. MCA, CSE"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Semester
                    </label>
                    <select
                      value={form.semester}
                      onChange={e => update('semester', Number(e.target.value))}
                      className="w-full bg-[#16171d] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {[1,2,3,4,5,6,7,8].map(s => (
                        <option key={s} value={s}>Semester {s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Attendance Target %
                    </label>
                    <input
                      type="number"
                      value={form.attendanceTarget}
                      onChange={e => update('attendanceTarget', Number(e.target.value))}
                      min="50"
                      max="100"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="w-full mt-2 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              {loading ? 'Creating Account…' : 'Create BunkClub Account'}
            </button>
          </form>
        </div>

        {/* Secondary Glass Card: Log In Link */}
        <div className="w-full rounded-2xl p-4 backdrop-blur-xl bg-white/[0.025] border border-white/10 text-center">
          <p className="text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors ml-1">
              Log in
            </Link>
          </p>
        </div>

        {/* Security badge footer */}
        <div className="flex items-center justify-center gap-1.5 text-slate-500 text-xs">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>User ID + Password Auth with Verified Email OTP Recovery</span>
        </div>
      </div>
    </div>
  );
}
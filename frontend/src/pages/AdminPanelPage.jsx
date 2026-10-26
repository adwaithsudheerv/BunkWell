import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  ShieldCheck, Users, Key, Search, Eye, EyeOff, Copy, Check,
  LogOut, ArrowLeft, RefreshCw, Lock, Sparkles, Calendar, BookOpen
} from 'lucide-react';

export default function AdminPanelPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState({}); // { [userId]: boolean }
  const [copiedId, setCopiedId] = useState(null);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/stats')
      ]);
      setUsers(usersRes.data.users || []);
      setStats(statsRes.data.stats || null);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Access denied or session expired');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const togglePassword = (userId) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const copyPassword = (userId, password) => {
    navigator.clipboard.writeText(password);
    setCopiedId(userId);
    toast.success('Password copied to clipboard! 📋');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = () => {
    localStorage.removeItem('bunkwell_token');
    localStorage.removeItem('bunkwell_user');
    toast.success('Admin session ended');
    navigate('/login');
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans selection:bg-blue-600 selection:text-white p-4 sm:p-6 lg:p-8">
      {/* Background Glow */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background: `
            radial-gradient(circle 700px at 10% 10%, rgba(0, 71, 255, 0.15), transparent 70%),
            radial-gradient(circle 600px at 90% 90%, rgba(139, 92, 246, 0.12), transparent 70%)
          `
        }}
      />

      <div className="max-w-6xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out]">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                  Master Admin Vault
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    READ-ONLY
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Private User Directory & Recovery Vault for Adwaith Sudheer
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={loadAdminData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
              title="Refresh Directory"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-colors"
            >
              <ArrowLeft size={14} /> Student Dashboard
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-colors"
            >
              <LogOut size={14} /> Exit Vault
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-card rounded-2xl p-4 border border-white/10">
            <p className="text-xs text-slate-400 font-medium">Total Registered Users</p>
            <p className="text-2xl font-black mt-1 text-blue-400">{stats?.totalUsers ?? users.length}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-white/10">
            <p className="text-xs text-slate-400 font-medium">Total Subjects</p>
            <p className="text-2xl font-black mt-1 text-emerald-400">{stats?.totalSubjects ?? '—'}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-white/10">
            <p className="text-xs text-slate-400 font-medium">Attendance Records</p>
            <p className="text-2xl font-black mt-1 text-purple-400">{stats?.totalAttendanceRecords ?? '—'}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-white/10">
            <p className="text-xs text-slate-400 font-medium">Active Timetables</p>
            <p className="text-2xl font-black mt-1 text-amber-400">{stats?.totalTimetables ?? '—'}</p>
          </div>
        </div>

        {/* Security / Notice Banner */}
        <div className="glass-card rounded-xl p-3.5 border border-amber-500/20 bg-amber-500/5 text-xs text-slate-300 flex items-start gap-3">
          <Lock size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-400">Emergency Recovery Policy:</span> Passwords can be viewed and copied to assist classmates who forget their credentials. Passwords are strictly read-only and cannot be altered from this panel.
          </div>
        </div>

        {/* Search Bar */}
        <div className="glass-card rounded-xl px-4 py-2.5 flex items-center gap-3 border border-white/10">
          <Search size={18} className="text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username, full name, email, or department..."
            className="w-full bg-transparent placeholder-slate-500 focus:outline-none text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Users Table */}
        <div className="glass-card rounded-2xl overflow-hidden border border-white/10 shadow-xl">
          <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              Registered Student Accounts ({filteredUsers.length})
            </span>
            <span className="text-[11px] text-slate-400">
              Sorted by newest registration
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="p-3 font-semibold text-slate-400">Student</th>
                  <th className="p-3 font-semibold text-slate-400">Email</th>
                  <th className="p-3 font-semibold text-slate-400">Department / College</th>
                  <th className="p-3 font-semibold text-slate-400">Password (Recovery)</th>
                  <th className="p-3 font-semibold text-slate-400 text-center">Classes / Att</th>
                  <th className="p-3 font-semibold text-slate-400">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      {loading ? 'Loading user directory...' : 'No users match your search query.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isRevealed = Boolean(revealedPasswords[u._id]);
                    const isCopied = copiedId === u._id;

                    return (
                      <tr key={u._id} className="hover:bg-white/[0.02] transition-colors">
                        {/* Student Name & Username */}
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                              {u.username?.[0] || 'U'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-200 truncate">{u.name}</p>
                              <p className="text-[11px] text-blue-400 font-medium">@{u.username}</p>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="p-3 text-slate-300 truncate max-w-[150px]">
                          {u.email}
                        </td>

                        {/* Department / College */}
                        <td className="p-3">
                          <p className="text-slate-300 font-medium">{u.department || 'MCA'}</p>
                          <p className="text-[10px] text-slate-500 truncate max-w-[180px]">{u.college}</p>
                        </td>

                        {/* Password Recovery Box */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/10 w-fit">
                            <Key size={13} className="text-amber-400 flex-shrink-0" />
                            <span className="font-mono text-xs text-amber-300 select-all tracking-wide">
                              {isRevealed ? u.password : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePassword(u._id)}
                              className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors ml-1"
                              title={isRevealed ? 'Hide Password' : 'Show Password'}
                            >
                              {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button
                              onClick={() => copyPassword(u._id, u.password)}
                              className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                              title="Copy Password to Clipboard"
                            >
                              {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                            </button>
                          </div>
                        </td>

                        {/* Classes / Att */}
                        <td className="p-3 text-center">
                          <span className="font-semibold text-slate-200">{u.subjectsCount} subs</span>
                          <span className="text-slate-500 mx-1">·</span>
                          <span className="text-emerald-400 font-semibold">{u.attendanceCount} recs</span>
                        </td>

                        {/* Date Joined */}
                        <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

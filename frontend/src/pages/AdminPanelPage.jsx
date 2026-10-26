import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  Key, Search, Eye, EyeOff, Copy, Check,
  LogOut, RefreshCw, Calendar, X, FileText, Lock, User
} from 'lucide-react';

export default function AdminPanelPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [viewingTimetableUser, setViewingTimetableUser] = useState(null);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Admin authorization required');
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
    toast.success('Password copied! 📋');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyUserTimetableText = (user) => {
    let text = `📅 BunkClub Class Timetable (Code: ${user.shareCode || 'BC-Active'})\n`;
    text += `Student: ${user.name} (@${user.username})\n`;
    text += `Section: ${user.timetableSection || 'A'}\n`;
    text += `Timetable: ${user.timetableTitle || 'Class Schedule'}\n\n`;

    (user.daysSchedule || []).forEach(d => {
      const periods = (d.periods || []).filter(p => p.subjectName);
      if (periods.length > 0) {
        text += `📍 ${d.day}:\n`;
        periods.forEach(p => {
          text += `  • P${p.periodNumber} (${p.startTime || '—'}): ${p.subjectName}\n`;
        });
        text += '\n';
      }
    });

    text += `👉 Import directly into BunkClub using Code: ${user.shareCode}`;
    navigator.clipboard.writeText(text);
    toast.success(`Full timetable text for @${user.username} copied! 📋`);
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
      (u.shareCode && u.shareCode.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200 font-mono selection:bg-blue-600 selection:text-white p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Minimal Admin Console Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0b0e14] border border-slate-800 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-sm">
              ⚙️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-wider uppercase text-white">
                  Admin User Vault
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {users.length} Users
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Read-Only
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                Master User Credentials & Timetable Share Codes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAdminData}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
              title="Refresh Users"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-colors"
            >
              <LogOut size={13} /> Exit
            </button>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-slate-800 flex items-center gap-3">
          <Search size={16} className="text-slate-500 ml-1.5 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search username, name, email, or share code..."
            className="w-full bg-transparent placeholder-slate-600 focus:outline-none text-xs text-slate-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[11px] text-slate-500 hover:text-white mr-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Strictly User Details Table */}
        <div className="rounded-xl overflow-hidden bg-[#0b0e14] border border-slate-800 shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="p-3.5 font-semibold">User</th>
                  <th className="p-3.5 font-semibold">Email & College</th>
                  <th className="p-3.5 font-semibold">Password (Recovery)</th>
                  <th className="p-3.5 font-semibold">Timetable & Share Code</th>
                  <th className="p-3.5 font-semibold">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 font-sans">
                      {loading ? 'Fetching directory...' : 'No users found matching query.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isRevealed = Boolean(revealedPasswords[u._id]);
                    const isCopied = copiedId === u._id;

                    return (
                      <tr key={u._id} className="hover:bg-slate-800/30 transition-colors">
                        {/* User Identity */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/25 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                              {u.username?.[0] || 'U'}
                            </div>
                            <div className="min-w-0 font-sans">
                              <p className="font-bold text-slate-100 text-xs truncate">{u.name}</p>
                              <p className="text-[11px] text-blue-400 font-mono mt-0.5">@{u.username}</p>
                            </div>
                          </div>
                        </td>

                        {/* Email & College Info */}
                        <td className="p-3.5 font-sans">
                          <p className="text-slate-300 text-xs truncate max-w-[200px]">{u.email}</p>
                          <p className="text-[11px] text-slate-500 truncate max-w-[220px] mt-0.5">
                            {u.department} · {u.college}
                          </p>
                        </td>

                        {/* Password Recovery Box */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1.5 rounded-lg border border-slate-700/80 w-fit">
                            <Key size={12} className="text-amber-400 flex-shrink-0" />
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

                        {/* Timetable Share Code & Schedule */}
                        <td className="p-3.5 font-sans">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded border border-blue-500/30">
                                {u.shareCode || 'BC-Pending'}
                              </span>
                              {u.isShareCodeRevealed ? (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Revealed by User
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  Saved in Admin
                                </span>
                              )}
                            </div>

                            {u.hasTimetable && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setViewingTimetableUser(u)}
                                  className="text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                                  title="View Full Timetable Schedule"
                                >
                                  <Calendar size={12} /> View Schedule
                                </button>
                                <button
                                  onClick={() => copyUserTimetableText(u)}
                                  className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                                  title="Copy WhatsApp Schedule Text"
                                >
                                  <Copy size={12} /> Copy Text
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Date Registered */}
                        <td className="p-3.5 text-slate-400 text-[11px] whitespace-nowrap font-mono">
                          {u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '—'}
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

      {/* Timetable Schedule Viewer Modal (Admin Only) */}
      {viewingTimetableUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="w-full max-w-2xl bg-[#0b0e14] border border-slate-800 rounded-2xl p-5 shadow-2xl animate-[slideUp_0.3s_ease-out] font-sans">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>📅 Full Timetable: {viewingTimetableUser.name}</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {viewingTimetableUser.shareCode}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Section: {viewingTimetableUser.timetableSection || 'A'} · {viewingTimetableUser.timetableTitle}
                </p>
              </div>
              <button
                onClick={() => setViewingTimetableUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {(viewingTimetableUser.daysSchedule || []).map((dayObj) => {
                const periods = (dayObj.periods || []).filter(p => p.subjectName);
                if (periods.length === 0) return null;

                return (
                  <div key={dayObj.day} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <p className="font-bold text-xs text-blue-400 mb-2 uppercase tracking-wider">
                      {dayObj.day}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {periods.map(p => (
                        <div key={p.periodNumber} className="p-2 rounded-lg bg-black/40 border border-slate-800 text-[11px]">
                          <span className="text-slate-500 font-mono mr-1">P{p.periodNumber}:</span>
                          <span className="font-semibold text-slate-200">{p.subjectName}</span>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{p.startTime} - {p.endTime}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-500 font-mono">
                Status: {viewingTimetableUser.isShareCodeRevealed ? '🟢 User Generated' : '🔒 Admin Vault Stored'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyUserTimetableText(viewingTimetableUser)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                >
                  <Copy size={13} /> Copy WhatsApp Schedule
                </button>
                <button
                  onClick={() => setViewingTimetableUser(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

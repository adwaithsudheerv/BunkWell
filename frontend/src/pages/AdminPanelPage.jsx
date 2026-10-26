import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import {
  Key, Search, Eye, EyeOff, Copy, Check,
  LogOut, RefreshCw, Calendar, X, FileText, Lock, User, Trash2, AlertTriangle,
  Sun, Moon
} from 'lucide-react';

export default function AdminPanelPage() {
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [viewingTimetableUser, setViewingTimetableUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/admin/users/${userToDelete._id}`);
      toast.success(res.data.message || `User @${userToDelete.username} deleted successfully`);
      setUserToDelete(null);
      await loadAdminData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
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
    <div className={`min-h-screen font-mono p-3 sm:p-6 transition-colors ${
      isDark ? 'bg-[#05070a] text-slate-100 selection:bg-blue-600 selection:text-white' : 'bg-[#f8f6f0] text-slate-900 selection:bg-blue-500 selection:text-white'
    }`}>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Minimal Admin Console Bar */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border transition-colors ${
          isDark ? 'bg-[#0b0e14] border-slate-800 shadow-2xl' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm border ${
              isDark ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'
            }`}>
              ⚙️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-sm font-black tracking-wider uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Admin User Vault
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30">
                  {users.length} Users
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Read-Only
                </span>
              </div>
              <p className={`text-[11px] mt-0.5 font-sans font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Master User Credentials & Timetable Share Codes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-sans font-semibold border transition-colors ${
                isDark
                  ? 'bg-slate-800/80 hover:bg-slate-700 text-amber-300 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title={isDark ? 'Switch to Day Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-blue-600" />}
              <span className="hidden sm:inline text-[11px]">{isDark ? 'Day Mode' : 'Dark Mode'}</span>
            </button>

            <button
              onClick={loadAdminData}
              disabled={loading}
              className={`p-2 rounded-lg text-xs border transition-colors ${
                isDark ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300'
              }`}
              title="Refresh Users"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 text-xs font-bold border border-red-500/20 transition-colors"
            >
              <LogOut size={13} /> Exit
            </button>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className={`p-2.5 rounded-xl border flex items-center gap-3 transition-colors ${
          isDark ? 'bg-[#0b0e14] border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <Search size={16} className={`${isDark ? 'text-slate-400' : 'text-slate-500'} ml-1.5 flex-shrink-0`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search username, name, email, or share code..."
            className={`w-full bg-transparent focus:outline-none text-xs font-sans ${
              isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`text-[11px] mr-2 font-medium ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Clear
            </button>
          )}
        </div>

        {/* Strictly User Details Table */}
        <div className={`rounded-xl overflow-hidden border shadow-sm transition-colors ${
          isDark ? 'bg-[#0b0e14] border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
              <thead>
                <tr className={`border-b uppercase text-[10px] tracking-wider font-bold transition-colors ${
                  isDark ? 'border-slate-800 bg-slate-900/80 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-700'
                }`}>
                  <th className="p-3.5">User & Database ID</th>
                  <th className="p-3.5">Email & College</th>
                  <th className="p-3.5">Password (Recovery)</th>
                  <th className="p-3.5">Timetable Details & Share Code</th>
                  <th className="p-3.5">Registered</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className={isDark ? 'divide-y divide-slate-800/80' : 'divide-y divide-slate-100'}>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`p-8 text-center font-sans ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {loading ? 'Fetching directory...' : 'No users found matching query.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isRevealed = Boolean(revealedPasswords[u._id]);
                    const isCopied = copiedId === u._id;

                    return (
                      <tr key={u._id} className={`transition-colors ${
                        isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                      }`}>
                        {/* User Identity & ID */}
                        <td className="p-3.5">
                          <div className="flex items-start gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 mt-0.5 border ${
                              isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/25' : 'bg-blue-50 text-blue-600 border-blue-200'
                            }`}>
                              {u.username?.[0] || 'U'}
                            </div>
                            <div className="min-w-0 font-sans">
                              <p className={`font-bold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{u.name}</p>
                              <p className="text-[11px] text-blue-500 font-mono font-bold">@{u.username}</p>
                              <div className="flex items-center gap-1 mt-1 text-[10px] font-mono">
                                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>ID:</span>
                                <span className={`select-all font-semibold px-1 py-0.2 rounded ${
                                  isDark ? 'text-slate-300 bg-slate-800/60' : 'text-slate-700 bg-slate-100'
                                }`}>{u._id}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email & College Info */}
                        <td className="p-3.5 font-sans">
                          <p className={`text-xs truncate max-w-[200px] font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{u.email}</p>
                          <p className={`text-[11px] truncate max-w-[220px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {u.department} · {u.college}
                          </p>
                        </td>

                        {/* Password Recovery Box */}
                        <td className="p-3.5">
                          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border w-fit ${
                            isDark ? 'bg-black/60 border-slate-700/80' : 'bg-amber-50/80 border-amber-300'
                          }`}>
                            <Key size={12} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                            <span className={`font-mono text-xs font-bold select-all tracking-wide ${
                              isDark ? 'text-amber-300' : 'text-amber-900'
                            }`}>
                              {isRevealed ? u.password : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePassword(u._id)}
                              className={`p-1 rounded transition-colors ml-1 ${
                                isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-500 hover:text-slate-900'
                              }`}
                              title={isRevealed ? 'Hide Password' : 'Show Password'}
                            >
                              {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button
                              onClick={() => copyPassword(u._id, u.password)}
                              className={`p-1 rounded transition-colors ${
                                isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-500 hover:text-slate-900'
                              }`}
                              title="Copy Password to Clipboard"
                            >
                              {isCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                            </button>
                          </div>
                        </td>

                        {/* Timetable Details & Share Code */}
                        <td className="p-3.5 font-sans">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                                isDark
                                  ? 'text-blue-300 bg-blue-500/15 border-blue-500/30'
                                  : 'text-blue-700 bg-blue-50 border-blue-200'
                              }`}>
                                {u.shareCode || 'BC-Pending'}
                              </span>
                              {u.isShareCodeRevealed ? (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30">
                                  Revealed by User
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  Saved in Admin
                                </span>
                              )}
                            </div>

                            <p className={`text-[11px] truncate max-w-[200px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {u.timetableTitle || 'Timetable'} · Sec {u.timetableSection || 'A'}
                            </p>

                            {u.hasTimetable ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setViewingTimetableUser(u)}
                                  className={`text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded transition-colors border ${
                                    isDark
                                      ? 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border-slate-700'
                                      : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border-slate-300'
                                  }`}
                                  title="View Full Timetable Schedule"
                                >
                                  <Calendar size={12} /> View Schedule ({u.scheduledDaysCount}d)
                                </button>
                                <button
                                  onClick={() => copyUserTimetableText(u)}
                                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                                  title="Copy WhatsApp Schedule Text"
                                >
                                  <Copy size={12} /> Copy Text
                                </button>
                              </div>
                            ) : (
                              <span className={`text-[11px] italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No timetable created yet</span>
                            )}
                          </div>
                        </td>

                        {/* Date Registered */}
                        <td className={`p-3.5 text-[11px] whitespace-nowrap font-mono font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '—'}
                        </td>

                        {/* Actions: Delete User with Confirmation Modal */}
                        <td className="p-3.5 text-center">
                          {u.username !== 'adwaith.admin' && u.username !== 'admin' ? (
                            <button
                              onClick={() => setUserToDelete(u)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 border border-red-500/20 hover:border-red-500/40 transition-colors text-xs font-semibold"
                              title={`Delete user @${u.username}`}
                            >
                              <Trash2 size={13} />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          ) : (
                            <span className={`text-[10px] font-mono italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Protected</span>
                          )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className={`w-full max-w-2xl rounded-2xl p-5 shadow-2xl animate-[slideUp_0.3s_ease-out] font-sans border transition-colors ${
            isDark ? 'bg-[#0b0e14] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50'
          }`}>
            <div className={`flex items-center justify-between pb-3 mb-4 border-b ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div>
                <h3 className={`font-bold text-sm flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <span>📅 Full Timetable: {viewingTimetableUser.name}</span>
                  <span className={`font-mono text-xs px-2 py-0.5 rounded border ${
                    isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-600 border-blue-200'
                  }`}>
                    {viewingTimetableUser.shareCode}
                  </span>
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Section: {viewingTimetableUser.timetableSection || 'A'} · {viewingTimetableUser.timetableTitle}
                </p>
              </div>
              <button
                onClick={() => setViewingTimetableUser(null)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {(viewingTimetableUser.daysSchedule || []).map((dayObj) => {
                const periods = (dayObj.periods || []).filter(p => p.subjectName);
                if (periods.length === 0) return null;

                return (
                  <div key={dayObj.day} className={`p-3 rounded-xl border ${
                    isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <p className="font-bold text-xs text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">
                      {dayObj.day}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {periods.map(p => (
                        <div key={p.periodNumber} className={`p-2 rounded-lg border text-[11px] ${
                          isDark ? 'bg-black/40 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-xs'
                        }`}>
                          <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'} font-mono mr-1`}>P{p.periodNumber}:</span>
                          <span className="font-semibold">{p.subjectName}</span>
                          <p className={`text-[10px] font-mono mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p.startTime} - {p.endTime}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={`flex items-center justify-between gap-3 mt-4 pt-3 border-t ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <span className={`text-xs font-mono font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal (Extra "Are you sure?" step) */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl animate-[slideUp_0.3s_ease-out] font-sans border transition-colors ${
            isDark ? 'bg-[#0b0e14] border-red-900/40 text-white' : 'bg-white border-red-300 text-slate-900 shadow-red-100'
          }`}>
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Are you sure?
                </h3>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  You are about to delete user <strong className="font-mono text-red-500 dark:text-red-400">@{userToDelete.username}</strong> ({userToDelete.name}).
                </p>
              </div>
            </div>

            <div className={`rounded-xl p-3.5 mb-5 text-xs space-y-1.5 font-mono border ${
              isDark ? 'bg-red-950/20 border-red-900/30 text-red-300' : 'bg-red-50 border-red-200 text-red-900'
            }`}>
              <div className="flex items-center justify-between">
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Database ID:</span>
                <span className="font-bold select-all">{userToDelete._id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Registered Email:</span>
                <span className="truncate max-w-[180px] font-bold">{userToDelete.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Subjects to remove:</span>
                <span className="text-red-500 font-bold">{userToDelete.subjectsCount || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Timetable & Logs:</span>
                <span className="text-red-500 font-bold">{userToDelete.attendanceCount || 0} records</span>
              </div>
              <p className="text-[11px] text-red-500 pt-2 border-t border-red-200 dark:border-red-900/30 font-sans font-medium">
                ⚠️ All associated subjects, timetable schedules, and attendance history will be completely and permanently removed. This action cannot be reversed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 border ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold transition-all shadow-lg shadow-red-900/30 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Yes, Delete User</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

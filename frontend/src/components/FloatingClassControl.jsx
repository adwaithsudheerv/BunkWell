import { useState, useEffect } from 'react';
import { backgroundSentinel } from '../lib/backgroundSentinel';
import { useTheme } from '../context/ThemeContext';
import { Volume2, VolumeX, X, Zap, ChevronDown, Check, CheckCircle2, XCircle } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function FloatingClassControl() {
  const { isDark } = useTheme();
  const [status, setStatus] = useState({ isMuted: false, isBunked: false, session: null, text: 'Ringer Active 🔔' });
  const [collapsed, setCollapsed] = useState(false);
  const [chitPopup, setChitPopup] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const handleStatus = (e) => {
      if (e.detail) setStatus(e.detail);
    };
    window.addEventListener('sentinel-status', handleStatus);

    const handleIncomingChit = (e) => {
      setChitPopup(e.detail);
    };
    window.addEventListener('incoming-chit-popup', handleIncomingChit);

    const handleAttUpdate = () => {
      backgroundSentinel.evaluate();
    };
    window.addEventListener('attendance-updated', handleAttUpdate);

    return () => {
      window.removeEventListener('sentinel-status', handleStatus);
      window.removeEventListener('incoming-chit-popup', handleIncomingChit);
      window.removeEventListener('attendance-updated', handleAttUpdate);
    };
  }, []);

  // Quick Action from Floating Widget: Bidirectionally syncs with Attendance API & Native Ringer
  const handleToggleAttendance = async (markAs) => {
    if (!status.session) return;
    setActionLoading(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      const pNum = status.session.periodNumber;
      const subId = status.session.subjectId?._id || status.session.subjectId;

      if (markAs === 'bunk') {
        await backgroundSentinel.markBunk(pNum, now, status.session.subjectName);
        if (subId) {
          await api.post('/attendance/mark', {
            subjectId: subId,
            date: now,
            periodNumber: pNum,
            status: 'absent'
          }).catch(() => {});
        }
        toast.success(`Period ${pNum} bunked • Phone unmuted 🔔`);
      } else {
        await backgroundSentinel.markPresent(pNum, now, status.session.subjectName);
        if (subId) {
          await api.post('/attendance/mark', {
            subjectId: subId,
            date: now,
            periodNumber: pNum,
            status: 'present'
          }).catch(() => {});
        }
        toast.success(`Period ${pNum} attending • Phone muted 🔕`);
      }

      window.dispatchEvent(new CustomEvent('attendance-updated'));
    } catch (err) {
      toast.error('Could not update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReplyChit = async (e) => {
    e?.preventDefault();
    if (!chitPopup || !replyText.trim()) return;
    try {
      toast.success('Replied & chit burned away! 🔥');
      setChitPopup(null);
      setReplyText('');
    } catch (e) {
      toast.error('Failed to reply');
    }
  };

  return (
    <>
      {/* 1. FLOATING CHIT / POP-UP WINDOW (One-Time View & Direct Reply) */}
      {chitPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className={`w-full max-w-sm rounded-3xl p-5 border shadow-2xl space-y-3 glass-morphic ${
            isDark ? 'bg-[#0f172a]/95 border-amber-500/40 text-white' : 'bg-white/95 border-amber-300 text-slate-900'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black flex items-center gap-1.5 text-amber-500">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] flex items-center justify-center font-black">
                  ①
                </span>
                <span>One-Time View Chit</span>
              </span>
              <button onClick={() => setChitPopup(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-3 rounded-2xl bg-black/20 border border-white/10 text-xs">
              <p className="font-extrabold text-blue-400">@{chitPopup.senderName}:</p>
              <p className="mt-1 font-medium">{chitPopup.content}</p>
            </div>

            <form onSubmit={handleReplyChit} className="space-y-2">
              <input
                type="text"
                placeholder="Reply then and there itself..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-white/20 bg-black/30 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shadow-md transition-all"
              >
                Reply & Burn Chit 🔥
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. FLOATING BOTTOM-RIGHT CLASS & RINGER CONTROL (Never Blocks Top Nav!) */}
      <div className="fixed bottom-20 right-4 z-30 flex flex-col items-end gap-2 select-none pointer-events-none">
        <div className="pointer-events-auto">
          {collapsed ? (
            <button
              onClick={() => setCollapsed(false)}
              className={`p-3 rounded-full shadow-2xl border transition-all active:scale-95 flex items-center justify-center ${
                status.isMuted
                  ? 'bg-amber-600 text-white border-amber-400 shadow-amber-500/30 animate-pulse'
                  : status.isBunked
                  ? 'bg-rose-600 text-white border-rose-400 shadow-rose-500/30'
                  : isDark ? 'bg-slate-800 text-emerald-400 border-slate-700' : 'bg-white text-emerald-600 border-slate-200'
              }`}
              title={status.isMuted ? 'Auto-Muted (In Class)' : status.isBunked ? 'Bunked (Active Ringer)' : 'Normal Ringer'}
            >
              {status.isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          ) : (
            <div className={`p-3 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all max-w-xs ${
              status.isMuted
                ? 'bg-gradient-to-r from-amber-950/90 to-slate-900/90 border-amber-500/50 text-white shadow-amber-500/20'
                : status.isBunked
                ? 'bg-gradient-to-r from-rose-950/90 to-slate-900/90 border-rose-500/50 text-white shadow-rose-500/20'
                : isDark ? 'bg-[#0f172a]/90 border-white/10 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  status.isMuted ? 'text-amber-400' : status.isBunked ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {status.isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  <span>
                    {status.isMuted ? 'Auto-Muted (In Lecture)' : status.isBunked ? 'Bunked (Ringer Active)' : 'Active Ringer'}
                  </span>
                </span>
                <button
                  onClick={() => setCollapsed(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                  title="Minimize"
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              <p className="text-xs font-bold leading-tight">
                {status.text}
              </p>

              {/* Bidirectional One-Touch Sync Controls */}
              {status.session && (
                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-2">
                  {status.isMuted ? (
                    <button
                      onClick={() => handleToggleAttendance('bunk')}
                      disabled={actionLoading}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[11px] shadow-sm transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                    >
                      <XCircle size={13} />
                      <span>Bunk & Unmute 🔔</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleAttendance('present')}
                      disabled={actionLoading}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] shadow-sm transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} />
                      <span>Attending & Mute 🔕</span>
                    </button>
                  )}
                  <button
                    onClick={() => backgroundSentinel.requestPermissions()}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300"
                    title="Background Permission Settings"
                  >
                    <Zap size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

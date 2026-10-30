import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  Zap, CheckCircle2, XCircle, Volume2, VolumeX,
  Clock, Sparkles, ChevronRight, BookOpen, Layers,
  Compass, Flame, ShieldCheck, ArrowUpRight
} from 'lucide-react';
import { backgroundSentinel } from '../lib/backgroundSentinel';
import api from '../lib/api';
import toast from 'react-hot-toast';

export function openDailyWrapUp() {
  window.dispatchEvent(new CustomEvent('open-daily-wrapup'));
}

export default function BunkRunwayMatrix({ subjects = [], target = 75 }) {
  const { isDark } = useTheme();
  const [filter, setFilter] = useState('all'); // 'all', 'safe', 'deficit'
  const [liveSentinel, setLiveSentinel] = useState({
    isMuted: false,
    isBunked: false,
    session: null,
    text: 'Active Ringer 🔔'
  });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const handleStatus = (e) => {
      if (e.detail) setLiveSentinel(e.detail);
    };
    window.addEventListener('sentinel-status', handleStatus);
    return () => window.removeEventListener('sentinel-status', handleStatus);
  }, []);

  // Quick Action directly from Live Command Capsule
  const handleToggleAttendance = async (markAs) => {
    if (!liveSentinel.session) return;
    setActionLoading(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      const pNum = liveSentinel.session.periodNumber;
      const subId = liveSentinel.session.subjectId?._id || liveSentinel.session.subjectId;

      if (markAs === 'bunk') {
        await backgroundSentinel.markBunk(pNum, now, liveSentinel.session.subjectName);
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
        await backgroundSentinel.markPresent(pNum, now, liveSentinel.session.subjectName);
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
      toast.error('Failed to update session');
    } finally {
      setActionLoading(false);
    }
  };

  if (!subjects || subjects.length === 0) return null;

  // Calculate high-precision runway for each subject
  const analyzed = subjects.map(s => {
    const eligible = s.eligibleClasses ?? (s.totalClasses - (s.cancelledClasses || 0));
    const attended = s.attendedClasses || 0;
    const pct = eligible > 0 ? parseFloat(((attended / eligible) * 100).toFixed(1)) : 100;
    const isDeficit = pct < target;

    const targetFrac = target / 100;
    // Classes needed to reach target
    const needMore = isDeficit
      ? Math.max(1, Math.ceil((targetFrac * eligible - attended) / (1 - targetFrac)))
      : 0;

    // Buffer classes that can be bunked while staying >= target
    const minNeeded = Math.ceil(eligible * targetFrac);
    const canBunk = Math.max(0, attended - minNeeded);

    return {
      ...s,
      percentage: pct,
      eligible,
      attended,
      isDeficit,
      needMore,
      canBunk,
      deficitGap: isDeficit ? parseFloat((target - pct).toFixed(1)) : 0
    };
  });

  const deficitList = analyzed.filter(s => s.isDeficit);
  const safeList = analyzed.filter(s => !s.isDeficit);

  const displayed = filter === 'safe'
    ? safeList
    : filter === 'deficit'
    ? deficitList
    : analyzed;

  return (
    <div className="space-y-4">
      {/* 1. LIVE LECTURE & RINGER COMMAND CAPSULE */}
      <div className={`p-4 sm:p-5 rounded-3xl border shadow-xl backdrop-blur-xl transition-all relative overflow-hidden ${
        liveSentinel.isMuted
          ? 'bg-gradient-to-br from-amber-500/10 via-slate-900/80 to-slate-950 border-amber-500/40 shadow-amber-500/10'
          : liveSentinel.isBunked
          ? 'bg-gradient-to-br from-rose-500/10 via-slate-900/80 to-slate-950 border-rose-500/40 shadow-rose-500/10'
          : isDark
          ? 'bg-gradient-to-br from-blue-600/10 via-slate-900/80 to-slate-950 border-blue-500/30'
          : 'bg-white/95 border-slate-200 shadow-slate-200/60'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black flex-shrink-0 shadow-md ${
              liveSentinel.isMuted
                ? 'bg-amber-500 text-black shadow-amber-500/40 animate-pulse'
                : liveSentinel.isBunked
                ? 'bg-rose-500 text-white shadow-rose-500/40'
                : 'bg-blue-600 text-white shadow-blue-500/30'
            }`}>
              {liveSentinel.isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  liveSentinel.isMuted
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : liveSentinel.isBunked
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                }`}>
                  {liveSentinel.isMuted ? '🔕 Silent' : '🔔 Active'}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {liveSentinel.session ? `P${liveSentinel.session.periodNumber}` : 'Day Standby'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
                {liveSentinel.session
                  ? liveSentinel.session.subjectName
                  : 'No Active Class Right Now'}
              </h3>
            </div>
          </div>

          {/* Quick Two-Way Action Button */}
          {liveSentinel.session ? (
            <div className="flex items-center gap-2">
              {liveSentinel.isMuted ? (
                <button
                  onClick={() => handleToggleAttendance('bunk')}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <XCircle size={15} />
                  <span>Bunk & Unmute 🔔</span>
                </button>
              ) : (
                <button
                  onClick={() => handleToggleAttendance('present')}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 size={15} />
                  <span>Attending & Mute 🔕</span>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={openDailyWrapUp}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all flex items-center gap-1 text-slate-300"
            >
              <Zap size={13} className="text-amber-400" />
              <span>Reconcile Today</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. BUNK RUNWAY & ATTENDANCE MATRIX (The Modern Experience) */}
      <div className={`p-5 sm:p-6 rounded-3xl border shadow-xl backdrop-blur-xl ${
        isDark ? 'bg-[#0b0f17]/90 border-white/10 text-white' : 'bg-white/90 border-slate-200 text-slate-900 shadow-slate-200/50'
      }`}>
        {/* Header with Title and Mode Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                <Sparkles size={20} className="text-blue-500" />
                <span>Bunk Runway & Fuel Tank</span>
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                {target}% Target
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Live calculation of your safe bunk credits and recovery requirements.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/20 border border-white/10 self-start sm:self-auto text-xs font-bold">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-xl transition-all ${
                filter === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({analyzed.length})
            </button>
            <button
              onClick={() => setFilter('safe')}
              className={`px-3 py-1 rounded-xl transition-all ${
                filter === 'safe'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Safe ({safeList.length})
            </button>
            <button
              onClick={() => setFilter('deficit')}
              className={`px-3 py-1 rounded-xl transition-all ${
                filter === 'deficit'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Deficit ({deficitList.length})
            </button>
          </div>
        </div>

        {/* Subjects Runway Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
          {displayed.map(s => {
            const isSafe = !s.isDeficit;
            return (
              <div
                key={s._id || s.id}
                className={`p-4 rounded-2xl border transition-all hover:scale-[1.01] ${
                  isSafe
                    ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                    : 'bg-rose-500/5 border-rose-500/25 hover:border-rose-500/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="min-w-0">
                    <h4 className="font-black text-sm truncate flex items-center gap-1.5">
                      <span>{s.name}</span>
                      {s.code && <span className="text-[10px] font-bold text-slate-400">({s.code})</span>}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {s.attended} of {s.eligible} attended • {s.totalClasses - s.attended} bunks logged
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-base font-black px-2.5 py-0.5 rounded-xl border ${
                      isSafe
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    }`}>
                      {s.percentage}%
                    </span>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative my-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isSafe
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-rose-500 to-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, s.percentage))}%` }}
                  />
                  {/* Target Notch indicator */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-sm"
                    style={{ left: `${target}%` }}
                    title={`Target: ${target}%`}
                  />
                </div>

                {/* Fuel Capsule Status Badge */}
                <div className="flex items-center justify-between pt-1">
                  {isSafe ? (
                    <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse" />
                      <span>+{s.canBunk} Safe Bunks in Hand</span>
                    </span>
                  ) : (
                    <span className="text-xs font-black text-rose-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-400 shadow-sm shadow-rose-400 animate-pulse" />
                      <span>Need {s.needMore} Consecutive Classes</span>
                    </span>
                  )}

                  <button
                    onClick={openDailyWrapUp}
                    className="text-[11px] font-extrabold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors"
                  >
                    <span>Reconcile</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Global Lightning Action Prompt */}
        <div className="mt-5 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/30 flex-shrink-0">
              <Zap size={16} />
            </div>
            <p className="text-xs font-semibold text-slate-300">
              Need to adjust today's lab, replacement, or bunk record? Open single-touch Lightning mode.
            </p>
          </div>
          <button
            onClick={openDailyWrapUp}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 transition-all flex items-center justify-center gap-1.5 self-start sm:self-auto"
          >
            <span>Open Lightning Reconciler</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

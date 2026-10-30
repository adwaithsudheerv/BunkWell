import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import { backgroundSentinel } from '../lib/backgroundSentinel';
import {
  Zap, Check, X, RefreshCw, Calendar, Clock,
  Plus, RotateCcw, Sparkles, ChevronRight, Ban,
  ShieldCheck, AlertTriangle, Layers, ArrowRight,
  SlidersHorizontal, CheckCircle2, XCircle, Award
} from 'lucide-react';

export default function DailyWrapUpModal({ isOpen, onClose, onRefresh }) {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [records, setRecords] = useState({});
  const [replacementStates, setReplacementStates] = useState({}); // { [periodNumber]: { subId, attendance } }
  const [isHolidayToday, setIsHolidayToday] = useState(false);
  const [saving, setSaving] = useState(false);

  // Extra class form state
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [extraSubId, setExtraSubId] = useState('');
  const [extraPeriodNum, setExtraPeriodNum] = useState(6);
  const [extraStatus, setExtraStatus] = useState('present');
  const [extraStartTime, setExtraStartTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [extraEndTime, setExtraEndTime] = useState(() => {
    const d = new Date();
    return `${String((d.getHours() + 1) % 24).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  // Load today's schedule, attendance records, and subjects
  const loadTodayData = async () => {
    setLoading(true);
    try {
      const todayStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(new Date());
      const now = new Date().toISOString().split('T')[0];

      const savedHoliday = localStorage.getItem('today_holiday_' + now) === 'true';
      setIsHolidayToday(savedHoliday);

      const [ttRes, attRes, subRes] = await Promise.all([
        api.get(`/timetable/today?day=${todayStr}&timezone=Asia/Kolkata`).catch(() => ({ data: { schedule: null } })),
        api.get(`/attendance?date=${now}`).catch(() => ({ data: { records: [] } })),
        api.get('/subjects').catch(() => ({ data: { subjects: [] } }))
      ]);

      const sched = ttRes.data?.schedule;
      setScheduleData(sched);
      setSubjects(subRes.data?.subjects || []);

      const recMap = {};
      const repMap = {};
      (attRes.data?.records || []).forEach(r => {
        recMap[r.periodNumber] = r;
        if (r.status === 'substitute') {
          repMap[r.periodNumber] = {
            subId: r.replacementSubjectId?._id || r.replacementSubjectId || '',
            attendance: r.replacementAttendance || 'present'
          };
        }
      });
      setRecords(recMap);
      setReplacementStates(repMap);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load today schedule');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTodayData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const scheduledPeriods = (scheduleData?.periods || []).filter(p => p.subjectName);
  const scheduledNums = new Set(scheduledPeriods.map(p => p.periodNumber));

  // Combine scheduled periods with any genuine extra periods recorded today
  const extraPeriods = Object.values(records)
    .filter(r => r && r.periodNumber && !scheduledNums.has(r.periodNumber) && r.isExtra === true)
    .map(r => ({
      periodNumber: r.periodNumber,
      subjectName: r.subjectId?.name || subjects.find(s => String(s._id) === String(r.subjectId?._id || r.subjectId))?.name || 'Extra Class',
      subjectId: r.subjectId?._id || r.subjectId,
      startTime: r.startTime || '16:00',
      endTime: r.endTime || '17:00',
      isExtra: true
    }));

  const periods = [...scheduledPeriods, ...extraPeriods].sort((a, b) => a.periodNumber - b.periodNumber);

  // Add Extra Class: Counts into attendance + triggers auto-mute during that time!
  const handleAddExtraClass = async () => {
    if (!extraSubId) {
      toast.error('Please select a subject for the extra lecture');
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      const res = await api.post('/attendance/extra-class', {
        subjectId: extraSubId,
        periodNumber: extraPeriodNum,
        date: now,
        status: extraStatus,
        startTime: extraStartTime,
        endTime: extraEndTime,
        notes: 'Faculty extra lecture'
      });

      const subName = subjects.find(s => String(s._id) === String(extraSubId))?.name || 'Extra Class';
      if (extraStatus === 'absent' || extraStatus === 'cancelled') {
        await backgroundSentinel.markBunk(extraPeriodNum, now, subName);
      } else {
        await backgroundSentinel.markPresent(extraPeriodNum, now, subName);
      }

      window.dispatchEvent(new CustomEvent('attendance-updated'));
      toast.success(res.data.message || `Extra class (${subName}) recorded! Attendance counted ✅`);

      setShowAddExtra(false);
      setExtraSubId('');
      await loadTodayData();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record extra class');
    } finally {
      setSaving(false);
    }
  };

  // 1-Tap Fast Track: Mark all attended
  const handleMarkAllAttended = async () => {
    if (periods.length === 0) return;
    setSaving(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      const newRecs = { ...records };

      for (const p of periods) {
        const subId = p.subjectId?._id || p.subjectId;
        await api.post('/attendance/mark', {
          subjectId: subId,
          date: now,
          periodNumber: p.periodNumber,
          status: 'present'
        });
        newRecs[p.periodNumber] = { ...newRecs[p.periodNumber], status: 'present' };
        localStorage.removeItem('bunked_' + now + '_P' + p.periodNumber);
        localStorage.setItem('present_' + now + '_P' + p.periodNumber, 'true');
      }

      setRecords(newRecs);
      setReplacementStates({});
      setIsHolidayToday(false);
      localStorage.removeItem('today_holiday_' + now);
      localStorage.setItem('wrapup_done_' + now, 'true');

      await backgroundSentinel.evaluate();
      window.dispatchEvent(new CustomEvent('attendance-updated'));

      toast.success('All scheduled classes marked attended! 🎉');
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Failed to mark all attended');
    } finally {
      setSaving(false);
    }
  };

  // 1-Tap Holiday
  const handleMarkHoliday = async () => {
    if (periods.length === 0) return;
    setSaving(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      const newRecs = { ...records };

      for (const p of periods) {
        const subId = p.subjectId?._id || p.subjectId;
        await api.post('/attendance/mark', {
          subjectId: subId,
          date: now,
          periodNumber: p.periodNumber,
          status: 'cancelled'
        });
        newRecs[p.periodNumber] = { ...newRecs[p.periodNumber], status: 'cancelled' };
      }

      setRecords(newRecs);
      setReplacementStates({});
      setIsHolidayToday(true);
      localStorage.setItem('today_holiday_' + now, 'true');
      localStorage.setItem('wrapup_done_' + now, 'true');

      await backgroundSentinel.unmute('College Holiday');
      window.dispatchEvent(new CustomEvent('attendance-updated'));

      toast.success('Today marked as Holiday! Classes exempted from buffer. 🎉');
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Failed to mark holiday');
    } finally {
      setSaving(false);
    }
  };

  // Restore Classes from Holiday
  const handleRestoreClasses = () => {
    const now = new Date().toISOString().split('T')[0];
    localStorage.removeItem('today_holiday_' + now);
    setIsHolidayToday(false);
    backgroundSentinel.sync();
    window.dispatchEvent(new CustomEvent('attendance-updated'));
    toast.success('Restored timetable schedule for today.');
  };

  // Single-touch status selection
  const handleSetStatus = async (p, status) => {
    setSaving(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      const subId = p.subjectId?._id || p.subjectId;
      const subName = p.subjectName || p.subjectId?.name || 'Class';

      await api.post('/attendance/mark', {
        subjectId: subId,
        date: now,
        periodNumber: p.periodNumber,
        status
      });

      setRecords(prev => ({
        ...prev,
        [p.periodNumber]: { ...prev[p.periodNumber], status }
      }));

      if (status !== 'substitute') {
        setReplacementStates(prev => {
          const next = { ...prev };
          delete next[p.periodNumber];
          return next;
        });
      }

      // Two-Way Sentinel Sync: Mutes on attend, un-mutes on bunk or on-duty
      if (status === 'absent' || status === 'cancelled' || status === 'on_duty') {
        await backgroundSentinel.markBunk(p.periodNumber, now, subName);
      } else if (status === 'present') {
        await backgroundSentinel.markPresent(p.periodNumber, now, subName);
      } else {
        await backgroundSentinel.evaluate();
      }

      window.dispatchEvent(new CustomEvent('attendance-updated'));

      const statusNames = {
        present: 'Attended (Auto-Muted 🔕)',
        absent: 'Bunked (Active Ringer 🔔)',
        on_duty: 'On Duty Leave (Counted + Active Ringer 🔔) 🏅',
        substitute: 'Replacement Subject 🔄',
        cancelled: 'Cancelled / Faculty Leave ⏸️'
      };

      toast.success(`Period ${p.periodNumber}: ${statusNames[status] || status}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Failed to save status');
    } finally {
      setSaving(false);
    }
  };

  // Save replacement
  const handleSaveReplacement = async (p, replacementSubId, replacementAttendance = 'present') => {
    setSaving(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      const subId = p.subjectId?._id || p.subjectId;
      const subName = p.subjectName || p.subjectId?.name || 'Class';

      await api.post('/attendance/mark', {
        subjectId: subId,
        date: now,
        periodNumber: p.periodNumber,
        status: 'substitute',
        replacementSubjectId: replacementSubId,
        replacementAttendance
      });

      setRecords(prev => ({
        ...prev,
        [p.periodNumber]: { ...prev[p.periodNumber], status: 'substitute', replacementAttendance }
      }));

      setReplacementStates(prev => ({
        ...prev,
        [p.periodNumber]: { subId: replacementSubId, attendance: replacementAttendance }
      }));

      if (replacementAttendance === 'absent') {
        await backgroundSentinel.markBunk(p.periodNumber, now, subName);
        toast.error(`Period ${p.periodNumber}: Replaced by substitute, but BUNKED! (Phone Unmuted 🔔) ❌`);
      } else {
        await backgroundSentinel.markPresent(p.periodNumber, now, subName);
        toast.success(`Period ${p.periodNumber} marked replaced & attended! (Phone Muted 🔕) ✅`);
      }
      window.dispatchEvent(new CustomEvent('attendance-updated'));

      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Failed to save replacement');
    } finally {
      setSaving(false);
    }
  };

  // Safe bunks map
  const subjectBunkMap = {};
  subjects.forEach(s => {
    const target = (s.targetPercentage || 75) / 100;
    const safeBunks = Math.max(0, Math.floor(s.attendedClasses / target) - s.totalClasses);
    subjectBunkMap[s._id] = safeBunks;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xl animate-[fadeIn_0.2s_ease-out]">
      <div className={`w-full max-w-xl rounded-[32px] p-5 sm:p-7 shadow-2xl flex flex-col max-h-[92vh] animate-[slideUp_0.25s_ease-out] border relative overflow-hidden transition-all ${
        isDark
          ? 'bg-gradient-to-b from-[#0e1422] to-[#070a12] border-blue-500/30 text-white shadow-blue-950/50'
          : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
      }`}>

        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/4 right-1/4 h-24 bg-blue-500/15 blur-3xl pointer-events-none rounded-full" />

        {/* Header Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 flex-shrink-0">
              <Zap size={22} className="fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg sm:text-xl tracking-tight">
                  Lightning Attendance
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Instant Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                One-tap reconciliation for classes, labs & auto-silent ringer.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-90"
          >
            <X size={17} />
          </button>
        </div>

        {/* Modern Action Bar */}
        {!isHolidayToday && (
          <div className="grid grid-cols-3 gap-2 my-3.5 relative z-10">
            {/* Mark All Attended */}
            <button
              onClick={handleMarkAllAttended}
              disabled={saving}
              className="py-2.5 px-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check size={15} />
              <span>All Attended</span>
            </button>

            {/* Holiday Toggle */}
            <button
              onClick={handleMarkHoliday}
              disabled={saving}
              className={`py-2.5 px-2 rounded-2xl font-black text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 border ${
                isDark
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
              }`}
            >
              <Calendar size={14} className="text-amber-400" />
              <span>Day Off</span>
            </button>

            {/* Add Extra Lecture */}
            <button
              onClick={() => setShowAddExtra(!showAddExtra)}
              className="py-2.5 px-2 rounded-2xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 font-black text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Plus size={15} />
              <span>Extra Class</span>
            </button>
          </div>
        )}

        {/* Add Extra Class Sheet */}
        {showAddExtra && (
          <div className="mb-3.5 p-4 rounded-2xl bg-gradient-to-br from-blue-950/40 via-slate-900/60 to-slate-950 border border-blue-500/40 shadow-xl space-y-3 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-blue-400 flex items-center gap-1.5">
                <Plus size={14} /> Add Extra Class / Lab
              </span>
              <button onClick={() => setShowAddExtra(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>

            <div className="space-y-2">
              <select
                value={extraSubId}
                onChange={(e) => setExtraSubId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-white/10 bg-black/40 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Subject...</option>
                {subjects.map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.code || 'Sub'})</option>
                ))}
              </select>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Period #</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={extraPeriodNum}
                    onChange={(e) => setExtraPeriodNum(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono border border-white/10 bg-black/40 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Start Time</label>
                  <input
                    type="time"
                    value={extraStartTime}
                    onChange={(e) => setExtraStartTime(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-xl text-xs font-mono border border-white/10 bg-black/40 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">End Time</label>
                  <input
                    type="time"
                    value={extraEndTime}
                    onChange={(e) => setExtraEndTime(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-xl text-xs font-mono border border-white/10 bg-black/40 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setExtraStatus('present')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-black border transition-all ${
                    extraStatus === 'present'
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-black/20 text-slate-400 border-white/10'
                  }`}
                >
                  Attending (Muted)
                </button>
                <button
                  type="button"
                  onClick={() => setExtraStatus('absent')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-black border transition-all ${
                    extraStatus === 'absent'
                      ? 'bg-rose-600 text-white border-rose-400'
                      : 'bg-black/20 text-slate-400 border-white/10'
                  }`}
                >
                  Bunked (Active)
                </button>
              </div>

              <button
                onClick={handleAddExtraClass}
                disabled={saving}
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                Save Extra Class & Sync Ringer
              </button>
            </div>
          </div>
        )}

        {/* Holiday Active Celebratory Banner */}
        {isHolidayToday && (
          <div className="p-4 mb-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-3 text-amber-300">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="font-black text-xs">Today Marked as College Holiday</p>
                <p className="text-[11px] text-slate-400">Classes exempted from attendance. Ringer is in active mode.</p>
              </div>
            </div>
            <button
              onClick={handleRestoreClasses}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md flex items-center gap-1 active:scale-95"
            >
              <RotateCcw size={12} /> Undo
            </button>
          </div>
        )}

        {/* Period Cards Stack */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1 relative z-10 custom-scrollbar">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
              Syncing live schedule...
            </div>
          ) : periods.length === 0 ? (
            <div className="p-8 text-center rounded-3xl border border-white/10 bg-white/5 space-y-2">
              <Calendar size={36} className="mx-auto text-blue-500 opacity-80" />
              <p className="font-black text-sm">No Classes Scheduled Today</p>
              <p className="text-xs text-slate-400">
                Weekly timetable has no sessions for today. Enjoy your day!
              </p>
            </div>
          ) : (
            periods.map(p => {
              const currentRec = records[p.periodNumber];
              const curStatus = currentRec?.status;
              const repState = replacementStates[p.periodNumber] || {};
              const subId = p.subjectId?._id || p.subjectId;
              const safeBunks = subjectBunkMap[subId] ?? 0;

              const isPresent = curStatus === 'present';
              const isBunked = curStatus === 'absent';
              const isOnDuty = curStatus === 'on_duty';
              const isReplaced = curStatus === 'substitute';
              const isCancelled = curStatus === 'cancelled';

              return (
                <div
                  key={p.periodNumber}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isPresent
                      ? 'bg-emerald-500/5 border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                      : isBunked
                      ? 'bg-rose-500/5 border-rose-500/30 shadow-sm shadow-rose-500/10'
                      : isOnDuty
                      ? 'bg-purple-500/10 border-purple-500/35 shadow-sm shadow-purple-500/10'
                      : isReplaced
                      ? 'bg-blue-500/5 border-blue-500/30'
                      : isCancelled
                      ? 'bg-amber-500/5 border-amber-500/30 opacity-75'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Period Header */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-blue-600 text-white shadow-sm flex-shrink-0">
                        P{p.periodNumber}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-black text-sm truncate">{p.subjectName}</h4>
                          {p.isExtra && (
                            <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Extra
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-slate-400">
                          {p.startTime || '—'} – {p.endTime || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                        safeBunks > 0
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}>
                        {safeBunks > 0 ? `+${safeBunks} Safe` : '0 Safe'}
                      </span>
                    </div>
                  </div>

                  {/* Segmented Modern 5-Button Attendance Bar (Present, Bunk, OD, Replace, Off) */}
                  <div className="grid grid-cols-5 gap-1">
                    {/* Attended */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(p, 'present')}
                      disabled={saving}
                      className={`py-2 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all flex items-center justify-center gap-0.5 active:scale-95 ${
                        isPresent
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/40 border border-emerald-400'
                          : 'bg-black/20 hover:bg-black/30 text-slate-300 border border-white/5'
                      }`}
                    >
                      <Check size={12} className={isPresent ? 'text-white' : 'text-emerald-400'} />
                      <span>Present</span>
                    </button>

                    {/* Bunked */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(p, 'absent')}
                      disabled={saving}
                      className={`py-2 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all flex items-center justify-center gap-0.5 active:scale-95 ${
                        isBunked
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/40 border border-rose-400'
                          : 'bg-black/20 hover:bg-black/30 text-slate-300 border border-white/5'
                      }`}
                    >
                      <X size={12} className={isBunked ? 'text-white' : 'text-rose-400'} />
                      <span>Bunk</span>
                    </button>

                    {/* On Duty (OD) */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(p, 'on_duty')}
                      disabled={saving}
                      title="On Duty Leave: Attendance counted + phone stays on active ringer"
                      className={`py-2 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all flex items-center justify-center gap-0.5 active:scale-95 ${
                        isOnDuty
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40 border border-purple-400'
                          : 'bg-purple-950/20 hover:bg-purple-900/30 text-purple-300 border border-purple-500/20'
                      }`}
                    >
                      <Award size={12} className={isOnDuty ? 'text-white' : 'text-purple-400'} />
                      <span>OD</span>
                    </button>

                    {/* Replaced */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(p, 'substitute')}
                      disabled={saving}
                      className={`py-2 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all flex items-center justify-center gap-0.5 active:scale-95 ${
                        isReplaced
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/40 border border-blue-400'
                          : 'bg-black/20 hover:bg-black/30 text-slate-300 border border-white/5'
                      }`}
                    >
                      <RefreshCw size={11} className={isReplaced ? 'text-white' : 'text-blue-400'} />
                      <span>Replace</span>
                    </button>

                    {/* Off / Cancelled */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(p, 'cancelled')}
                      disabled={saving}
                      className={`py-2 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all flex items-center justify-center gap-0.5 active:scale-95 ${
                        isCancelled
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-600/40 border border-amber-400'
                          : 'bg-black/20 hover:bg-black/30 text-slate-300 border border-white/5'
                      }`}
                    >
                      <Ban size={11} className={isCancelled ? 'text-white' : 'text-amber-400'} />
                      <span>Off</span>
                    </button>
                  </div>

                  {/* Inline Substitute Selector if Replaced is chosen */}
                  {isReplaced && (
                    <div className="mt-2.5 pt-2 border-t border-white/10 space-y-2 animate-[fadeIn_0.15s_ease-out]">
                      <p className="text-[11px] font-bold text-blue-400">Who substituted this lecture?</p>
                      <select
                        value={repState.subId || ''}
                        onChange={(e) => handleSaveReplacement(p, e.target.value, repState.attendance || 'present')}
                        className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-white/10 bg-black/40 text-white focus:outline-none"
                      >
                        <option value="">Select substitute subject...</option>
                        {subjects.map(s => (
                          <option key={s._id} value={s._id}>{s.name}</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveReplacement(p, repState.subId, 'present')}
                          className={`flex-1 py-1 rounded-xl text-[10px] font-black border transition-all ${
                            repState.attendance !== 'absent'
                              ? 'bg-emerald-600 text-white border-emerald-400'
                              : 'bg-black/30 text-slate-400 border-white/10'
                          }`}
                        >
                          Attended Replacement
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveReplacement(p, repState.subId, 'absent')}
                          className={`flex-1 py-1 rounded-xl text-[10px] font-black border transition-all ${
                            repState.attendance === 'absent'
                              ? 'bg-rose-600 text-white border-rose-400'
                              : 'bg-black/30 text-slate-400 border-white/10'
                          }`}
                        >
                          Bunked Replacement
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between relative z-10">
          <p className="text-[11px] text-slate-400 font-medium">
            Mutes phone during active lecture • Unmutes on bunk
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md shadow-blue-600/30 transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import {
  CheckCircle2, XCircle, RefreshCw, X, Check,
  Zap, Clock, ShieldCheck, AlertTriangle, ArrowRight,
  BookOpen, ChevronRight, Calendar, Slash, RotateCcw, Plus, Trash2
} from 'lucide-react';

export default function DailyWrapUpModal({ isOpen, onClose, onRefresh }) {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [records, setRecords] = useState({});
  const [replacementStates, setReplacementStates] = useState({}); // { [periodNumber]: { subId: string } }
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

      // Check if user previously marked today as a holiday
      const savedHoliday = localStorage.getItem('today_holiday_' + now) === 'true';
      setIsHolidayToday(savedHoliday);

      const [ttRes, attRes, subRes] = await Promise.all([
        api.get(`/timetable/today?day=${todayStr}&timezone=Asia/Kolkata`),
        api.get(`/attendance?date=${now}`),
        api.get('/subjects')
      ]);

      const sched = ttRes.data.schedule;
      setScheduleData(sched);
      setSubjects(subRes.data.subjects || []);

      // Index records by periodNumber
      const recMap = {};
      const repMap = {};
      (attRes.data.records || []).forEach(r => {
        recMap[r.periodNumber] = r;
        if (r.status === 'substitute') {
          repMap[r.periodNumber] = {
            subId: r.replacementSubjectId?._id || r.replacementSubjectId || '',
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

  // Combine scheduled periods with any extra periods recorded today
  const extraPeriods = Object.values(records)
    .filter(r => r && r.periodNumber && !scheduledNums.has(r.periodNumber))
    .map(r => ({
      periodNumber: r.periodNumber,
      subjectName: r.subjectId?.name || subjects.find(s => String(s._id) === String(r.subjectId?._id || r.subjectId))?.name || 'Extra Class',
      subjectId: r.subjectId?._id || r.subjectId,
      isExtra: true
    }));

  const periods = [...scheduledPeriods, ...extraPeriods].sort((a, b) => a.periodNumber - b.periodNumber);

  const handleAddExtraClass = async () => {
    if (!extraSubId) {
      toast.error('Please choose a subject for the extra class');
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
      toast.success(res.data.message || `Extra class (${subName}) recorded as ${extraStatus}! 🎓`);

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

  // 1-Tap "Mark All Attended"
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
      }

      setRecords(newRecs);
      setReplacementStates({});
      setIsHolidayToday(false);
      localStorage.removeItem('today_holiday_' + now);
      localStorage.setItem('wrapup_done_' + now, 'true');

      toast.success('All scheduled classes marked attended! 🎉');
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Failed to mark all attended');
    } finally {
      setSaving(false);
    }
  };

  // 1-Tap "Mark Today as Holiday / Off"
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

      toast.success('Today marked as Holiday! Classes exempted from attendance. 🎉');
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
    toast.success('Restored timetable schedule for today.');
  };

  // Single-Choice Status: ONLY ONE CAN BE ACTIVE
  const handleSetStatus = async (p, status) => {
    setSaving(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      const subId = p.subjectId?._id || p.subjectId;

      await api.post('/attendance/mark', {
        subjectId: subId,
        date: now,
        periodNumber: p.periodNumber,
        status
      });

      // Update records with single status
      setRecords(prev => ({
        ...prev,
        [p.periodNumber]: { ...prev[p.periodNumber], status }
      }));

      // If switching away from substitute, clear replacement
      if (status !== 'substitute') {
        setReplacementStates(prev => {
          const next = { ...prev };
          delete next[p.periodNumber];
          return next;
        });
      }

      const statusNames = {
        present: 'Present ✅',
        absent: 'Bunked ❌',
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

  // Save replacement class (with option for Attended or Bunked substitute)
  const handleSaveReplacement = async (p, replacementSubId, replacementAttendance = 'present') => {
    setSaving(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      const subId = p.subjectId?._id || p.subjectId;

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
        toast.error(`Period ${p.periodNumber}: Replaced by substitute, but BUNKED! (Absence logged for substitute) ❌`);
      } else {
        toast.success(`Period ${p.periodNumber} marked replaced & attended! ✅`);
      }

      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Failed to save replacement');
    } finally {
      setSaving(false);
    }
  };

  // Calculate deterministic safe bunks for subjects
  const subjectBunkMap = {};
  subjects.forEach(s => {
    const target = (s.targetPercentage || 75) / 100;
    const safeBunks = Math.max(0, Math.floor(s.attendedClasses / target) - s.totalClasses);
    subjectBunkMap[s._id] = safeBunks;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
      <div className={`w-full max-w-lg rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] animate-[slideUp_0.3s_ease-out] border transition-colors ${
        isDark ? 'bg-[#0e1219] border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/60'
      }`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between pb-3.5 mb-3 border-b ${
          isDark ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              isDark ? 'bg-blue-600/25 text-blue-400 border border-blue-500/40' : 'bg-blue-50 text-blue-600 border border-blue-200'
            }`}>
              <Zap size={22} className={isDark ? 'fill-blue-400' : 'fill-blue-600'} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-extrabold text-base sm:text-lg tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  Daily Attendance Reconciliation
                </h3>
              </div>
              <p className={`text-xs mt-0.5 ${
                isDark ? 'text-slate-300' : 'text-slate-500'
              }`}>
                Were today's classes taken, cancelled, or replaced?
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isDark ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* 1-Tap Fast Track & Holiday Banner */}
        {periods.length > 0 && !isHolidayToday && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {/* Mark All Attended */}
            <button
              onClick={handleMarkAllAttended}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 py-3 px-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              <Check size={16} /> Mark All Attended
            </button>

            {/* Holiday Option */}
            <button
              onClick={handleMarkHoliday}
              disabled={saving}
              className={`flex items-center justify-center gap-1.5 py-3 px-2 rounded-2xl active:scale-95 font-extrabold text-xs shadow-md transition-all disabled:opacity-50 border ${
                isDark
                  ? 'bg-[#1b2234] hover:bg-[#25304a] text-amber-300 border-amber-500/50'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
              }`}
            >
              <Calendar size={16} className={isDark ? 'text-amber-400' : 'text-amber-600'} /> Today is Holiday
            </button>
          </div>
        )}

        {/* Holiday Active Celebratory Card */}
        {isHolidayToday && (
          <div className={`p-4 mb-3 rounded-2xl flex items-center justify-between gap-3 animate-[fadeIn_0.2s_ease-out] border ${
            isDark ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className="text-2xl">🎉</div>
              <div>
                <p className="font-extrabold text-xs">Today Marked as College Holiday</p>
                <p className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Classes exempted with zero impact on attendance buffer.</p>
              </div>
            </div>
            <button
              onClick={handleRestoreClasses}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md whitespace-nowrap active:scale-95"
            >
              <RotateCcw size={12} /> Undo
            </button>
          </div>
        )}

        {/* Period Checklist */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
          {loading ? (
            <div className={`p-8 text-center text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Loading today's schedule...
            </div>
          ) : periods.length === 0 ? (
            <div className={`p-8 text-center rounded-2xl border space-y-2 ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <Calendar size={36} className="mx-auto text-blue-500 opacity-80" />
              <p className="font-extrabold text-sm">No Classes Scheduled Today!</p>
              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                According to your weekly timetable, today is a free day or holiday. Enjoy your time! 🎉
              </p>
            </div>
          ) : (
            periods.map(p => {
              const currentRec = records[p.periodNumber];
              const curStatus = currentRec?.status; // 'present' | 'absent' | 'substitute' | 'cancelled'
              const repState = replacementStates[p.periodNumber] || {};
              const subId = p.subjectId?._id || p.subjectId;
              const safeBunks = subjectBunkMap[subId] ?? 0;

              // Strictly Mutually Exclusive Flags
              const isPresent = curStatus === 'present';
              const isBunked = curStatus === 'absent';
              const isReplaced = curStatus === 'substitute';
              const isCancelled = curStatus === 'cancelled';

              return (
                <div
                  key={p.periodNumber}
                  className={`p-3.5 rounded-2xl border transition-all space-y-3 shadow-sm ${
                    isDark
                      ? 'bg-[#141924] border-slate-700/80 hover:border-slate-600'
                      : 'bg-slate-50/90 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-blue-600 text-white shadow-sm">
                        P{p.periodNumber}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.subjectName}</p>
                          {p.isExtra && (
                            <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30">
                              Extra Class
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] font-mono font-medium ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                          {p.startTime || '—'} - {p.endTime || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                          safeBunks > 0
                            ? isDark
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isDark
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {safeBunks > 0 ? `${safeBunks} safe bunk(s)` : '0 safe bunks'}
                      </span>
                    </div>
                  </div>

                  {/* Strictly Mutually Exclusive Status Selection */}
                  <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                    {/* 1. Present */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(p, 'present')}
                      disabled={saving}
                      className={`py-2 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1 active:scale-95 ${
                        isPresent
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/40 border-2 border-emerald-400 ring-2 ring-emerald-500/20'
                          : isDark
                            ? 'bg-[#1b2232] hover:bg-[#232c40] text-slate-100 border border-slate-700'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-xs'
                      }`}
                    >
                      <Check size={14} className={isPresent ? 'text-white' : 'text-emerald-500'} /> Present
                    </button>

                    {/* 2. Bunked */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(p, 'absent')}
                      disabled={saving}
                      className={`py-2 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1 active:scale-95 ${
                        isBunked
                          ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 border-2 border-rose-400 ring-2 ring-rose-500/20'
                          : isDark
                            ? 'bg-[#1b2232] hover:bg-[#232c40] text-slate-100 border border-slate-700'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-xs'
                      }`}
                    >
                      <X size={14} className={isBunked ? 'text-white' : 'text-rose-500'} /> Bunked
                    </button>

                    {/* 3. Replaced */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(p, 'substitute')}
                      disabled={saving}
                      className={`py-2 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1 active:scale-95 ${
                        isReplaced
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 border-2 border-blue-400 ring-2 ring-blue-500/20'
                          : isDark
                            ? 'bg-[#1b2232] hover:bg-[#232c40] text-slate-100 border border-slate-700'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-xs'
                      }`}
                    >
                      <RefreshCw size={13} className={isReplaced ? 'text-white' : 'text-blue-500'} /> Replaced
                    </button>

                    {/* 4. Cancelled */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(p, 'cancelled')}
                      disabled={saving}
                      className={`py-2 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1 active:scale-95 ${
                        isCancelled
                          ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/40 border-2 border-amber-400 ring-2 ring-amber-500/20'
                          : isDark
                            ? 'bg-[#1b2232] hover:bg-[#232c40] text-slate-100 border border-slate-700'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-xs'
                      }`}
                    >
                      <Slash size={13} className={isCancelled ? 'text-white' : 'text-amber-500'} /> Cancelled
                    </button>
                  </div>

                  {/* Inline Replacement Selector (Only shown if Replaced is chosen) */}
                  {isReplaced && (
                    <div className={`p-3.5 rounded-2xl border space-y-2.5 mt-2 animate-[fadeIn_0.2s_ease-out] ${
                      isDark ? 'bg-blue-600/15 border-blue-500/40 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-900'
                    }`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black">
                          Which subject took Period {p.periodNumber}?
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          Substitution
                        </span>
                      </div>
                      <select
                        value={repState.subId || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) handleSaveReplacement(p, val, repState.attendance || 'present');
                        }}
                        className={`w-full rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 border ${
                          isDark ? 'bg-[#0a0d14] border-blue-500/60 text-white' : 'bg-white border-blue-300 text-slate-900 shadow-xs'
                        }`}
                      >
                        <option value="">-- Choose Replacement Subject (e.g. Maths) --</option>
                        {subjects.filter(s => (s._id || s.id) !== subId).map(s => (
                          <option key={s._id} value={s._id}>
                            {s.name} ({s.code || 'Class'})
                          </option>
                        ))}
                      </select>

                      {/* Did you attend or bunk this replacement class? */}
                      {repState.subId && (
                        <div className="pt-1.5 border-t border-blue-500/20 space-y-1.5">
                          <p className="text-[11px] font-bold text-slate-400">
                            Did you attend or bunk this replacement class?
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveReplacement(p, repState.subId, 'present')}
                              className={`py-2 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                                (repState.attendance || 'present') === 'present'
                                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30 border border-emerald-400'
                                  : isDark ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border'
                              }`}
                            >
                              <Check size={14} /> Attended Substitute
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveReplacement(p, repState.subId, 'absent')}
                              className={`py-2 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                                repState.attendance === 'absent'
                                  ? 'bg-rose-600 text-white shadow-md shadow-rose-500/30 border border-rose-400'
                                  : isDark ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border'
                              }`}
                            >
                              <X size={14} /> Replaced but Bunked!
                            </button>
                          </div>
                          {repState.attendance === 'absent' && (
                            <p className="text-[10px] text-rose-400 font-bold bg-rose-500/10 p-1.5 rounded-lg border border-rose-500/20">
                              ⚠️ Absence recorded for substitute subject
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Extra Class Section (e.g. Period 6, Remedial / Extra Faculty Lecture) */}
        <div className={`mt-2 pt-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {!showAddExtra ? (
            <button
              type="button"
              onClick={() => {
                const nextPeriod = periods.length > 0 ? Math.max(...periods.map(p => p.periodNumber)) + 1 : 1;
                setExtraPeriodNum(nextPeriod);
                setShowAddExtra(true);
              }}
              className="w-full py-2.5 px-3 rounded-2xl border border-dashed border-blue-500/50 hover:border-blue-500 text-blue-500 hover:bg-blue-500/10 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Plus size={15} />
              <span>➕ Add Extra Class (e.g. Period 6, Remedial / Special Lecture)</span>
            </button>
          ) : (
            <div className={`p-3.5 rounded-2xl border space-y-3 animate-[fadeIn_0.2s_ease-out] ${
              isDark ? 'bg-[#151c28] border-blue-500/40' : 'bg-blue-50/70 border-blue-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black flex items-center gap-1.5 text-blue-500">
                  <Zap size={14} className="fill-blue-500" />
                  Add Extra Class / Period
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddExtra(false)}
                  className={`p-1 rounded-lg ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-black'}`}
                >
                  <X size={15} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-slate-400">
                    Subject
                  </label>
                  <select
                    value={extraSubId}
                    onChange={(e) => setExtraSubId(e.target.value)}
                    className={`w-full rounded-xl p-2 text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDark ? 'bg-[#0a0d14] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                    }`}
                  >
                    <option value="">-- Select Subject --</option>
                    {subjects.map(s => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.code || 'Class'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-slate-400">
                    Period Number
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="15"
                      value={extraPeriodNum}
                      onChange={(e) => setExtraPeriodNum(Number(e.target.value))}
                      className={`w-full rounded-xl p-2 text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isDark ? 'bg-[#0a0d14] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                      }`}
                    />
                    <span className="text-xs font-mono font-bold text-blue-400 whitespace-nowrap">
                      P{extraPeriodNum}
                    </span>
                  </div>
                </div>
              </div>

              {/* Extra Class Time Interval */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-slate-400">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={extraStartTime}
                    onChange={(e) => setExtraStartTime(e.target.value)}
                    className={`w-full rounded-xl p-2 text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDark ? 'bg-[#0a0d14] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-slate-400">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={extraEndTime}
                    onChange={(e) => setExtraEndTime(e.target.value)}
                    className={`w-full rounded-xl p-2 text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDark ? 'bg-[#0a0d14] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-slate-400">
                  Status
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'present', label: '✓ Attended', color: 'bg-emerald-600' },
                    { id: 'absent', label: '✕ Bunked', color: 'bg-red-600' },
                    { id: 'substitute', label: '🔄 Swapped', color: 'bg-blue-600' },
                    { id: 'cancelled', label: '🚫 Cancelled', color: 'bg-amber-600' }
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setExtraStatus(st.id)}
                      className={`py-1.5 px-1 rounded-xl text-[11px] font-extrabold border transition-all ${
                        extraStatus === st.id
                          ? `${st.color} text-white border-transparent shadow-sm scale-102`
                          : isDark ? 'bg-slate-800/80 text-slate-400 border-slate-700' : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddExtra(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !extraSubId}
                  onClick={handleAddExtraClass}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-500/30 active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Extra Class'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`pt-3.5 mt-2 border-t flex items-center justify-between gap-3 ${
          isDark ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <p className={`text-xs font-medium ${
            isDark ? 'text-slate-300' : 'text-slate-500'
          }`}>
            Attendance auto-updates into your subject buffers.
          </p>
          <button
            onClick={() => {
              const now = new Date().toISOString().split('T')[0];
              localStorage.setItem('wrapup_done_' + now, 'true');
              onClose();
            }}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/30 transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

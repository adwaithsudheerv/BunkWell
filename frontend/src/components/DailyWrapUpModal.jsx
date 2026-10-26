import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  CheckCircle2, XCircle, RefreshCw, X, Check,
  Zap, Clock, ShieldCheck, AlertTriangle, ArrowRight,
  BookOpen, ChevronRight, Calendar, Slash, RotateCcw
} from 'lucide-react';

export default function DailyWrapUpModal({ isOpen, onClose, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [records, setRecords] = useState({});
  const [replacementStates, setReplacementStates] = useState({}); // { [periodNumber]: { subId: string } }
  const [isHolidayToday, setIsHolidayToday] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const periods = (scheduleData?.periods || []).filter(p => p.subjectName);

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

  // Save replacement class
  const handleSaveReplacement = async (p, replacementSubId) => {
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
        replacementAttendance: 'present'
      });

      setRecords(prev => ({
        ...prev,
        [p.periodNumber]: { ...prev[p.periodNumber], status: 'substitute' }
      }));

      setReplacementStates(prev => ({
        ...prev,
        [p.periodNumber]: { subId: replacementSubId }
      }));

      toast.success(`Period ${p.periodNumber} marked replaced by substitute subject! ✅`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full max-w-lg bg-[#0e1219] border border-slate-700/80 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] animate-[slideUp_0.3s_ease-out]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/25 text-blue-400 border border-blue-500/40 flex items-center justify-center flex-shrink-0">
              <Zap size={22} className="fill-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                  Daily Attendance Reconciliation
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Were today's classes taken, cancelled, or replaced?
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
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
              className="flex items-center justify-center gap-1.5 py-3 px-2 rounded-2xl bg-[#1b2234] hover:bg-[#25304a] active:scale-95 text-amber-300 border border-amber-500/50 font-extrabold text-xs shadow-md transition-all disabled:opacity-50"
            >
              <Calendar size={16} className="text-amber-400" /> Today is Holiday
            </button>
          </div>
        )}

        {/* Holiday Active Celebratory Card */}
        {isHolidayToday && (
          <div className="p-4 mb-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between gap-3 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center gap-2.5">
              <div className="text-2xl">🎉</div>
              <div>
                <p className="font-extrabold text-xs text-amber-300">Today Marked as College Holiday</p>
                <p className="text-[11px] text-slate-300">Classes exempted with zero impact on attendance buffer.</p>
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
            <div className="p-8 text-center text-slate-400 text-xs">
              Loading today's schedule...
            </div>
          ) : periods.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <Calendar size={36} className="mx-auto text-blue-400 opacity-70" />
              <p className="font-extrabold text-sm text-white">No Classes Scheduled Today!</p>
              <p className="text-xs text-slate-300">
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
                  className="p-3.5 rounded-2xl bg-[#141924] border border-slate-700/80 hover:border-slate-600 transition-all space-y-3 shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-blue-600 text-white shadow-sm">
                        P{p.periodNumber}
                      </span>
                      <div>
                        <p className="font-black text-sm text-white">{p.subjectName}</p>
                        <p className="text-[11px] text-slate-300 font-mono font-medium">
                          {p.startTime || '—'} - {p.endTime || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                          safeBunks > 0
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
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
                          : 'bg-[#1b2232] hover:bg-[#232c40] text-slate-100 border border-slate-700'
                      }`}
                    >
                      <Check size={14} className={isPresent ? 'text-white' : 'text-emerald-400'} /> Present
                    </button>

                    {/* 2. Bunked */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(p, 'absent')}
                      disabled={saving}
                      className={`py-2 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1 active:scale-95 ${
                        isBunked
                          ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 border-2 border-rose-400 ring-2 ring-rose-500/20'
                          : 'bg-[#1b2232] hover:bg-[#232c40] text-slate-100 border border-slate-700'
                      }`}
                    >
                      <X size={14} className={isBunked ? 'text-white' : 'text-rose-400'} /> Bunked
                    </button>

                    {/* 3. Replaced */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(p, 'substitute')}
                      disabled={saving}
                      className={`py-2 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1 active:scale-95 ${
                        isReplaced
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 border-2 border-blue-400 ring-2 ring-blue-500/20'
                          : 'bg-[#1b2232] hover:bg-[#232c40] text-slate-100 border border-slate-700'
                      }`}
                    >
                      <RefreshCw size={13} className={isReplaced ? 'text-white' : 'text-blue-400'} /> Replaced
                    </button>

                    {/* 4. Cancelled */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(p, 'cancelled')}
                      disabled={saving}
                      className={`py-2 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1 active:scale-95 ${
                        isCancelled
                          ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/40 border-2 border-amber-400 ring-2 ring-amber-500/20'
                          : 'bg-[#1b2232] hover:bg-[#232c40] text-slate-100 border border-slate-700'
                      }`}
                    >
                      <Slash size={13} className={isCancelled ? 'text-white' : 'text-amber-400'} /> Cancelled
                    </button>
                  </div>

                  {/* Inline Replacement Selector (Only shown if Replaced is chosen) */}
                  {isReplaced && (
                    <div className="p-3 rounded-xl bg-blue-600/15 border border-blue-500/40 space-y-2 mt-2 animate-[fadeIn_0.2s_ease-out]">
                      <p className="text-xs font-extrabold text-blue-300">
                        Which subject took Period {p.periodNumber}?
                      </p>
                      <select
                        value={repState.subId || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) handleSaveReplacement(p, val);
                        }}
                        className="w-full bg-[#0a0d14] border border-blue-500/60 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="">-- Choose Replacement Subject --</option>
                        {subjects.filter(s => (s._id || s.id) !== subId).map(s => (
                          <option key={s._id} value={s._id}>
                            {s.name} ({s.code || 'Class'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3.5 mt-2 border-t border-slate-800 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-300 font-medium">
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

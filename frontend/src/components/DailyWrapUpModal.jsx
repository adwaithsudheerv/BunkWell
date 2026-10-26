import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  CheckCircle2, XCircle, RefreshCw, X, Check,
  Zap, Clock, ShieldCheck, AlertTriangle, ArrowRight,
  BookOpen, ChevronRight, Calendar
} from 'lucide-react';

export default function DailyWrapUpModal({ isOpen, onClose, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [records, setRecords] = useState({});
  const [replacementStates, setReplacementStates] = useState({}); // { [periodNumber]: { isReplaced, subId, newSubName } }
  const [saving, setSaving] = useState(false);

  // Load today's schedule, attendance records, and subjects
  const loadTodayData = async () => {
    setLoading(true);
    try {
      const todayStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(new Date());
      const now = new Date().toISOString().split('T')[0];

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
            isReplaced: true,
            subId: r.replacementSubjectId?._id || r.replacementSubjectId || '',
            newSubName: r.replacementSubjectName || ''
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
      for (const p of periods) {
        const subId = p.subjectId?._id || p.subjectId;
        await api.post('/attendance/mark', {
          subjectId: subId,
          date: now,
          periodNumber: p.periodNumber,
          status: 'present'
        });
      }

      toast.success('All scheduled classes marked attended! 🎉');
      localStorage.setItem('wrapup_done_' + now, 'true');
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      toast.error('Failed to mark all attended');
    } finally {
      setSaving(false);
    }
  };

  // Mark single period status
  const handleMarkPeriod = async (p, status) => {
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

      // Update local state
      setRecords(prev => ({
        ...prev,
        [p.periodNumber]: { ...prev[p.periodNumber], status }
      }));

      toast.success(`Period ${p.periodNumber} marked as ${status} ✅`);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Failed to record status');
    } finally {
      setSaving(false);
    }
  };

  // Save replacement class
  const handleSaveReplacement = async (p, replacementSubId, newName) => {
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
        newSubjectName: newName,
        replacementAttendance: 'present'
      });

      setRecords(prev => ({
        ...prev,
        [p.periodNumber]: { ...prev[p.periodNumber], status: 'substitute' }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full max-w-lg bg-[#0b0e14] border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[90vh] animate-[slideUp_0.3s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Zap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                  Daily Attendance Reconciliation
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  Evening Wrap-Up
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Were today's classes taken as scheduled, cancelled, or replaced?
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 1-Tap Quick Action */}
        {periods.length > 0 && (
          <div className="p-3 mb-3 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-blue-500/10 to-transparent border border-emerald-500/25 flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-xs text-emerald-300">Fast Track</p>
              <p className="text-[11px] text-slate-300">All {periods.length} periods taken normally?</p>
            </div>
            <button
              onClick={handleMarkAllAttended}
              disabled={saving}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 active:scale-95 transition-all whitespace-nowrap disabled:opacity-50"
            >
              <Check size={14} /> Mark All Attended
            </button>
          </div>
        )}

        {/* Period Checklist */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Loading today's schedule...
            </div>
          ) : periods.length === 0 ? (
            <div className="p-8 text-center glass-card rounded-2xl border border-white/10 space-y-2">
              <Calendar size={32} className="mx-auto text-blue-400 opacity-60" />
              <p className="font-bold text-sm text-white">No Classes Today!</p>
              <p className="text-xs text-slate-400">
                According to your weekly timetable, today is a free day or holiday. Enjoy your time! 🎉
              </p>
            </div>
          ) : (
            periods.map(p => {
              const currentRec = records[p.periodNumber];
              const curStatus = currentRec?.status || 'not_marked';
              const repState = replacementStates[p.periodNumber] || {};
              const subId = p.subjectId?._id || p.subjectId;
              const safeBunks = subjectBunkMap[subId] ?? 0;

              return (
                <div
                  key={p.periodNumber}
                  className="p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        P{p.periodNumber}
                      </span>
                      <div>
                        <p className="font-bold text-xs text-white">{p.subjectName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {p.startTime || '—'} - {p.endTime || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          safeBunks > 0
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {safeBunks > 0 ? `${safeBunks} safe bunk(s)` : '0 safe bunks'}
                      </span>
                    </div>
                  </div>

                  {/* Status Options */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    <button
                      onClick={() => handleMarkPeriod(p, 'present')}
                      disabled={saving}
                      className={`py-1.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                        curStatus === 'present'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'bg-white/5 hover:bg-emerald-600/20 text-slate-300 hover:text-emerald-300 border border-white/10'
                      }`}
                    >
                      <Check size={12} /> Present
                    </button>

                    <button
                      onClick={() => handleMarkPeriod(p, 'absent')}
                      disabled={saving}
                      className={`py-1.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                        curStatus === 'absent'
                          ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                          : 'bg-white/5 hover:bg-red-600/20 text-slate-300 hover:text-red-300 border border-white/10'
                      }`}
                    >
                      <X size={12} /> Bunked
                    </button>

                    <button
                      onClick={() => {
                        setReplacementStates(prev => ({
                          ...prev,
                          [p.periodNumber]: { ...prev[p.periodNumber], isReplaced: !prev[p.periodNumber]?.isReplaced }
                        }));
                      }}
                      className={`py-1.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                        curStatus === 'substitute' || repState.isReplaced
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'bg-white/5 hover:bg-blue-600/20 text-slate-300 hover:text-blue-300 border border-white/10'
                      }`}
                    >
                      <RefreshCw size={12} /> Replaced
                    </button>

                    <button
                      onClick={() => handleMarkPeriod(p, 'cancelled')}
                      disabled={saving}
                      className={`py-1.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                        curStatus === 'cancelled'
                          ? 'bg-slate-600 text-white'
                          : 'bg-white/5 hover:bg-slate-600/20 text-slate-300 hover:text-slate-100 border border-white/10'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Inline Replacement Selector */}
                  {repState.isReplaced && (
                    <div className="p-2.5 rounded-xl bg-blue-600/10 border border-blue-500/30 space-y-2 mt-2">
                      <p className="text-[11px] font-bold text-blue-300">
                        Select which subject took Period {p.periodNumber}:
                      </p>
                      <select
                        value={repState.subId || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReplacementStates(prev => ({
                            ...prev,
                            [p.periodNumber]: { ...prev[p.periodNumber], subId: val }
                          }));
                          if (val) handleSaveReplacement(p, val, '');
                        }}
                        className="w-full bg-[#0b0e14] border border-blue-500/40 rounded-lg p-2 text-xs text-white focus:outline-none"
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
        <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">
            Attendance auto-updates live into your subject records.
          </p>
          <button
            onClick={() => {
              const now = new Date().toISOString().split('T')[0];
              localStorage.setItem('wrapup_done_' + now, 'true');
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import { autoSilentService } from '../lib/classAutoSilent';
import {
  Clock, Check, X, RefreshCw, Slash, ChevronRight,
  BookOpen, AlertCircle, FileText, Sparkles, Send, BellRing, CheckCircle2
} from 'lucide-react';

export default function HourlyLectureHub({ onAttendanceUpdated }) {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const [nextPeriod, setNextPeriod] = useState(null);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [taskType, setTaskType] = useState('assignment');
  const [taskText, setTaskText] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [taskSaved, setTaskSaved] = useState(false);
  const [marking, setMarking] = useState(false);

  // Evaluate current lecture period and next upcoming class
  const loadHourlySchedule = async () => {
    try {
      const now = new Date();
      const todayKey = now.toISOString().split('T')[0];
      const todayStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(now);
      const currentTimeMin = now.getHours() * 60 + now.getMinutes();

      const [ttRes, attRes, subRes] = await Promise.all([
        api.get(`/timetable/today?day=${todayStr}&timezone=Asia/Kolkata`),
        api.get(`/attendance?date=${todayKey}`),
        api.get('/subjects')
      ]);

      const subs = subRes.data?.subjects || [];
      setSubjects(subs);

      const periods = (ttRes.data?.schedule?.periods || []).filter(p => p.subjectName);
      if (periods.length === 0) {
        setLoading(false);
        return;
      }

      const recordsMap = {};
      (attRes.data?.records || []).forEach(r => {
        recordsMap[r.periodNumber] = r;
      });

      // Find current active / just-ended period and the next period
      let cur = null;
      let next = null;

      for (let i = 0; i < periods.length; i++) {
        const p = periods[i];
        if (!p.startTime || !p.endTime) continue;
        const [sh, sm] = p.startTime.split(':').map(Number);
        const [eh, em] = p.endTime.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;

        // Current period: in session or ended within the last 45 minutes
        if (currentTimeMin >= startMin && currentTimeMin <= endMin + 45) {
          cur = p;
          next = periods[i + 1] || null;
          break;
        } else if (currentTimeMin < startMin && !next) {
          next = p;
        }
      }

      // Fallback: If no current period found, take the first period or next period
      if (!cur && periods.length > 0) {
        if (next) {
          const nextIdx = periods.indexOf(next);
          if (nextIdx > 0) cur = periods[nextIdx - 1];
        } else {
          cur = periods[periods.length - 1];
        }
      }

      setCurrentPeriod(cur);
      setNextPeriod(next);
      if (cur) {
        setCurrentRecord(recordsMap[cur.periodNumber] || null);
      }
    } catch (err) {
      console.warn('Hourly schedule load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHourlySchedule();
    const interval = setInterval(loadHourlySchedule, 45 * 1000);
    window.addEventListener('attendance-updated', loadHourlySchedule);
    return () => {
      clearInterval(interval);
      window.removeEventListener('attendance-updated', loadHourlySchedule);
    };
  }, []);

  // Quick 1-tap mark
  const handleMark = async (status) => {
    if (!currentPeriod || marking) return;
    setMarking(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      const subId = currentPeriod.subjectId?._id || currentPeriod.subjectId;

      await api.post('/attendance/mark', {
        subjectId: subId,
        date: now,
        periodNumber: currentPeriod.periodNumber,
        status
      });

      if (status === 'absent' || status === 'cancelled') {
        autoSilentService.markPeriodBunked(currentPeriod.periodNumber, now);
        toast.success(`Period ${currentPeriod.periodNumber} marked Bunked ❌ Phone restored to Active Mode 🔔 (Outside class)`);
      } else {
        toast.success(`Period ${currentPeriod.periodNumber} marked Attended ✅`);
      }

      await loadHourlySchedule();
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch (e) {
      toast.error('Failed to mark attendance');
    } finally {
      setMarking(false);
    }
  };

  // Save Faculty Lecture Debrief & Task/Notes
  const handleSaveDebrief = async (e) => {
    e?.preventDefault();
    if (!currentPeriod || !taskText.trim() || savingTask) return;
    setSavingTask(true);
    try {
      const subId = currentPeriod.subjectId?._id || currentPeriod.subjectId;
      await api.post(`/subjects/${subId}/task`, {
        taskType,
        description: taskText.trim()
      });

      setTaskSaved(true);
      toast.success('Faculty assignment & briefing saved! Will alert before next lecture. 📌');
      setTaskText('');
      setTimeout(() => setTaskSaved(false), 4000);
      await loadHourlySchedule();
    } catch (err) {
      toast.error('Failed to save debrief note');
    } finally {
      setSavingTask(false);
    }
  };

  if (loading || !currentPeriod) return null;

  // Find matching subject object to inspect previous task
  const currentSubObj = subjects.find(s => String(s._id) === String(currentPeriod.subjectId?._id || currentPeriod.subjectId));
  const nextSubObj = nextPeriod ? subjects.find(s => String(s._id) === String(nextPeriod.subjectId?._id || nextPeriod.subjectId)) : null;

  const currentStatus = currentRecord?.status || 'not_marked';
  const isBunked = currentStatus === 'absent';
  const isAttended = currentStatus === 'present';

  return (
    <div className="space-y-3 select-none">
      {/* ======================================================== */}
      {/* 1. CURRENT / JUST-ENDED LECTURE CARD */}
      {/* ======================================================== */}
      <div className={`rounded-3xl p-4 sm:p-5 border shadow-xl transition-all relative overflow-hidden glass-morphic-card ${
        isDark ? 'bg-[#0e141f]/85 border-white/10 text-white' : 'bg-white/90 border-[#e2dcce] text-slate-900 shadow-slate-200'
      }`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Period {currentPeriod.periodNumber} • {currentPeriod.startTime} – {currentPeriod.endTime}
              </span>
              {isBunked && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  Bunked (Active Ringer 🔔)
                </span>
              )}
              {isAttended && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Attended ✅
                </span>
              )}
            </div>
            <h3 className="font-extrabold text-base sm:text-lg mt-1 truncate">
              {currentPeriod.subjectName}
            </h3>
            <p className="text-xs text-slate-400">
              {currentPeriod.room ? `Room ${currentPeriod.room}` : 'Class Session'} • {currentPeriod.facultyName ? `Prof. ${currentPeriod.facultyName}` : 'Faculty Lecture'}
            </p>
          </div>

          {/* Quick Attendance Buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => handleMark('present')}
              disabled={marking}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                isAttended
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
              }`}
              title="Mark Attended"
            >
              <Check size={14} /> <span className="hidden sm:inline">Attended</span>
            </button>
            <button
              onClick={() => handleMark('absent')}
              disabled={marking}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                isBunked
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-500/30'
                  : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30'
              }`}
              title="Bunk Class (Restores Active Mode)"
            >
              <X size={14} /> <span className="hidden sm:inline">Bunk</span>
            </button>
          </div>
        </div>

        {/* FACULTY DEBRIEF: Notes, Homework & Assignment Logger */}
        <div className={`mt-3 pt-3 border-t ${isDark ? 'border-white/10' : 'border-black/5'} space-y-2`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold flex items-center gap-1.5 text-blue-400">
              <FileText size={14} />
              <span>Did faculty assign any notes, homework, or test?</span>
            </p>
            {taskSaved && (
              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 animate-[fadeIn_0.2s]">
                <CheckCircle2 size={12} /> Saved for Next Class
              </span>
            )}
          </div>

          <form onSubmit={handleSaveDebrief} className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'assignment', label: '⚡ Assignment' },
                { id: 'notes', label: '📖 Study Notes' },
                { id: 'test', label: '🎯 Surprise Test' },
                { id: 'custom', label: '✍️ Custom Task' },
              ].map(chip => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setTaskType(chip.id)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all border ${
                    taskType === chip.id
                      ? 'bg-blue-600 text-white border-blue-400 shadow-xs'
                      : isDark
                        ? 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                        : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                placeholder="e.g. Bring record book page 45, submit assignment 2..."
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-black/30 border-white/15 text-white placeholder-slate-500' : 'bg-stone-50 border-stone-300 text-black placeholder-slate-400'
                }`}
              />
              <button
                type="submit"
                disabled={!taskText.trim() || savingTask}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black shadow-md flex items-center gap-1 transition-all"
              >
                <Send size={13} />
                <span>Save</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. NEXT UPCOMING CLASS PREVIEW & MISSION BRIEFING */}
      {/* ======================================================== */}
      {nextPeriod && (
        <div className={`rounded-3xl p-4 border shadow-md transition-all glass-morphic ${
          isDark ? 'bg-[#0a0f18]/80 border-white/10 text-white' : 'bg-[#faf8f5]/85 border-[#e2dcce] text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Clock size={13} />
              <span>Next Up: Period {nextPeriod.periodNumber} ({nextPeriod.startTime} – {nextPeriod.endTime})</span>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPeriod(nextPeriod)}
                className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all flex items-center gap-1"
                title="Focus Next Class Now"
              >
                <span>Skip to Class</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="font-extrabold text-sm sm:text-base">
                {nextPeriod.subjectName}
              </h4>
              <p className="text-[11px] text-slate-400">
                {nextPeriod.facultyName ? `Faculty: ${nextPeriod.facultyName}` : 'Upcoming Lecture'} • {nextPeriod.room ? `Room ${nextPeriod.room}` : 'Classroom'}
              </p>
            </div>

            {/* Quick Action: Bunk Next Class or Mark Free Hour */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const now = new Date().toISOString().split('T')[0];
                  const nextSubId = nextPeriod.subjectId?._id || nextPeriod.subjectId;
                  api.post('/attendance/mark', {
                    subjectId: nextSubId,
                    date: now,
                    periodNumber: nextPeriod.periodNumber,
                    status: 'cancelled'
                  }).then(() => {
                    autoSilentService.markPeriodBunked(nextPeriod.periodNumber, now);
                    toast.success(`Period ${nextPeriod.periodNumber} marked Free/Cancelled! Phone stays in active mode.`);
                    loadHourlySchedule();
                    if (onAttendanceUpdated) onAttendanceUpdated();
                  });
                }}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all"
                title="Faculty Absent / Free Hour"
              >
                Free / Cancelled
              </button>
              <button
                onClick={() => {
                  const now = new Date().toISOString().split('T')[0];
                  const nextSubId = nextPeriod.subjectId?._id || nextPeriod.subjectId;
                  api.post('/attendance/mark', {
                    subjectId: nextSubId,
                    date: now,
                    periodNumber: nextPeriod.periodNumber,
                    status: 'absent'
                  }).then(() => {
                    autoSilentService.markPeriodBunked(nextPeriod.periodNumber, now);
                    toast.error(`Pre-bunked Period ${nextPeriod.periodNumber}! Active mode maintained.`);
                    loadHourlySchedule();
                    if (onAttendanceUpdated) onAttendanceUpdated();
                  });
                }}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 transition-all"
                title="Bunk Next Class"
              >
                Bunk Next
              </button>
            </div>
          </div>

          {/* Alert Description from Last Class for This Upcoming Subject */}
          {nextSubObj?.lastTask?.description && (
            <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
              <BellRing size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-extrabold text-amber-400">Briefing from Last Class: </span>
                <span className={isDark ? 'text-amber-200' : 'text-amber-900'}>
                  {nextSubObj.lastTask.description}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

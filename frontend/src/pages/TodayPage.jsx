import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  CheckCircle2, XCircle, Ban, Clock, CalendarDays,
  RefreshCw, Check, Sparkles, ChevronRight, AlertCircle, ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_CONFIG = {
  present: { label: 'Present', color: '#10b981', bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' },
  absent: { label: 'Absent', color: '#ef4444', bg: 'bg-red-500/15 border-red-500/30 text-red-400' },
  substitute: { label: 'Replaced', color: '#0047FF', bg: 'bg-blue-600/15 border-blue-500/30 text-blue-400' },
  cancelled: { label: 'Cancelled', color: '#64748b', bg: 'bg-slate-500/15 border-slate-500/30 text-slate-400' },
  not_marked: { label: 'Pending', color: '#94a3b8', bg: 'bg-white/5 border-white/10 text-slate-400' },
};

function PeriodCard({ period, date, existingRecord, subjects, onMark }) {
  const [status, setStatus] = useState(existingRecord?.status || 'not_marked');
  const [isReplaced, setIsReplaced] = useState(Boolean(existingRecord?.substituteFaculty));
  const [replacementInfo, setReplacementInfo] = useState(existingRecord?.substituteFaculty || '');
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (existingRecord) {
      setStatus(existingRecord.status);
      setReplacementInfo(existingRecord.substituteFaculty || '');
      setIsReplaced(Boolean(existingRecord.substituteFaculty) || existingRecord.status === 'substitute');
    }
  }, [existingRecord]);

  const mark = async (newStatus, customNote = '') => {
    setMarking(true);
    try {
      const subjectId = period.subjectId?._id || period.subjectId;
      await api.post('/attendance/mark', {
        subjectId,
        date,
        periodNumber: period.periodNumber,
        status: newStatus,
        substituteFaculty: customNote || (newStatus === 'substitute' ? replacementInfo : ''),
      });
      setStatus(newStatus);
      toast.success(`Period ${period.periodNumber} marked as ${STATUS_CONFIG[newStatus].label}`);
      if (onMark) onMark();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record attendance');
    } finally {
      setMarking(false);
    }
  };

  const subjectName = period.subjectName || period.subjectId?.name || 'Class';
  const color = period.subjectId?.color || '#0047FF';
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_marked;

  return (
    <div className={`glass-card rounded-2xl p-5 border transition-all duration-200 ${
      status === 'not_marked' ? 'border-white/10' : cfg.bg
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold text-white flex-shrink-0 shadow-sm"
            style={{ background: color }}
          >
            {period.periodNumber}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-base truncate">{subjectName}</h4>
            {period.startTime && (
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                <Clock size={12} className="text-blue-500" /> {period.startTime} – {period.endTime}
              </p>
            )}
          </div>
        </div>

        {/* Current Status Pill */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.bg}`}>
          {status === 'present' && <CheckCircle2 size={13} />}
          {status === 'absent' && <XCircle size={13} />}
          {status === 'substitute' && <RefreshCw size={13} />}
          {status === 'cancelled' && <Ban size={13} />}
          <span>{cfg.label}</span>
        </div>
      </div>

      {/* Direct One-Tap Attendance Buttons */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {/* Present */}
        <button
          onClick={() => mark('present')}
          disabled={marking}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 disabled:opacity-60 ${
            status === 'present'
              ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/25'
              : 'border-white/10 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10'
          }`}
        >
          <CheckCircle2 size={15} /> Present
        </button>

        {/* Absent */}
        <button
          onClick={() => mark('absent')}
          disabled={marking}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 disabled:opacity-60 ${
            status === 'absent'
              ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-500/25'
              : 'border-white/10 text-slate-300 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10'
          }`}
        >
          <XCircle size={15} /> Absent
        </button>

        {/* Replaced */}
        <button
          onClick={() => {
            setIsReplaced(true);
            if (status !== 'substitute') mark('substitute');
          }}
          disabled={marking}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 disabled:opacity-60 ${
            status === 'substitute'
              ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/25'
              : 'border-white/10 text-slate-300 hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-600/10'
          }`}
        >
          <RefreshCw size={14} /> Replaced
        </button>

        {/* Cancelled */}
        <button
          onClick={() => mark('cancelled')}
          disabled={marking}
          className={`col-span-3 sm:col-span-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all active:scale-95 disabled:opacity-60 ${
            status === 'cancelled'
              ? 'bg-slate-600 text-white border-slate-500'
              : 'border-white/10 text-slate-400 hover:border-slate-500/50 hover:text-slate-300 hover:bg-white/5'
          }`}
        >
          <Ban size={14} /> Cancelled
        </button>
      </div>

      {/* If Replaced: provide simple replacement note or substitute details */}
      {isReplaced && (
        <div className="mt-3 p-3 rounded-xl bg-black/20 border border-white/10 space-y-2 animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-1">
              <RefreshCw size={12} /> Class Replacement Details:
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Replaced by DBMS, or Prof. Kumar took class"
              value={replacementInfo}
              onChange={e => setReplacementInfo(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => mark('substitute', replacementInfo)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TodayPage() {
  const [timetable, setTimetable] = useState(null);
  const [daySchedule, setDaySchedule] = useState(null);
  const [todayDay, setTodayDay] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [existingRecords, setExistingRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [showEveningModal, setShowEveningModal] = useState(false);

  // Dynamic local date (YYYY-MM-DD) and weekday name based on user device timezone (not UTC server time)
  const getLocalDateInfo = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    return { dateStr, dayName };
  };

  const { dateStr, dayName: localDayName } = getLocalDateInfo();
  const storageKey = `bunkclub_morning_choice_${dateStr}`;

  // Morning question state: null (not chosen yet) | 'yes' | 'no'
  const [hasClassesToday, setHasClassesToday] = useState(() => {
    return localStorage.getItem(storageKey);
  });

  const isAfter6PM = new Date().getHours() >= 18;

  const loadData = async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      const [ttRes, attRes, subRes] = await Promise.all([
        api.get(`/timetable/today?day=${localDayName}&date=${dateStr}&timezone=${encodeURIComponent(tz)}`),
        api.get(`/attendance?date=${dateStr}`),
        api.get('/subjects'),
      ]);

      setTodayDay(ttRes.data.day || localDayName);
      setDaySchedule(ttRes.data.schedule);
      setTimetable(ttRes.data.timetable);
      setSubjects(subRes.data.subjects || []);

      const recMap = {};
      (attRes.data.records || []).forEach(r => {
        recMap[`${r.subjectId?._id || r.subjectId}-${r.periodNumber}`] = r;
      });
      setExistingRecords(recMap);

      // Check if after 6 PM and some periods are not marked
      const periods = ttRes.data.schedule?.periods || [];
      const unmarked = periods.filter(p => {
        const key = `${p.subjectId?._id || p.subjectId}-${p.periodNumber}`;
        const rec = recMap[key];
        return !rec || rec.status === 'not_marked';
      });

      if (isAfter6PM && unmarked.length > 0 && localStorage.getItem(storageKey) === 'yes') {
        setShowEveningModal(true);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMorningAnswer = (choice) => {
    setHasClassesToday(choice);
    localStorage.setItem(storageKey, choice);
    if (choice === 'no') {
      toast.success('Enjoy your day off! No classes logged today.');
    } else {
      toast.success(`Loading ${todayDay} schedule!`);
    }
  };

  const refetchRecords = async () => {
    try {
      const res = await api.get(`/attendance?date=${dateStr}`);
      const recMap = {};
      (res.data.records || []).forEach(r => {
        recMap[`${r.subjectId?._id || r.subjectId}-${r.periodNumber}`] = r;
      });
      setExistingRecords(recMap);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllEvening = async (defaultStatus = 'present') => {
    const periods = daySchedule?.periods || [];
    let count = 0;
    for (const p of periods) {
      const key = `${p.subjectId?._id || p.subjectId}-${p.periodNumber}`;
      const rec = existingRecords[key];
      if (!rec || rec.status === 'not_marked') {
        try {
          await api.post('/attendance/mark', {
            subjectId: p.subjectId?._id || p.subjectId,
            date: dateStr,
            periodNumber: p.periodNumber,
            status: defaultStatus,
          });
          count++;
        } catch (e) {}
      }
    }
    await refetchRecords();
    setShowEveningModal(false);
    toast.success(`Marked all remaining classes as ${defaultStatus}! ✅`);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-32 rounded-2xl shimmer" />
        <div className="h-44 rounded-2xl shimmer" />
      </div>
    );
  }

  const periods = daySchedule?.periods || [];

  // Metrics for today
  let markedCount = 0;
  let attendedToday = 0;
  let absentToday = 0;
  let replacedToday = 0;

  periods.forEach(p => {
    const key = `${p.subjectId?._id || p.subjectId}-${p.periodNumber}`;
    const rec = existingRecords[key];
    if (rec && rec.status !== 'not_marked') {
      markedCount++;
      if (['present', 'substitute', 'lab'].includes(rec.status)) attendedToday++;
      if (rec.status === 'absent') absentToday++;
      if (rec.status === 'substitute') replacedToday++;
    }
  });

  const isAllMarked = periods.length > 0 && markedCount === periods.length;

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
            <CalendarDays size={24} className="text-blue-500" /> Today's Attendance
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {todayDay || localDayName} · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Evening Check-In Button (after 6:00 PM) */}
        {isAfter6PM && hasClassesToday === 'yes' && periods.length > 0 && (
          <button
            onClick={() => setShowEveningModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 text-xs font-bold transition-all shadow-sm"
          >
            <Sparkles size={14} /> Evening Review (Post 6:00 PM)
          </button>
        )}
      </div>

      {/* 1. MORNING QUESTION (Only morning prompt if not answered) */}
      {!hasClassesToday && (
        <div className="glass-card rounded-2xl p-8 text-center border border-blue-500/20 max-w-xl mx-auto animate-[slideUp_0.3s_ease-out]">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-4 text-blue-400">
            <CalendarDays size={32} />
          </div>
          <h3 className="font-extrabold text-xl mb-1">Do you have class today?</h3>
          <p className="text-slate-400 text-sm mb-6">
            Confirm your morning attendance status for {todayDay}.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
            <button
              onClick={() => handleMorningAnswer('yes')}
              className="flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/25 active:scale-95"
            >
              <CheckCircle2 size={18} /> Yes, I have class
            </button>
            <button
              onClick={() => handleMorningAnswer('no')}
              className="flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-bold text-sm transition-all active:scale-95"
            >
              <XCircle size={18} /> No (Holiday / Day Off)
            </button>
          </div>
        </div>
      )}

      {/* 2. IF STUDENT ANSWERED NO (HOLIDAY / DAY OFF) */}
      {hasClassesToday === 'no' && (
        <div className="glass-card rounded-2xl p-10 text-center max-w-md mx-auto border border-white/10 animate-[fadeIn_0.3s_ease-out]">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="font-bold text-xl mb-2">No Classes Today!</h3>
          <p className="text-slate-400 text-sm mb-6">
            Enjoy your free day off. No attendance logging required today.
          </p>
          <button
            onClick={() => handleMorningAnswer('yes')}
            className="text-xs text-blue-400 hover:underline font-semibold"
          >
            Schedule changed? Click here to view classes
          </button>
        </div>
      )}

      {/* 3. IF STUDENT ANSWERED YES -> SHOW TODAY'S TIMETABLE SCHEDULE */}
      {hasClassesToday === 'yes' && (
        <div className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
          {/* Schedule status bar */}
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="text-slate-400 font-semibold">
              {periods.length} {periods.length === 1 ? 'Period' : 'Periods'} Scheduled for {todayDay}
            </span>
            <button
              onClick={() => handleMorningAnswer('no')}
              className="text-slate-500 hover:text-slate-300 text-[11px]"
            >
              Mark day as Holiday
            </button>
          </div>

          {/* Periods List */}
          {periods.length > 0 ? (
            <div className="space-y-3">
              {periods.map(period => (
                <PeriodCard
                  key={period.periodNumber}
                  period={period}
                  date={dateStr}
                  existingRecord={existingRecords[`${period.subjectId?._id || period.subjectId}-${period.periodNumber}`]}
                  subjects={subjects}
                  onMark={refetchRecords}
                />
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-8 text-center border border-white/10">
              <p className="text-slate-400 text-sm mb-3">
                No classes scheduled for {todayDay} in your timetable.
              </p>
              <Link
                to="/timetable"
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors inline-block"
              >
                Edit Timetable
              </Link>
            </div>
          )}

          {/* 4. DOWN INDICATOR: "ALREADY UPDATED FOR TODAY CLASSES" */}
          {periods.length > 0 && (
            <div className={`rounded-2xl p-5 border transition-all ${
              isAllMarked
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/10'
                : 'glass-card border-white/10 text-slate-300'
            }`}>
              <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isAllMarked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-600/20 text-blue-400'
                  }`}>
                    {isAllMarked ? <CheckCircle2 size={22} /> : <Clock size={20} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">
                      {isAllMarked
                        ? '✅ Already updated for today classes'
                        : `${markedCount} of ${periods.length} classes updated`}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isAllMarked
                        ? `All attendance saved: ${attendedToday} attended, ${absentToday} absent${replacedToday > 0 ? `, ${replacedToday} replaced` : ''}.`
                        : 'Tap Present, Absent or Replaced on each period above.'}
                    </p>
                  </div>
                </div>

                {!isAllMarked && (
                  <button
                    onClick={() => handleMarkAllEvening('present')}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm self-end sm:self-auto"
                  >
                    Quick Mark All Present
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. EVENING AFTER 6:00 PM REVIEW POPUP */}
      {showEveningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="w-full max-w-lg glass-card rounded-2xl p-6 border border-blue-500/30 animate-[slideUp_0.3s_ease-out] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-[11px] font-bold uppercase text-blue-400 tracking-wider">
                  Post 6:00 PM Wrap-Up
                </span>
                <h3 className="font-extrabold text-lg">Evening Attendance Check</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  How many classes were attended today? Were any classes replaced?
                </p>
              </div>
              <button
                onClick={() => setShowEveningModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Quick summary for today */}
            <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Attended</p>
                <p className="text-base font-extrabold text-emerald-400 mt-0.5">{attendedToday}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Absent</p>
                <p className="text-base font-extrabold text-red-400 mt-0.5">{absentToday}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Pending</p>
                <p className="text-base font-extrabold text-blue-400 mt-0.5">
                  {Math.max(0, periods.length - markedCount)}
                </p>
              </div>
            </div>

            {/* Period-by-period quick review list */}
            <div className="space-y-2">
              {periods.map(period => {
                const key = `${period.subjectId?._id || period.subjectId}-${period.periodNumber}`;
                const rec = existingRecords[key];
                const curStatus = rec?.status || 'not_marked';

                return (
                  <div key={period.periodNumber} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">
                        P{period.periodNumber}: {period.subjectName || period.subjectId?.name || 'Class'}
                      </p>
                      {rec?.substituteFaculty && (
                        <p className="text-[10px] text-blue-400">Replaced: {rec.substituteFaculty}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={async () => {
                          await api.post('/attendance/mark', {
                            subjectId: period.subjectId?._id || period.subjectId,
                            date: dateStr,
                            periodNumber: period.periodNumber,
                            status: 'present',
                          });
                          refetchRecords();
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          curStatus === 'present'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400'
                        }`}
                      >
                        ✓
                      </button>
                      <button
                        onClick={async () => {
                          await api.post('/attendance/mark', {
                            subjectId: period.subjectId?._id || period.subjectId,
                            date: dateStr,
                            periodNumber: period.periodNumber,
                            status: 'absent',
                          });
                          refetchRecords();
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          curStatus === 'absent'
                            ? 'bg-red-600 text-white'
                            : 'bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400'
                        }`}
                      >
                        ✗
                      </button>
                      <button
                        onClick={async () => {
                          const subNote = prompt('Enter replacement details (e.g. Taken by DBMS or Faculty):', rec?.substituteFaculty || '');
                          if (subNote !== null) {
                            await api.post('/attendance/mark', {
                              subjectId: period.subjectId?._id || period.subjectId,
                              date: dateStr,
                              periodNumber: period.periodNumber,
                              status: 'substitute',
                              substituteFaculty: subNote,
                            });
                            refetchRecords();
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          curStatus === 'substitute'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/5 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400'
                        }`}
                      >
                        🔄
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleMarkAllEvening('present')}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-semibold text-xs transition-colors"
              >
                Mark Pending as Present
              </button>
              <button
                onClick={() => {
                  setShowEveningModal(false);
                  toast.success('Evening attendance saved! Down status updated.');
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md shadow-blue-500/25"
              >
                Save & Finish Day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

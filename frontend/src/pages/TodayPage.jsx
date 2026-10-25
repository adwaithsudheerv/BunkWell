import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Ban, UserCheck, FlaskConical, Clock, ChevronDown, CalendarDays } from 'lucide-react';

const STATUS_CONFIG = {
  present: { label: 'Present', icon: CheckCircle2, color: '#10b981', bg: 'bg-emerald-500/20 border-emerald-500/30' },
  absent: { label: 'Absent', icon: XCircle, color: '#ef4444', bg: 'bg-red-500/20 border-red-500/30' },
  cancelled: { label: 'Cancelled', icon: Ban, color: '#64748b', bg: 'bg-slate-500/20 border-slate-500/30' },
  substitute: { label: 'Substitute', icon: UserCheck, color: '#f59e0b', bg: 'bg-amber-500/20 border-amber-500/30' },
  lab: { label: 'Lab', icon: FlaskConical, color: '#8b5cf6', bg: 'bg-purple-500/20 border-purple-500/30' },
  not_marked: { label: 'Not Marked', icon: Clock, color: '#94a3b8', bg: 'bg-white/5 border-white/10' },
};

function PeriodCard({ period, date, onMark }) {
  const [status, setStatus] = useState(period.existingRecord?.status || 'not_marked');
  const [substituteFaculty, setSubstituteFaculty] = useState(period.existingRecord?.substituteFaculty || '');
  const [showSubInput, setShowSubInput] = useState(false);
  const [marking, setMarking] = useState(false);
  const cfg = STATUS_CONFIG[status];

  const mark = async (newStatus, faculty = '') => {
    setMarking(true);
    try {
      await api.post('/attendance/mark', {
        subjectId: period.subjectId?._id || period.subjectId,
        date,
        periodNumber: period.periodNumber,
        status: newStatus,
        substituteFaculty: faculty,
      });
      setStatus(newStatus);
      if (faculty) setSubstituteFaculty(faculty);
      toast.success(`Period ${period.periodNumber} marked as ${STATUS_CONFIG[newStatus].label}`);
      if (onMark) onMark();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark');
    } finally {
      setMarking(false);
      setShowSubInput(false);
    }
  };

  return (
    <div className={`glass-card rounded-2xl p-5 border transition-all duration-200 ${cfg.bg}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
            style={{ background: period.subjectId?.color || '#6366f1' }}>
            {period.periodNumber}
          </div>
          <div>
            <p className="font-semibold text-white">{period.subjectName || period.subjectId?.name || 'Subject'}</p>
            {period.subjectId?.code && <p className="text-xs text-slate-500">{period.subjectId.code}</p>}
            {period.startTime && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Clock size={11} /> {period.startTime} – {period.endTime}
              </p>
            )}
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium`} style={{ color: cfg.color }}>
          <cfg.icon size={13} />
          {cfg.label}
        </div>
      </div>

      {/* Status buttons */}
      <div className="grid grid-cols-3 gap-2">
        {['present', 'absent', 'cancelled', 'substitute', 'lab'].map(s => {
          const c = STATUS_CONFIG[s];
          const isActive = status === s;
          return (
            <button
              key={s}
              onClick={() => {
                if (s === 'substitute') { setShowSubInput(true); return; }
                mark(s);
              }}
              disabled={marking}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-medium border transition-all active:scale-95 disabled:opacity-60 ${
                isActive
                  ? `border-current text-current`
                  : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300'
              }`}
              style={isActive ? { color: c.color, borderColor: c.color } : {}}
            >
              <c.icon size={16} />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Substitute faculty input */}
      {showSubInput && (
        <div className="mt-3 flex gap-2 animate-[slideUp_0.2s_ease-out]">
          <input
            type="text"
            placeholder="Enter substitute faculty name"
            value={substituteFaculty}
            onChange={e => setSubstituteFaculty(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-[#2a2a4a] text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => mark('substitute', substituteFaculty)}
            disabled={marking}
            className="px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm hover:bg-amber-500/30 transition-colors disabled:opacity-60"
          >
            ✓
          </button>
          <button onClick={() => setShowSubInput(false)} className="px-3 py-2 rounded-lg bg-white/5 text-slate-400 text-sm hover:text-white transition-colors">
            ✕
          </button>
        </div>
      )}

      {substituteFaculty && status === 'substitute' && (
        <p className="text-xs text-amber-400/70 mt-2">Faculty: {substituteFaculty}</p>
      )}
    </div>
  );
}

export default function TodayPage() {
  const [timetable, setTimetable] = useState(null);
  const [daySchedule, setDaySchedule] = useState(null);
  const [today, setToday] = useState('');
  const [hasClasses, setHasClasses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [existingRecords, setExistingRecords] = useState({});

  const dateStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    Promise.all([
      api.get('/timetable/today'),
      api.get(`/attendance?date=${dateStr}`),
    ]).then(([ttRes, attRes]) => {
      setToday(ttRes.data.day);
      setDaySchedule(ttRes.data.schedule);
      setTimetable(ttRes.data.timetable);

      const recMap = {};
      attRes.data.records.forEach(r => {
        recMap[`${r.subjectId?._id || r.subjectId}-${r.periodNumber}`] = r;
      });
      setExistingRecords(recMap);

      if (ttRes.data.schedule?.periods?.length > 0) setHasClasses(null);
      else setHasClasses(false);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const refetchRecords = async () => {
    const res = await api.get(`/attendance?date=${dateStr}`);
    const recMap = {};
    res.data.records.forEach(r => {
      recMap[`${r.subjectId?._id || r.subjectId}-${r.periodNumber}`] = r;
    });
    setExistingRecords(recMap);
  };

  if (loading) return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-32 rounded-2xl shimmer" />
      {[1,2,3].map(i => <div key={i} className="h-40 rounded-2xl shimmer" />)}
    </div>
  );

  const periods = daySchedule?.periods || [];

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div>
        <h2 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
          <CalendarDays size={24} className="text-amber-500" />
          Today's Attendance
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">{today} · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Morning question */}
      {hasClasses === null && periods.length > 0 && (
        <div className="glass-card rounded-2xl p-6 text-center border border-amber-500/30 animate-[slideUp_0.4s_ease-out]">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <CalendarDays size={28} className="text-amber-500" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-1">Do you have classes today?</h3>
          <p className="text-slate-500 text-sm mb-6">{periods.length} period(s) scheduled for {today}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setHasClasses(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/30 transition-all active:scale-95"
            >
              <CheckCircle2 size={18} /> Yes, I have classes
            </button>
            <button
              onClick={() => setHasClasses(false)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/30 transition-all active:scale-95"
            >
              <XCircle size={18} /> No classes today
            </button>
          </div>
        </div>
      )}

      {/* No classes day */}
      {hasClasses === false && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-white font-semibold text-xl mb-2">No classes today!</h3>
          <p className="text-slate-500">Enjoy your free day. See you tomorrow!</p>
        </div>
      )}

      {/* Periods to mark */}
      {hasClasses === true && periods.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
            <Clock size={16} />
            Mark each period's attendance below
          </div>
          {periods.map(period => (
            <PeriodCard
              key={period.periodNumber}
              period={{
                ...period,
                existingRecord: existingRecords[`${period.subjectId?._id || period.subjectId}-${period.periodNumber}`]
              }}
              date={dateStr}
              onMark={refetchRecords}
            />
          ))}
        </div>
      )}

      {/* No timetable */}
      {!daySchedule && !loading && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <CalendarDays size={32} className="text-[#6366f1]" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">No timetable found</h3>
          <p className="text-slate-500 text-sm">Set up your timetable first to start tracking attendance.</p>
        </div>
      )}
    </div>
  );
}

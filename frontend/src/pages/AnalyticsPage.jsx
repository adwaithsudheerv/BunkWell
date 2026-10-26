import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  Zap, Calendar, Clock, AlertTriangle, CheckCircle2, ShieldCheck,
  ChevronRight, ArrowDownRight, Layers, Sliders, Sparkles, BookOpen,
  CalendarDays, TrendingUp, HelpCircle, Plus, Minus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import DailyWrapUpModal from '../components/DailyWrapUpModal';

const PRESETS = [
  { label: '3M (Trimester)', total: 3 },
  { label: '4M (Quarter)', total: 4 },
  { label: '6M (Semester)', total: 6 },
  { label: '12M (1-Year)', total: 12 },
];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [bunkWays, setBunkWays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simSubjectId, setSimSubjectId] = useState('');
  const [simBunks, setSimBunks] = useState(1);
  const [semesterMonths, setSemesterMonths] = useState(6);
  const [monthsElapsed, setMonthsElapsed] = useState(2);
  const [savingMonths, setSavingMonths] = useState(false);
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const target = user?.attendanceTarget || 80;

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/bunk-ways');
      setBunkWays(res.data);
      if (res.data?.semesterMonths) setSemesterMonths(res.data.semesterMonths);
      if (res.data?.monthsElapsed !== undefined) setMonthsElapsed(res.data.monthsElapsed);
      if (res.data?.subjectCushions?.length > 0) {
        setSimSubjectId(res.data.subjectCushions[0]._id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load bunk analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateDuration = async (totalM, elapsedM) => {
    const validTotal = Math.max(1, Math.min(12, Number(totalM)));
    const validElapsed = Math.max(0, Math.min(validTotal, Number(elapsedM)));
    setSemesterMonths(validTotal);
    setMonthsElapsed(validElapsed);
    setSavingMonths(true);
    try {
      await api.put('/auth/profile', {
        semesterMonths: validTotal,
        monthsElapsed: validElapsed
      });
      toast.success(`Academic cycle updated: ${validTotal} months total (${validTotal - validElapsed} remaining)`);
      loadData();
    } catch (err) {
      toast.error('Failed to update semester duration');
    } finally {
      setSavingMonths(false);
    }
  };

  const selectedSimSubject = bunkWays?.subjectCushions?.find(s => s._id === simSubjectId);
  const simTotal = (selectedSimSubject?.total || 0) + simBunks;
  const simAttended = selectedSimSubject?.attended || 0;
  const simProjectedPct = simTotal > 0 ? (simAttended / simTotal) * 100 : 100;
  const simIsSafe = simProjectedPct >= target;

  const monthsRemaining = Math.max(0, semesterMonths - monthsElapsed);
  const weeksRemaining = monthsRemaining * 4;
  const cycleName = semesterMonths <= 3 ? 'Trimester' : semesterMonths >= 9 ? 'Academic Year' : 'Semester';

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-black flex items-center gap-2">
            <Zap size={22} className="text-blue-500" /> Bunk Strategies & Long-Term Forecast
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Real-time buffers & {cycleName} projection ({monthsRemaining} months / {weeksRemaining} weeks remaining)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setWrapUpOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25 active:scale-95"
          >
            <Zap size={14} className="fill-white" />
            <span>Daily Wrap-Up</span>
          </button>

          {bunkWays && (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-xs font-bold text-blue-400">
              <ShieldCheck size={15} />
              <span>Buffer: {bunkWays.totalSafeBunksAcrossAll} Classes</span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-3xl shimmer" />)}
        </div>
      ) : !bunkWays || bunkWays.subjectCushions?.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center border border-white/10 max-w-md mx-auto">
          <BookOpen size={40} className="text-blue-500 mx-auto mb-3 opacity-60" />
          <h3 className="font-bold text-base mb-1">No subjects found</h3>
          <p className="text-xs text-slate-500">
            Add subjects and your timetable to calculate all possible ways to bunk safely.
          </p>
        </div>
      ) : (
        <>
          {/* 1. UNIVERSAL ACADEMIC CYCLE & SEMESTER DURATION CALCULATOR */}
          <div className="glass-card rounded-3xl p-5 sm:p-6 border border-white/10 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                  <CalendarDays size={18} className="text-blue-500" /> Academic Cycle & Duration Calculator
                </h3>
                <p className="text-xs text-slate-400">
                  Customizable for Trimesters (3M), Semesters (6M), or Full Years (12M)
                </p>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESETS.map(p => (
                  <button
                    key={p.total}
                    onClick={() => handleUpdateDuration(p.total, Math.min(monthsElapsed, p.total))}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      semesterMonths === p.total
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Steppers & Custom Duration Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-black/20 border border-white/10">
              {/* Stepper 1: Total Duration */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Total Cycle Duration (Months):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateDuration(semesterMonths - 1, monthsElapsed)}
                    disabled={semesterMonths <= 1}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center font-bold"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-base font-black text-white px-3 font-mono">
                    {semesterMonths} Months
                  </span>
                  <button
                    onClick={() => handleUpdateDuration(semesterMonths + 1, monthsElapsed)}
                    disabled={semesterMonths >= 12}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center font-bold"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Stepper 2: Months Completed */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Months Passed So Far:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateDuration(semesterMonths, monthsElapsed - 1)}
                    disabled={monthsElapsed <= 0}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center font-bold"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-base font-black text-blue-400 px-3 font-mono">
                    {monthsElapsed} Months
                  </span>
                  <button
                    onClick={() => handleUpdateDuration(semesterMonths, monthsElapsed + 1)}
                    disabled={monthsElapsed >= semesterMonths}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center font-bold"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Calculation Summary Badge */}
              <div className="flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Remaining Timeline:
                </span>
                <span className="text-sm font-extrabold text-emerald-400 flex items-center gap-1.5">
                  <Clock size={15} />
                  {monthsRemaining} Months ({weeksRemaining} Weeks) Left
                </span>
              </div>
            </div>

            {/* Forecast Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-2 text-center">Weekly</th>
                    <th className="py-2.5 px-2 text-center">Monthly</th>
                    <th className="py-2.5 px-2 text-center">Upcoming Classes</th>
                    <th className="py-2.5 px-2 text-center">Lifetime Total</th>
                    <th className="py-2.5 px-3 text-center">{cycleName} Bunk Budget</th>
                    <th className="py-2.5 px-3 text-center">End-of-{cycleName} Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {bunkWays.semesterForecast?.map(s => (
                    <tr key={s._id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                        <span className="truncate max-w-[130px]">{s.name}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-300 font-bold">{s.weeklyClasses}x/wk</td>
                      <td className="py-2.5 px-2 text-center text-slate-400">{s.monthlyClasses}/mo</td>
                      <td className="py-2.5 px-2 text-center font-bold text-blue-400">+{s.remainingClasses}</td>
                      <td className="py-2.5 px-2 text-center text-white font-bold">{s.totalSemesterClasses}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-black text-xs ${
                            s.remainingBunksAllowed >= 3
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : s.remainingBunksAllowed > 0
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {s.remainingBunksAllowed} Bunks Left
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-[11px] font-semibold ${
                            s.safeToBunkNow ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {s.safeToBunkNow ? '✅ Safe to bunk now' : '⚠️ Keep attending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs flex-wrap gap-2">
              <span className="text-slate-400">
                Formula: ({semesterMonths} - {monthsElapsed} = <b>{monthsRemaining} months remaining</b>) $\times$ 4 weeks $\times$ weekly frequency
              </span>
              <button
                type="button"
                onClick={() => setWrapUpOpen(true)}
                className="text-blue-400 hover:text-blue-300 font-bold inline-flex items-center gap-1"
              >
                <span>Reconcile Today's Attendance</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* 2. SUBJECT BUNK CUSHION (Immediate Safe Bunks) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" /> Subject-wise Safe Bunk Cushion (Right Now)
              </h3>
              <span className="text-[11px] text-slate-500">Target: {target}%</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {bunkWays.subjectCushions.map(s => {
                const isSafe = s.pct >= target;
                return (
                  <div
                    key={s._id}
                    className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between hover:border-blue-500/30 transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        <h4 className="font-extrabold text-sm truncate text-white">{s.name}</h4>
                      </div>
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded-lg flex-shrink-0 ${
                          isSafe ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {s.pct}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                      <span className="text-slate-400 font-medium">Attended: {s.attended}/{s.total}</span>
                      {s.safeBunks > 0 ? (
                        <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                          <CheckCircle2 size={13} /> {s.safeBunks} Safe Bunk{s.safeBunks !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-red-400 font-bold flex items-center gap-1">
                          <AlertTriangle size={13} /> Need +{s.needMore} classes
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. FULL DAY BUNK SCENARIOS (Can I take a full day off on Mon..Sat?) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-500" /> Full Day Off Scenarios (Long Weekend Finder)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {bunkWays.dayScenarios.map(d => {
                if (d.isHoliday) {
                  return (
                    <div key={d.day} className="glass-card rounded-2xl p-4 border border-white/5 opacity-60">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">{d.day}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-400 font-semibold">
                          No Classes
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={d.day}
                    className={`glass-card rounded-2xl p-4 border transition-all ${
                      d.isSafe
                        ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
                        : 'border-red-500/30 bg-red-500/[0.03]'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-black text-sm text-white">{d.day}</h4>
                        <p className="text-[11px] text-slate-400">{d.totalClasses} classes scheduled</p>
                      </div>
                      <span
                        className={`text-[11px] font-black px-2.5 py-1 rounded-xl border ${
                          d.isSafe
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}
                      >
                        {d.isSafe ? 'Full Off Safe ✅' : 'Risky Bunk ⚠️'}
                      </span>
                    </div>

                    {/* Impact preview */}
                    <div className="space-y-1.5 mt-2.5 pt-2 border-t border-slate-200 dark:border-white/5 text-xs">
                      {d.impacts.map((imp, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-700 dark:text-slate-300 truncate max-w-[140px] font-medium">
                            {imp.name} ({imp.classesCount} class)
                          </span>
                          <span className={imp.isSafe ? 'text-slate-600 dark:text-slate-400 font-medium' : 'text-red-500 font-bold'}>
                            {imp.currentPct}% → <strong className={imp.isSafe ? 'text-slate-900 dark:text-emerald-400 font-bold' : 'text-red-500 font-bold'}>{imp.projectedPct}%</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. MORNING SLEEP-IN PLAN (Skip Period 1 at 8:00 AM) */}
          {bunkWays.morningScenarios?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock size={14} className="text-blue-500" /> Morning Sleep-In Plan (Period 1 Bunks)
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {bunkWays.morningScenarios.map((m, idx) => (
                  <div
                    key={idx}
                    className={`glass-card rounded-2xl p-3 border text-center ${
                      m.isSafe
                        ? 'border-emerald-500/20 hover:border-emerald-500/40'
                        : 'border-red-500/20 hover:border-red-500/40'
                    }`}
                  >
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.day.slice(0, 3)}</p>
                    <p className="font-extrabold text-xs text-white truncate mt-1">{m.subjectName}</p>
                    <p className="text-[10px] text-slate-500">{m.time}</p>

                    <div className="mt-2">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          m.isSafe ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {m.isSafe ? 'Sleep In 😴' : 'Attend ⏰'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. INTERACTIVE WHAT-IF BUNK SIMULATOR */}
          <div className="glass-card rounded-3xl p-5 sm:p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                  <Sliders size={18} className="text-blue-500" /> What-If Bunk Simulator
                </h3>
                <p className="text-xs text-slate-400">Calculate projected attendance before you take the bunk</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* Controls */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Select Subject
                  </label>
                  <select
                    value={simSubjectId}
                    onChange={e => setSimSubjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/20 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                  >
                    {bunkWays.subjectCushions.map(s => (
                      <option key={s._id} value={s._id} className="bg-slate-900 text-white">
                        {s.name} (Current: {s.pct}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Classes You Want to Bunk: <span className="text-blue-400 font-black">{simBunks}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSimBunks(n)}
                        className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                          simBunks === n
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        +{n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Projected Gauge Result */}
              <div
                className={`p-4 rounded-2xl border text-center space-y-1.5 transition-all ${
                  simIsSafe
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-slate-400">Projected Attendance</span>
                <div className="text-3xl font-black" style={{ color: simIsSafe ? '#10b981' : '#ef4444' }}>
                  {simProjectedPct.toFixed(1)}%
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-white">
                  Current: {selectedSimSubject?.pct}% → After {simBunks} bunk{simBunks !== 1 ? 's' : ''}: {simProjectedPct.toFixed(1)}%
                </p>
                <p className="text-[11px] font-semibold text-slate-300">
                  {simIsSafe
                    ? `✅ Safe! Stays above your ${target}% threshold.`
                    : `⚠️ Danger! Drops below ${target}%. You will need to attend next classes to recover.`}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Daily Attendance Reconciliation Modal */}
      <DailyWrapUpModal isOpen={wrapUpOpen} onClose={() => setWrapUpOpen(false)} onRefresh={loadData} />
    </div>
  );
}

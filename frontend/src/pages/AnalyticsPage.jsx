import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  Zap, Calendar, Clock, AlertTriangle, CheckCircle2, ShieldCheck,
  ChevronRight, ArrowDownRight, Layers, Sliders, Sparkles, BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [bunkWays, setBunkWays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simSubjectId, setSimSubjectId] = useState('');
  const [simBunks, setSimBunks] = useState(1);
  const target = user?.attendanceTarget || 80;

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/bunk-ways');
      setBunkWays(res.data);
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

  const selectedSimSubject = bunkWays?.subjectCushions?.find(s => s._id === simSubjectId);
  const simTotal = (selectedSimSubject?.total || 0) + simBunks;
  const simAttended = selectedSimSubject?.attended || 0;
  const simProjectedPct = simTotal > 0 ? (simAttended / simTotal) * 100 : 100;
  const simIsSafe = simProjectedPct >= target;

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-black flex items-center gap-2">
            <Zap size={22} className="text-blue-500" /> Bunk Strategies & Ways
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Safe bunking routes while staying strictly above {target}% target
          </p>
        </div>

        {bunkWays && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-xs font-bold text-blue-400">
            <ShieldCheck size={16} />
            <span>Total Buffer: {bunkWays.totalSafeBunksAcrossAll} Classes</span>
          </div>
        )}
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
          {/* 1. HERO: SUBJECT BUNK CUSHION (How many can you bunk right now per subject) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" /> Subject-wise Safe Bunk Cushion
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

          {/* 2. FULL DAY BUNK SCENARIOS (Can I take a full day off on Mon..Sat?) */}
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
                    <div className="space-y-1.5 mt-2.5 pt-2 border-t border-white/5 text-xs">
                      {d.impacts.map((imp, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 truncate max-w-[130px]">
                            {imp.name} ({imp.classesCount} class)
                          </span>
                          <span className={imp.isSafe ? 'text-slate-400' : 'text-red-400 font-bold'}>
                            {imp.currentPct}% $\rightarrow$ <strong className={imp.isSafe ? 'text-white' : 'text-red-400'}>{imp.projectedPct}%</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. MORNING SLEEP-IN PLAN (Skip Period 1 at 8:00 AM) */}
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

          {/* 4. INTERACTIVE WHAT-IF BUNK SIMULATOR */}
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
                <p className="text-xs font-bold text-white">
                  Current: {selectedSimSubject?.pct}% $\rightarrow$ After {simBunks} bunk{simBunks !== 1 ? 's' : ''}: {simProjectedPct.toFixed(1)}%
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
    </div>
  );
}

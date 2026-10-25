import { useState, useMemo } from 'react';
import { Zap, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Calculator } from 'lucide-react';

export default function QuickBunkSimulator({ subjects = [], target = 80 }) {
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?._id || '');

  const activeSubject = useMemo(() => {
    return subjects.find(s => s._id === selectedSubjectId) || subjects[0];
  }, [subjects, selectedSubjectId]);

  if (!activeSubject) return null;

  const total = activeSubject.eligibleClasses || activeSubject.totalClasses || 0;
  const attended = activeSubject.attendedClasses || 0;
  const currentPct = total === 0 ? 100 : (attended / total) * 100;

  // What if I bunk 1 more class today?
  const simulatedTotal = total + 1;
  const simulatedAttended = attended;
  const simulatedPct = (simulatedAttended / simulatedTotal) * 100;

  const isSafe = simulatedPct >= target;
  const safeBunks = activeSubject.canBunk || 0;
  const needMore = activeSubject.needMore || 0;

  return (
    <div className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Zap size={18} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Quick Bunk Simulator</h3>
            <p className="text-slate-400 text-xs">Can I safely skip the next lecture?</p>
          </div>
        </div>

        {/* Subject selector */}
        <select
          value={selectedSubjectId}
          onChange={e => setSelectedSubjectId(e.target.value)}
          className="bg-[#18181b] border border-white/15 text-white text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-400 transition-colors cursor-pointer"
        >
          {subjects.map(s => (
            <option key={s._id} value={s._id} className="bg-[#18181b] text-white">
              {s.name} ({s.percentage?.toFixed(0) || 0}%)
            </option>
          ))}
        </select>
      </div>

      {/* Simulator verdict card */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
        isSafe
          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
          : 'bg-red-500/10 border-red-500/25 text-red-400'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            isSafe ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {isSafe ? <CheckCircle2 size={26} /> : <AlertTriangle size={26} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isSafe ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
              }`}>
                {isSafe ? 'Bunk Pass Approved ✓' : 'Attendance Warning ⚠'}
              </span>
            </div>
            <p className="text-white text-sm font-semibold mt-1">
              {isSafe
                ? `You can skip! Attendance will be ${simulatedPct.toFixed(1)}% (Target: ${target}%)`
                : `Skipping drops you to ${simulatedPct.toFixed(1)}% (Below ${target}% Target!)`}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {isSafe
                ? `You will still have ${Math.max(0, safeBunks - 1)} safe bunks left in your BunkBank.`
                : `You will need to attend ${needMore + 1} consecutive classes to recover eligibility.`}
            </p>
          </div>
        </div>

        {/* Quick Numbers Comparison */}
        <div className="flex items-center gap-3 flex-shrink-0 bg-black/40 px-3.5 py-2 rounded-xl border border-white/5">
          <div className="text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Current</span>
            <span className="text-sm font-bold text-white">{currentPct.toFixed(0)}%</span>
          </div>
          <span className="text-slate-500">→</span>
          <div className="text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">If Bunked</span>
            <span className={`text-sm font-bold ${isSafe ? 'text-emerald-400' : 'text-red-400'}`}>
              {simulatedPct.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
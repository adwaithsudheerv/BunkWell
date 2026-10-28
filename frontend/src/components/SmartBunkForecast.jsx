import { useState, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  Sparkles, Calendar, Compass, ShieldAlert,
  ShieldCheck, AlertTriangle, ArrowRight, Zap,
  Sun, Coffee, Flame, CheckCircle2, ChevronRight
} from 'lucide-react';

export default function SmartBunkForecast({ subjects = [], timetable = null, target = 75 }) {
  const { isDark } = useTheme();
  const [selectedDay, setSelectedDay] = useState(null);

  // Analyze each weekday in the timetable
  const forecast = useMemo(() => {
    if (!timetable?.days || !subjects || subjects.length === 0) return [];

    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const subjectMap = new Map();
    subjects.forEach(s => subjectMap.set(String(s._id || s.id), s));

    return weekdays.map(dayName => {
      const dayData = timetable.days.find(d => d.day === dayName);
      const periods = (dayData?.periods || []).filter(p => p.subjectName);

      if (periods.length === 0) {
        return {
          day: dayName,
          periodCount: 0,
          status: 'free',
          score: 100,
          label: 'Free Day / No Classes',
          affectedSubjects: []
        };
      }

      // Simulate bunking all periods on this day
      let wouldBreachTarget = false;
      const affected = [];

      // Count occurrences of each subject on this day
      const dayCounts = {};
      periods.forEach(p => {
        const subId = String(p.subjectId?._id || p.subjectId || '');
        dayCounts[subId] = (dayCounts[subId] || 0) + 1;
      });

      for (const [subId, count] of Object.entries(dayCounts)) {
        const sub = subjectMap.get(subId);
        if (!sub) continue;

        const eligible = sub.eligibleClasses ?? (sub.totalClasses - (sub.cancelledClasses || 0));
        const attended = sub.attendedClasses || 0;
        const currentPct = eligible > 0 ? (attended / eligible) * 100 : 100;

        // Projected if bunked
        const projEligible = eligible + count;
        const projAttended = attended;
        const projPct = projEligible > 0 ? (projAttended / projEligible) * 100 : 100;

        const isDeficitNow = currentPct < target;
        const wouldBeDeficit = projPct < target;

        if (wouldBeDeficit) {
          wouldBreachTarget = true;
        }

        affected.push({
          name: sub.name,
          currentPct: parseFloat(currentPct.toFixed(1)),
          projPct: parseFloat(projPct.toFixed(1)),
          isDeficitNow,
          wouldBeDeficit,
          count
        });
      }

      const breachCount = affected.filter(a => a.wouldBeDeficit).length;
      let status = 'safe';
      let label = 'Safe to Chill';
      let score = 95;

      if (breachCount > 0) {
        status = 'danger';
        label = `${breachCount} Subject Deficit Risk`;
        score = Math.max(20, 90 - breachCount * 25);
      } else if (periods.length >= 5) {
        status = 'caution';
        label = 'Heavy Day • High Buffer Cost';
        score = 75;
      }

      return {
        day: dayName,
        periodCount: periods.length,
        status,
        label,
        score,
        affectedSubjects: affected
      };
    });
  }, [timetable, subjects, target]);

  if (!forecast || forecast.length === 0) return null;

  // Best day to bunk
  const bestDay = [...forecast]
    .filter(f => f.periodCount > 0)
    .sort((a, b) => b.score - a.score)[0];

  return (
    <div className={`p-5 sm:p-6 rounded-[32px] border shadow-xl backdrop-blur-xl relative overflow-hidden transition-all ${
      isDark
        ? 'bg-gradient-to-br from-[#0c101c] via-[#090d16] to-[#06080e] border-white/10 text-white'
        : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-200/50'
    }`}>
      {/* Top Ambient Glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
            <Compass size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-lg tracking-tight">Ghost Bunk Predictor</h3>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                AI What-If
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Simulates bunking entire days to forecast your exact safety margin before you skip.
            </p>
          </div>
        </div>

        {bestDay && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 self-start sm:self-auto">
            <Sun size={15} className="text-emerald-400" />
            <span className="text-xs font-black text-emerald-400">
              Best Day to Bunk: <span className="underline">{bestDay.day}</span>
            </span>
          </div>
        )}
      </div>

      {/* Weekday Forecast Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4">
        {forecast.map(f => {
          const isSelected = selectedDay?.day === f.day;
          const isSafe = f.status === 'safe';
          const isDanger = f.status === 'danger';
          const isFree = f.status === 'free';

          return (
            <button
              key={f.day}
              onClick={() => setSelectedDay(isSelected ? null : f)}
              className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between active:scale-95 ${
                isSelected
                  ? 'border-purple-500 ring-2 ring-purple-500/30 bg-purple-500/10'
                  : isDanger
                  ? 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40'
                  : isSafe
                  ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  {f.day.slice(0, 3)}
                </span>
                <p className="text-sm font-black mt-0.5">
                  {f.periodCount} {f.periodCount === 1 ? 'Period' : 'Periods'}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-white/10">
                <span className={`text-[10px] font-black block truncate ${
                  isDanger ? 'text-rose-400' : isSafe ? 'text-emerald-400' : 'text-slate-400'
                }`}>
                  {f.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day What-If Simulation Drawer */}
      {selectedDay && selectedDay.affectedSubjects.length > 0 && (
        <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-purple-500/30 space-y-3 animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-purple-400 flex items-center gap-1.5">
              <Sparkles size={14} /> What-If Simulation: Bunking all of {selectedDay.day}
            </span>
            <button onClick={() => setSelectedDay(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
          </div>

          <div className="space-y-2">
            {selectedDay.affectedSubjects.map(sub => (
              <div
                key={sub.name}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs"
              >
                <div>
                  <p className="font-black">{sub.name}</p>
                  <p className="text-[10px] text-slate-400">
                    Current: {sub.currentPct}% • {sub.count} lecture(s) on this day
                  </p>
                </div>
                <div className="text-right">
                  <span className={`font-mono font-black text-xs ${
                    sub.wouldBeDeficit ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {sub.currentPct}% → {sub.projPct}%
                  </span>
                  <p className="text-[9px] font-bold text-slate-400">
                    {sub.wouldBeDeficit ? '⚠️ Drops below target' : '✅ Remains Safe'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

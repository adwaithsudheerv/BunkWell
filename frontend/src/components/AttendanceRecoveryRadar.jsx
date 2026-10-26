import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  Zap, AlertTriangle, ShieldCheck, CheckCircle2,
  TrendingUp, TrendingDown, ArrowRight, Flame, Target,
  Sparkles, ChevronRight, BookOpen, Clock
} from 'lucide-react';

/**
 * Triggers the global DailyWrapUpModal (the "Lightning Point")
 */
export function openDailyWrapUp() {
  window.dispatchEvent(new CustomEvent('open-daily-wrapup'));
}

/**
 * AttendanceRecoveryRadar
 * 
 * Point-wise attendance deficit recovery radar.
 * Identifies all subjects below user target, calculates exact consecutive
 * classes required to reach safety buffer, and directly opens the Lightning Point.
 */
export default function AttendanceRecoveryRadar({ subjects = [], target = 80 }) {
  const { isDark } = useTheme();
  const [filterMode, setFilterMode] = useState('deficit'); // 'deficit' or 'all'

  if (!subjects || subjects.length === 0) return null;

  // Calculate stats for all subjects
  const analyzedSubjects = subjects.map(s => {
    const eligible = s.eligibleClasses ?? (s.totalClasses - (s.cancelledClasses || 0));
    const attended = s.attendedClasses || 0;
    const pct = eligible > 0 ? parseFloat(((attended / eligible) * 100).toFixed(2)) : 100;
    const isDeficit = pct < target;

    // Consecutive classes needed to reach target
    const targetFrac = target / 100;
    const needMore = isDeficit
      ? Math.max(1, Math.ceil((targetFrac * eligible - attended) / (1 - targetFrac)))
      : 0;

    // Buffer classes that can be bunked while staying >= target
    const minNeeded = Math.ceil(eligible * targetFrac);
    const canBunk = Math.max(0, attended - minNeeded);

    const deficitGap = isDeficit ? parseFloat((target - pct).toFixed(2)) : 0;

    return {
      ...s,
      percentage: pct,
      eligible,
      attended,
      isDeficit,
      needMore,
      canBunk,
      deficitGap
    };
  });

  // Sort: Deficits first (lowest percentage first), then safe subjects
  const deficitSubjects = analyzedSubjects
    .filter(s => s.isDeficit)
    .sort((a, b) => a.percentage - b.percentage);

  const safeSubjects = analyzedSubjects
    .filter(s => !s.isDeficit)
    .sort((a, b) => a.percentage - b.percentage);

  const hasDeficits = deficitSubjects.length > 0;
  const displayedList = filterMode === 'all'
    ? [...deficitSubjects, ...safeSubjects]
    : (hasDeficits ? deficitSubjects : safeSubjects);

  return (
    <div
      className={`rounded-3xl p-5 sm:p-6 border transition-all shadow-lg relative overflow-hidden ${
        isDark
          ? 'bg-[#0e131f]/90 border-blue-500/30 text-white shadow-blue-950/40'
          : 'bg-[#fcfaf5] border-[#dfd8ca] text-[#0a0a0c] shadow-stone-200/60'
      }`}
    >
      {/* Top accent glow */}
      <div
        className="absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{
          background: hasDeficits
            ? 'radial-gradient(circle, #ef4444 0%, transparent 70%)'
            : 'radial-gradient(circle, #10b981 0%, transparent 70%)'
        }}
      />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/10 dark:border-white/10">
        <div className="flex items-start gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md ${
              hasDeficits
                ? 'bg-gradient-to-br from-red-500 to-amber-600 text-white shadow-red-500/30'
                : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/30'
            }`}
          >
            {hasDeficits ? (
              <Flame size={22} className="animate-pulse" />
            ) : (
              <ShieldCheck size={24} />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                <span>{hasDeficits ? '⚡ Critical Catch-Up Checklist' : '⚡ Attendance Safety Radar'}</span>
              </h3>
              <span
                className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                  hasDeficits
                    ? 'bg-red-500/15 text-red-500 dark:text-red-400 border-red-500/30'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                }`}
              >
                {hasDeficits
                  ? `${deficitSubjects.length} Subject${deficitSubjects.length > 1 ? 's' : ''} Need Recovery`
                  : 'All Subjects Safe'}
              </span>
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-stone-600'}`}>
              {hasDeficits
                ? `Point-wise recovery roadmap to restore your ${target}% target standing.`
                : `Every subject meets or exceeds your ${target}% target. Keep it up!`}
            </p>
          </div>
        </div>

        {/* Lightning Point Quick Trigger Button */}
        <button
          onClick={openDailyWrapUp}
          type="button"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 transition-all self-start sm:self-auto border border-blue-400/40 group"
          title="Open Daily Attendance Reconciliation to apply classes attended"
        >
          <Zap size={16} className="fill-white group-hover:scale-110 transition-transform text-amber-300" />
          <span>⚡ Mark Classes (Lightning Point)</span>
        </button>
      </div>

      {/* Filter Tabs if both deficit & safe subjects exist */}
      {hasDeficits && safeSubjects.length > 0 && (
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setFilterMode('deficit')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'deficit'
                ? 'bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40'
                : isDark ? 'text-slate-400 hover:text-white' : 'text-stone-600 hover:text-black'
            }`}
          >
            Needs Catch-Up ({deficitSubjects.length})
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'all'
                ? 'bg-blue-500/20 text-blue-500 dark:text-blue-400 border border-blue-500/40'
                : isDark ? 'text-slate-400 hover:text-white' : 'text-stone-600 hover:text-black'
            }`}
          >
            All Subjects ({analyzedSubjects.length})
          </button>
        </div>
      )}

      {/* Point-wise List */}
      <div className="mt-4 space-y-3">
        {displayedList.map((item, index) => {
          const pointNum = String(index + 1).padStart(2, '0');
          const isDanger = item.isDeficit;

          return (
            <div
              key={item._id || item.name}
              className={`p-4 rounded-2xl border transition-all ${
                isDanger
                  ? isDark
                    ? 'bg-red-950/20 border-red-500/30 hover:border-red-500/50'
                    : 'bg-red-50/70 border-red-200 hover:border-red-300'
                  : isDark
                    ? 'bg-white/5 border-white/5 hover:border-white/10'
                    : 'bg-white/80 border-[#e6e1d6] hover:border-stone-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Subject Title & Point Number */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5 ${
                      isDanger
                        ? 'bg-red-500 text-white shadow-sm shadow-red-500/40'
                        : 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/40'
                    }`}
                  >
                    {pointNum}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-extrabold text-sm sm:text-base truncate">
                        {item.name}
                      </h4>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-slate-500 dark:text-slate-300">
                        {item.type || 'theory'}
                      </span>
                    </div>

                    {/* Fraction attended */}
                    <p className={`text-xs mt-0.5 font-medium ${isDark ? 'text-slate-400' : 'text-stone-600'}`}>
                      Attended: <strong className={isDark ? 'text-white' : 'text-black'}>{item.attended} / {item.eligible}</strong> classes
                      {isDanger && (
                        <span className="text-red-500 font-bold ml-1.5">
                          (-{item.deficitGap}% behind {target}%)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Percentage & 1-Tap Trigger */}
                <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
                  <div
                    className={`px-3 py-1 rounded-xl text-xs sm:text-sm font-black border text-center ${
                      isDanger
                        ? 'bg-red-500/20 border-red-500/40 text-red-500 dark:text-red-400'
                        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {item.percentage.toFixed(1)}%
                  </div>

                  <button
                    onClick={openDailyWrapUp}
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-90 text-white font-bold text-xs shadow-sm transition-all"
                    title="Open Lightning Point to mark attendance for this subject"
                  >
                    <Zap size={13} className="fill-white" />
                    <span className="hidden sm:inline">Apply</span>
                  </button>
                </div>
              </div>

              {/* Point-wise Exact Recovery Instruction (Easy to remember every time) */}
              <div
                className={`mt-3 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border ${
                  isDanger
                    ? isDark
                      ? 'bg-red-500/10 border-red-500/25 text-red-300'
                      : 'bg-red-100/70 border-red-300 text-red-900'
                    : isDark
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-emerald-100/70 border-emerald-300 text-emerald-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base flex-shrink-0">{isDanger ? '🎯' : '🛡️'}</span>
                  <span>
                    {isDanger ? (
                      <>
                        Must attend next <span className="font-black underline decoration-red-400 decoration-2">{item.needMore} consecutive class{item.needMore > 1 ? 'es' : ''}</span> without bunking to reach {target}%.
                      </>
                    ) : (
                      <>
                        Safe Buffer: You can bunk up to <span className="font-black">{item.canBunk} class{item.canBunk === 1 ? '' : 'es'}</span> and still stay safely above {target}%.
                      </>
                    )}
                  </span>
                </div>
                <button
                  onClick={openDailyWrapUp}
                  className="text-[11px] font-bold text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-0.5 flex-shrink-0"
                >
                  <span>Reconcile</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              {/* Visual Progress Bar with Target Marker */}
              <div className="mt-3 relative">
                <div className="h-2 rounded-full overflow-hidden bg-black/10 dark:bg-white/10 relative">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isDanger
                        ? 'bg-gradient-to-r from-red-600 to-amber-500'
                        : 'bg-gradient-to-r from-teal-500 to-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                  />
                </div>
                {/* Target Marker Pin */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10"
                  style={{ left: `${Math.min(100, target)}%` }}
                  title={`Target: ${target}%`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom direct trigger prompt */}
      <div className={`mt-5 pt-3.5 border-t border-black/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
        isDark ? 'text-slate-400' : 'text-stone-600'
      }`}>
        <p className="flex items-center gap-1.5 font-medium">
          <Target size={14} className="text-blue-500 flex-shrink-0" />
          <span>Remember: Tapping any point or the lightning icon takes you directly to today's class ledger.</span>
        </p>

        <button
          onClick={openDailyWrapUp}
          type="button"
          className="font-bold text-blue-500 hover:text-blue-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
        >
          <span>Open Lightning Hub</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

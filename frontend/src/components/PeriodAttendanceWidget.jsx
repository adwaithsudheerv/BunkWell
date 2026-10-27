import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import { Clock, Check, X, Zap, ChevronRight, Bell, Sparkles } from 'lucide-react';

export default function PeriodAttendanceWidget({ onAttendanceUpdated }) {
  const { isDark } = useTheme();
  const [activePeriod, setActivePeriod] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dismissedKey, setDismissedKey] = useState(null);
  const [isEveningBriefing, setIsEveningBriefing] = useState(false);

  // Check today's schedule and determine current/unrecorded period
  const checkCurrentPeriod = async () => {
    try {
      const now = new Date();
      const todayKey = now.toISOString().split('T')[0];
      const todayStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(now);
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeVal = currentHour * 60 + currentMinutes;

      // 6:00 PM (18:00) Evening Briefing check
      if (currentHour >= 18) {
        const briefedKey = `briefing_dismissed_${todayKey}`;
        if (!localStorage.getItem(briefedKey)) {
          setIsEveningBriefing(true);
        }
      }

      const [ttRes, attRes] = await Promise.all([
        api.get(`/timetable/today?day=${todayStr}&timezone=Asia/Kolkata`),
        api.get(`/attendance?date=${todayKey}`)
      ]);

      const periods = (ttRes.data?.schedule?.periods || []).filter(p => p.subjectName);
      if (periods.length === 0) return;

      const recordedNums = new Set((attRes.data?.records || []).map(r => r.periodNumber));

      // Find first unrecorded period that has started or is ongoing
      let foundPeriod = null;
      for (const p of periods) {
        const periodKey = `widget_answered_${todayKey}_P${p.periodNumber}`;
        if (recordedNums.has(p.periodNumber) || localStorage.getItem(periodKey) === 'true') {
          continue;
        }

        if (p.startTime) {
          const [sh, sm] = p.startTime.split(':').map(Number);
          const startVal = sh * 60 + sm;
          // If class started within the last 3 hours or starts in next 10 mins
          if (currentTimeVal >= startVal - 10) {
            foundPeriod = p;
            break;
          }
        } else {
          // If no time is set, pick first unrecorded period
          foundPeriod = p;
          break;
        }
      }

      setActivePeriod(foundPeriod);
    } catch (err) {
      console.warn('Period attendance check error:', err.message);
    }
  };

  useEffect(() => {
    checkCurrentPeriod();
    const timer = setInterval(checkCurrentPeriod, 60 * 1000); // Check every minute
    return () => clearInterval(timer);
  }, []);

  const handleQuickAnswer = async (status) => {
    if (!activePeriod) return;
    setSaving(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      const subId = activePeriod.subjectId?._id || activePeriod.subjectId;

      await api.post('/attendance/mark', {
        subjectId: subId,
        date: now,
        periodNumber: activePeriod.periodNumber,
        status: status === 'present' ? 'present' : 'absent'
      });

      const periodKey = `widget_answered_${now}_P${activePeriod.periodNumber}`;
      localStorage.setItem(periodKey, 'true');

      if (status === 'present') {
        toast.success(`Attended P${activePeriod.periodNumber} (${activePeriod.subjectName})! 🎉`);
      } else {
        toast.error(`Bunk recorded for P${activePeriod.periodNumber} (${activePeriod.subjectName}) ❌`);
      }

      setActivePeriod(null);
      if (onAttendanceUpdated) onAttendanceUpdated();
      window.dispatchEvent(new CustomEvent('attendance-updated'));
    } catch (err) {
      toast.error('Failed to log attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleDismissBriefing = () => {
    const now = new Date().toISOString().split('T')[0];
    localStorage.setItem(`briefing_dismissed_${now}`, 'true');
    setIsEveningBriefing(false);
  };

  // If evening briefing is ready
  if (isEveningBriefing) {
    return (
      <div className={`p-4 rounded-3xl border shadow-xl flex items-center justify-between gap-3 animate-[slideDown_0.3s_ease-out] mb-4 ${
        isDark ? 'bg-gradient-to-r from-blue-950/80 to-indigo-950/80 border-blue-500/40 text-white' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-slate-900'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0 shadow-md shadow-blue-600/30">
            <Sparkles size={20} className="animate-spin text-amber-300" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-black tracking-tight truncate">
              🌆 6:00 PM Daily Briefing & Wrap-Up
            </p>
            <p className={`text-[11px] truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Classes concluded for today. Review what was attended, swapped, or bunked.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => {
              handleDismissBriefing();
              window.dispatchEvent(new CustomEvent('open-daily-wrapup'));
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all"
          >
            <Zap size={14} className="fill-white" />
            <span>Review Ledger</span>
          </button>
          <button
            onClick={handleDismissBriefing}
            className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-black'}`}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // If an active/unrecorded period is found
  if (!activePeriod) return null;

  return (
    <div className={`p-4 rounded-3xl border shadow-xl animate-[slideDown_0.3s_ease-out] mb-4 transition-all ${
      isDark
        ? 'bg-[#0f1523] border-blue-500/40 text-white shadow-blue-950/50'
        : 'bg-white border-blue-200 text-slate-900 shadow-slate-200/80'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Period info */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-md shadow-blue-600/30">
            <Clock size={20} className="text-amber-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-blue-600 text-white">
                P{activePeriod.periodNumber}
              </span>
              <h4 className="font-black text-sm sm:text-base truncate">
                {activePeriod.subjectName}
              </h4>
              {activePeriod.startTime && (
                <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  ({activePeriod.startTime} - {activePeriod.endTime || 'End'})
                </span>
              )}
            </div>
            <p className={`text-xs mt-1 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Did you attend this class? 1-tap directly to log your status:
            </p>
          </div>
        </div>

        {/* 1-Tap YES / NO Direct Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
          <button
            onClick={() => handleQuickAnswer('present')}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
            title="Mark as Attended (+1 to attended classes)"
          >
            <Check size={16} className="stroke-[3]" />
            <span>Yes, Attended</span>
          </button>

          <button
            onClick={() => handleQuickAnswer('absent')}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-extrabold text-xs shadow-md shadow-red-600/30 transition-all disabled:opacity-50"
            title="Mark as Bunked"
          >
            <X size={16} className="stroke-[3]" />
            <span>No, Bunked</span>
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-daily-wrapup'))}
            className={`p-2 rounded-2xl border transition-colors ${
              isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white' : 'border-slate-200 bg-slate-100 text-slate-600 hover:text-black'
            }`}
            title="Open Daily Attendance Reconciliation"
          >
            <Zap size={16} className="fill-amber-400 text-amber-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

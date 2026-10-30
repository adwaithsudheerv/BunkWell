import { useState, useEffect } from 'react';
import { Bell, Clock, Sun, Moon, Check, X, ShieldAlert, Sparkles, Volume2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function MorningClassWakeUpAlarm() {
  const { isDark } = useTheme();
  const [enabled, setEnabled] = useState(() => localStorage.getItem('morning_alarm_enabled') === 'true');
  const [offsetMinutes, setOffsetMinutes] = useState(() => Number(localStorage.getItem('morning_alarm_offset')) || 60); // 30, 60, 90, 120 mins before
  const [tomorrowConfirmedNoClass, setTomorrowConfirmedNoClass] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomKey = tomorrow.toISOString().split('T')[0];
    return localStorage.getItem('holiday_' + tomKey) === 'true';
  });

  const handleToggle = (val) => {
    setEnabled(val);
    localStorage.setItem('morning_alarm_enabled', val ? 'true' : 'false');
    if (val) {
      toast.success(`Morning Class Alarm active! Rings ${offsetMinutes} min before your first lecture. ⏰`);
    } else {
      toast('Morning Class Alarm disabled.');
    }
  };

  const handleOffsetChange = (val) => {
    setOffsetMinutes(val);
    localStorage.setItem('morning_alarm_offset', String(val));
    toast.success(`Alarm set to ring ${val} minutes before Period 1! ⏰`);
  };

  const toggleTomorrowStatus = (noClass) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomKey = tomorrow.toISOString().split('T')[0];
    if (noClass) {
      localStorage.setItem('holiday_' + tomKey, 'true');
      setTomorrowConfirmedNoClass(true);
      toast('Tomorrow marked No Classes / Off. Morning alarm silenced! 😴');
    } else {
      localStorage.removeItem('holiday_' + tomKey);
      setTomorrowConfirmedNoClass(false);
      toast.success('Tomorrow confirmed as Class Day. Alarm will ring on time! ⏰');
    }
  };

  return (
    <div className={`p-4 sm:p-5 rounded-3xl border shadow-xl backdrop-blur-xl transition-all relative overflow-hidden ${
      enabled
        ? 'bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-950 border-indigo-500/40 shadow-indigo-500/10'
        : isDark
        ? 'bg-[#0f1422]/90 border-white/10 text-white'
        : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-200/50'
    }`}>
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black flex-shrink-0 shadow-md ${
            enabled ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-500/30' : 'bg-white/10 text-slate-400'
          }`}>
            <Bell size={20} className={enabled ? 'animate-bounce' : ''} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm sm:text-base tracking-tight">
                First Period Wake-Up Alarm
              </h3>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                enabled
                  ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'
                  : 'bg-white/10 text-slate-400 border-white/10'
              }`}>
                {enabled ? 'Active Daily' : 'Optional'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Automatically calculates your first period and wakes you up on class days.
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={() => handleToggle(!enabled)}
          className={`w-12 h-6.5 rounded-full transition-colors relative flex items-center p-0.5 active:scale-95 flex-shrink-0 ${
            enabled ? 'bg-indigo-600' : 'bg-white/10'
          }`}
        >
          <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
            enabled ? 'translate-x-5.5' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      {/* Settings when enabled */}
      {enabled && (
        <div className="mt-3.5 space-y-3 animate-[fadeIn_0.2s_ease-out]">
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
              Ring alarm before first lecture:
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { val: 30, label: '30 mins' },
                { val: 60, label: '1 hour' },
                { val: 90, label: '1.5 hrs' },
                { val: 120, label: '2 hours' }
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => handleOffsetChange(opt.val)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-black border transition-all ${
                    offsetMinutes === opt.val
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                      : 'bg-black/20 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nightly Class Confirmation Helper */}
          <div className="p-3 rounded-2xl bg-black/30 border border-indigo-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="text-xs">
              <span className="font-extrabold text-indigo-400 flex items-center gap-1">
                <Clock size={13} /> Tomorrow Class Check
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {tomorrowConfirmedNoClass
                  ? 'Tomorrow marked cancelled/holiday. Alarm will NOT ring tomorrow.'
                  : 'Alarm will ring according to your regular timetable.'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {tomorrowConfirmedNoClass ? (
                <button
                  onClick={() => toggleTomorrowStatus(false)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[11px] transition-all"
                >
                  I Have Class Tomorrow
                </button>
              ) : (
                <button
                  onClick={() => toggleTomorrowStatus(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 font-extrabold text-[11px] transition-all"
                >
                  No Class Tomorrow (Mute Alarm)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import { Flame, X, AlertTriangle, Users, Sparkles, CheckCircle2 } from 'lucide-react';

const FUNNY_REASONS = [
  'Heavy rain outside 🌧️ (Impossible to step out)',
  'Nobody prepared for the surprise quiz / assignment 💀',
  'College Fest preparations 🎉 (Official excuse)',
  'Exhausted after 3-hour lab session 😴',
  'Faculty took extra class yesterday, we deserve rest 🏃‍♂️',
  'Friday evening vibe 🍺 (Brain shut down)',
  'Mutual class agreement: Sleep > Lecture 🛏️'
];

export default function MassBunkModal({ isOpen, onClose, subjects = [], onCreated }) {
  const { isDark } = useTheme();
  const [selectedSubject, setSelectedSubject] = useState('');
  const [periodNumber, setPeriodNumber] = useState(1);
  const [reason, setReason] = useState(FUNNY_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalReason = customReason.trim() || reason;
    if (!selectedSubject) {
      toast.error('Please select a subject to mass bunk!');
      return;
    }
    if (!finalReason) {
      toast.error('Please provide a reason for the mass bunk');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/mass-bunk/create', {
        subjectName: selectedSubject,
        periodNumber: Number(periodNumber) || 1,
        reason: finalReason
      });

      toast.success(res.data.message || '🚨 Mass Bunk poll launched into class group!');
      onClose();
      if (onCreated) onCreated(res.data.poll);
      window.dispatchEvent(new CustomEvent('mass-bunk-created'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate mass bunk');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className={`w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border transition-all animate-[slideUp_0.3s_ease-out] ${
        isDark
          ? 'bg-[#0f141f] border-red-500/40 text-white shadow-red-950/40'
          : 'bg-white border-red-200 text-slate-900 shadow-slate-300/80'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30 flex-shrink-0 animate-pulse">
              <Flame size={22} className="fill-white text-amber-300" />
            </div>
            <div>
              <h3 className="font-black text-lg tracking-tight flex items-center gap-1.5">
                <span>🚨 Initiate Mass Bunk</span>
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Push a class-wide voting poll into the group chat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'}`}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subject picker */}
          <div>
            <label className="text-xs font-bold block mb-1.5 uppercase tracking-wider text-slate-400">
              Target Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              required
              className={`w-full p-2.5 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-red-500 ${
                isDark ? 'bg-[#090d14] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="">-- Choose Subject to Bunk --</option>
              {subjects.map(s => (
                <option key={s._id || s.name} value={s.name}>
                  {s.name} ({s.code || s.type || 'Class'})
                </option>
              ))}
            </select>
          </div>

          {/* Period Number */}
          <div>
            <label className="text-xs font-bold block mb-1.5 uppercase tracking-wider text-slate-400">
              Period Number
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="10"
                value={periodNumber}
                onChange={(e) => setPeriodNumber(e.target.value)}
                className={`w-24 p-2.5 rounded-xl text-xs font-mono font-bold border text-center focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  isDark ? 'bg-[#090d14] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
              <span className="text-xs font-bold text-slate-400">
                Period {periodNumber} today
              </span>
            </div>
          </div>

          {/* Preset Reasons */}
          <div>
            <label className="text-xs font-bold block mb-1.5 uppercase tracking-wider text-slate-400">
              Class Reason (Select or type below)
            </label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {FUNNY_REASONS.map((r, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    setReason(r);
                    setCustomReason('');
                  }}
                  className={`w-full text-left p-2 rounded-xl text-xs transition-all border ${
                    reason === r && !customReason
                      ? 'bg-red-500/20 border-red-500/50 text-red-500 dark:text-red-300 font-bold'
                      : isDark ? 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Reason */}
          <div>
            <input
              type="text"
              placeholder="Or write a custom reason for the class..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className={`w-full p-2.5 rounded-xl text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-red-500 ${
                isDark ? 'bg-[#090d14] border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          {/* Warning notice */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-[11px] font-medium ${
            isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span>If 60%+ classmates vote to bunk, the Mass Bunk will be officially declared!</span>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold border transition-colors ${
                isDark ? 'border-slate-700 text-slate-400 hover:text-white' : 'border-slate-300 text-slate-600 hover:text-black'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedSubject}
              className="flex-1 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white font-black text-xs shadow-lg shadow-red-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Flame size={15} className="fill-white" />
              <span>{submitting ? 'Broadcasting...' : 'Broadcast to Group'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

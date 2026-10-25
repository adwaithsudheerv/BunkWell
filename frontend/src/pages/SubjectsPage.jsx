import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit3, X, Palette, GraduationCap, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const COLORS = [
  '#0047FF', '#2563eb', '#06b6d4', '#10b981', '#8b5cf6',
  '#6366f1', '#ec4899', '#f43f5e', '#64748b',
];

function SubjectModal({ subject, onClose, onSave, target = 80 }) {
  const [form, setForm] = useState({
    name: subject?.name || '',
    color: subject?.color || COLORS[0],
    type: subject?.type || 'theory',
    totalClasses: subject?.totalClasses ?? 0,
    attendedClasses: subject?.attendedClasses ?? 0,
    totalPlannedClasses: subject?.totalPlannedClasses ?? 45,
  });
  const [saving, setSaving] = useState(false);

  const total = Number(form.totalClasses) || 0;
  const attended = Number(form.attendedClasses) || 0;
  const planned = Number(form.totalPlannedClasses) || 45;
  const leftover = Math.max(0, planned - total);
  const pct = total > 0 ? (attended / total) * 100 : 100;

  const save = async () => {
    if (!form.name.trim()) { toast.error('Subject name is required'); return; }
    if (attended > total) {
      toast.error('Attended classes cannot exceed total completed classes');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        color: form.color,
        type: form.type,
        totalClasses: Math.max(0, total),
        attendedClasses: Math.max(0, attended),
        totalPlannedClasses: Math.max(1, planned),
      };

      if (subject?._id) {
        const res = await api.put(`/subjects/${subject._id}`, payload);
        onSave(res.data.subject);
        toast.success('Subject updated');
      } else {
        const res = await api.post('/subjects', payload);
        onSave(res.data.subject);
        toast.success('Subject added!');
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full max-w-lg glass-card rounded-2xl p-6 animate-[slideUp_0.3s_ease-out] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-lg">{subject?._id ? 'Edit Subject' : 'Add Subject'}</h3>
            <p className="text-xs text-slate-500">Track your completed, attended, and leftover classes</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Subject Name */}
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1.5 block">Subject Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Data Structures, Operating Systems"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1.5 block">Subject Type</label>
            <div className="grid grid-cols-3 gap-2">
              {['theory', 'lab', 'elective'].map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize border transition-all ${
                    form.type === t
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Attendance Calibration Section (Same like standard bunking platforms) */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Attendance Calibration</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Classes Attended</label>
                <input
                  type="number"
                  min="0"
                  value={form.attendedClasses}
                  onChange={e => setForm(f => ({ ...f, attendedClasses: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Total Completed</label>
                <input
                  type="number"
                  min="0"
                  value={form.totalClasses}
                  onChange={e => setForm(f => ({ ...f, totalClasses: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Total Semester</label>
                <input
                  type="number"
                  min="1"
                  value={form.totalPlannedClasses}
                  onChange={e => setForm(f => ({ ...f, totalPlannedClasses: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Quick Metrics preview */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
              <span className="text-slate-400">
                Leftover classes: <b className="text-blue-400 font-bold">{leftover} remaining</b>
              </span>
              <span className={`font-bold ${pct >= target ? 'text-emerald-400' : 'text-red-400'}`}>
                {pct.toFixed(1)}% {pct >= target ? '✓ Safe' : '⚠️ Below Target'}
              </span>
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="text-xs text-slate-400 font-medium mb-2 flex items-center gap-1.5 block">
              <Palette size={13} /> Color Tag
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full transition-all ${
                    form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110' : 'hover:scale-105'
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm hover:text-white hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-all shadow-md shadow-blue-500/25"
          >
            {saving ? 'Saving...' : subject?._id ? 'Update Subject' : 'Add Subject'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SubjectsPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | subject object
  const target = user?.attendanceTarget || 80;

  useEffect(() => {
    api.get('/subjects')
      .then(res => setSubjects(res.data.subjects))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = (saved) => {
    setSubjects(prev => {
      const idx = prev.findIndex(s => s._id === saved._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this subject?')) return;
    try {
      await api.delete(`/subjects/${id}`);
      setSubjects(prev => prev.filter(s => s._id !== id));
      toast.success('Subject removed');
    } catch (err) {
      toast.error('Failed to remove subject');
    }
  };

  const typeBadges = {
    theory: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    lab: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    elective: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
            <GraduationCap size={24} className="text-blue-500" /> Subjects & Bunking Metrics
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {subjects.length} registered subject{subjects.length !== 1 ? 's' : ''} · Target: {target}%
          </p>
        </div>
        <button
          onClick={() => setModal('add')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-md shadow-blue-500/25 active:scale-95"
        >
          <Plus size={17} /> Add Subject
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-44 rounded-2xl shimmer" />)}
        </div>
      ) : subjects.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center max-w-md mx-auto border border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-4 text-blue-400">
            <GraduationCap size={32} />
          </div>
          <h3 className="font-semibold text-lg mb-2">No subjects yet</h3>
          <p className="text-slate-500 text-sm mb-5">
            Add your subjects to start tracking completed classes, attendance, and safe bunks.
          </p>
          <button
            onClick={() => setModal('add')}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-md shadow-blue-500/25"
          >
            Add First Subject
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map(s => {
            const completed = s.totalClasses || 0;
            const attended = s.attendedClasses || 0;
            const planned = s.totalPlannedClasses || 45;
            const leftover = Math.max(0, planned - completed);
            const eligible = completed - (s.cancelledClasses || 0);
            const pct = eligible > 0 ? (attended / eligible) * 100 : 100;

            const minNeeded = Math.ceil(eligible * (target / 100));
            const canBunk = Math.max(0, attended - minNeeded);
            const needMore = pct < target ? Math.ceil((target / 100 * eligible - attended) / (1 - target / 100)) : 0;
            const isSafe = pct >= target;

            return (
              <div key={s._id} className="glass-card rounded-2xl p-5 border border-white/10 flex flex-col justify-between hover:border-blue-500/30 transition-all">
                <div>
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: `${s.color || '#0047FF'}25`, color: s.color || '#0047FF', border: `1.5px solid ${s.color || '#0047FF'}50` }}
                      >
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate" title={s.name}>{s.name}</p>
                        <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium border mt-0.5 capitalize ${typeBadges[s.type] || typeBadges.theory}`}>
                          {s.type || 'theory'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                      <button
                        onClick={() => setModal(s)}
                        title="Edit Subject"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(s._id)}
                        title="Remove Subject"
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Percentage & Progress Bar */}
                  <div className="my-3">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-xs text-slate-400">Attendance</span>
                      <span className={`text-xl font-extrabold ${isSafe ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          background: isSafe ? '#10b981' : '#ef4444'
                        }}
                      />
                    </div>
                  </div>

                  {/* 4 Standard Metrics: Attended, Completed, Leftover, Total Planned */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5 text-center my-3">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-medium">Attended</p>
                      <p className="text-sm font-bold text-white mt-0.5">{attended}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-medium">Completed</p>
                      <p className="text-sm font-bold text-white mt-0.5">{completed}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-medium">Leftover</p>
                      <p className="text-sm font-bold text-blue-400 mt-0.5">{leftover}</p>
                    </div>
                  </div>
                </div>

                {/* Bunk status banner */}
                <div className={`mt-2 px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 font-medium border ${
                  isSafe
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {isSafe ? (
                    <>
                      <ShieldCheck size={14} className="flex-shrink-0" />
                      <span>Can safely bunk <b>{canBunk}</b> class{canBunk !== 1 ? 'es' : ''}</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={14} className="flex-shrink-0" />
                      <span>Attend next <b>{needMore}</b> class{needMore !== 1 ? 'es' : ''} to reach {target}%</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <SubjectModal
          subject={modal === 'add' ? null : modal}
          target={target}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

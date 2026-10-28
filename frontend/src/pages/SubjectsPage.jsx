import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, Edit3, X, Palette, GraduationCap, CheckCircle2,
  XCircle, ChevronDown, ChevronUp, Calendar, Clock, Sparkles, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BunkRunwayMatrix, { openDailyWrapUp } from '../components/BunkRunwayMatrix';

const COLORS = [
  '#0047FF', '#2563eb', '#06b6d4', '#10b981', '#8b5cf6',
  '#6366f1', '#ec4899', '#f43f5e', '#64748b',
];

function SubjectModal({ subject, onClose, onSave }) {
  const [form, setForm] = useState({
    name: subject?.name || '',
    color: subject?.color || COLORS[0],
    type: subject?.type || 'theory',
    totalClasses: subject?.totalClasses ?? 0,
    attendedClasses: subject?.attendedClasses ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const total = Number(form.totalClasses) || 0;
  const attended = Number(form.attendedClasses) || 0;
  const bunked = Math.max(0, total - attended);
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
      <div className="w-full max-w-md glass-card rounded-3xl p-6 animate-[slideUp_0.3s_ease-out] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-lg">{subject?._id ? 'Edit Subject' : 'Add Subject'}</h3>
            <p className="text-xs text-slate-500">Track your completed and attended classes</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Subject Name */}
          <div>
            <label className="text-xs text-slate-400 font-bold mb-1.5 block">Subject Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Java, Python, OS"
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm font-semibold"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs text-slate-400 font-bold mb-1.5 block">Subject Type</label>
            <div className="grid grid-cols-3 gap-2">
              {['theory', 'lab', 'elective'].map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`py-2 px-3 rounded-xl text-xs font-bold capitalize border transition-all ${
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

          {/* Attendance Calibration: ONLY Attended and Total Completed */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Initial Classes Calibration</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">Attended Classes</label>
                <input
                  type="number"
                  min="0"
                  value={form.attendedClasses}
                  onChange={e => setForm(f => ({ ...f, attendedClasses: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/20 border border-white/10 text-sm font-extrabold focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">Total Completed</label>
                <input
                  type="number"
                  min="0"
                  value={form.totalClasses}
                  onChange={e => setForm(f => ({ ...f, totalClasses: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/20 border border-white/10 text-sm font-extrabold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
              <span className="text-slate-400 font-medium">
                Bunked: <b className="text-red-400 font-bold">{bunked} classes</b>
              </span>
              <span className="font-bold text-blue-400">
                Attendance: {pct.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="text-xs text-slate-400 font-bold mb-2 flex items-center gap-1.5 block">
              <Palette size={13} /> Color Accent
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
            className="flex-1 py-3 rounded-2xl border border-white/10 text-slate-400 text-xs font-bold hover:text-white hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 transition-all shadow-md shadow-blue-500/25"
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
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | subject object
  const [expandedBunkSubjectId, setExpandedBunkSubjectId] = useState(null);
  const target = user?.attendanceTarget || 80;

  const loadData = async () => {
    try {
      const res = await api.get('/analytics/overview');
      setOverview(res.data);
      setSubjects(res.data.subjects || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickMark = async (subjectId, status) => {
    try {
      const res = await api.post('/attendance/quick-mark', { subjectId, status });
      toast.success(res.data.message);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update attendance');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this subject?')) return;
    try {
      await api.delete(`/subjects/${id}`);
      toast.success('Subject removed');
      loadData();
    } catch (err) {
      toast.error('Failed to remove subject');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-black flex items-center gap-2">
            <GraduationCap size={24} className="text-blue-500" /> Subjects
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {subjects.length} registered subject{subjects.length !== 1 ? 's' : ''} · Target: {target}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openDailyWrapUp}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25 active:scale-95"
            title="Open Daily Attendance Reconciliation to apply classes attended"
          >
            <Zap size={15} className="fill-white text-amber-300" />
            <span>⚡ Daily Wrap-Up</span>
          </button>
          <button
            onClick={() => setModal('add')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/10 active:scale-95"
          >
            <Plus size={16} /> Add Subject
          </button>
        </div>
      </div>

      {/* Top 3 Summary Stats (Matching Reference Photo) */}
      {overview && subjects.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card rounded-2xl p-4 text-center border border-white/10">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bunked</p>
            <p className="text-2xl font-black text-blue-500 mt-1">{overview.totalBunked ?? 0}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 text-center border border-white/10">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attended</p>
            <p className="text-2xl font-black text-blue-500 mt-1">{overview.totalAttended ?? 0}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 text-center border border-white/10">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
            <p className="text-2xl font-black text-blue-500 mt-1">{overview.totalCompleted ?? 0}</p>
          </div>
        </div>
      )}

      {/* Bunk Runway & Live Intelligence Matrix */}
      {overview?.subjects && overview.subjects.length > 0 && (
        <BunkRunwayMatrix
          subjects={overview.subjects}
          target={target}
        />
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-44 rounded-3xl shimmer" />)}
        </div>
      ) : subjects.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center max-w-md mx-auto border border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-4 text-blue-400">
            <GraduationCap size={32} />
          </div>
          <h3 className="font-bold text-lg mb-2">No subjects added yet</h3>
          <p className="text-slate-500 text-xs mb-5">
            Add your subjects with attended and completed classes to calculate your safe bunks.
          </p>
          <button
            onClick={() => setModal('add')}
            className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25"
          >
            Add First Subject
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjects.map(s => {
            const completed = s.totalClasses || 0;
            const attended = s.attendedClasses || 0;
            const pct = s.percentage ?? (completed > 0 ? (attended / completed) * 100 : 100);
            const isOnTrack = pct >= target;
            const bunkCount = s.bunkHistory?.length || 0;
            const isBunkExpanded = expandedBunkSubjectId === s._id;

            return (
              <div
                key={s._id}
                className="glass-card rounded-3xl p-5 border border-white/10 flex flex-col justify-between hover:border-blue-500/40 transition-all shadow-sm relative overflow-hidden"
              >
                {/* Accent vertical line (inspired by reference photo) */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ background: isOnTrack ? '#10b981' : '#ef4444' }}
                />

                <div className="pl-2">
                  {/* Top Row: Name, Edit/Delete, and Circular Gauge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-base truncate" title={s.name}>
                          {s.name}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 uppercase font-semibold">
                          {s.type || 'theory'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-semibold mt-1">
                        Attendance: <span className="text-white font-bold">{attended}/{completed}</span>
                      </p>
                      <p className="text-xs font-bold mt-1 text-emerald-400">
                        {isOnTrack ? (
                          <span>On Track ✅ • You can miss {s.canBunk ?? 0} class{s.canBunk === 1 ? '' : 'es'}</span>
                        ) : (
                          <span className="text-red-400">Need next {s.needMore ?? 1} classes to reach {target}%</span>
                        )}
                      </p>
                    </div>

                    {/* Circular Percentage Gauge & 1-Tap Buttons */}
                    <div className="flex flex-col items-end gap-2.5 flex-shrink-0">
                      {/* Radial Badge */}
                      <div className="flex items-center gap-2">
                        <div
                          className="px-2.5 py-1 rounded-xl text-xs font-black border"
                          style={{
                            background: isOnTrack ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            borderColor: isOnTrack ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                            color: isOnTrack ? '#10b981' : '#ef4444'
                          }}
                        >
                          {pct.toFixed(2)}%
                        </div>
                        <button
                          onClick={() => setModal(s)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                          title="Edit"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(s._id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Manual Tick Buttons (Reference Photo Style: Green Check & Red Cross) */}
                      <div className="flex items-center gap-2 mt-1">
                        {/* Present (✓) */}
                        <button
                          onClick={() => handleQuickMark(s._id, 'present')}
                          title="Mark Attended Today (+1)"
                          className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 active:scale-90 transition-all font-bold"
                        >
                          ✓
                        </button>

                        {/* Bunk / Absent (✗) */}
                        <button
                          onClick={() => handleQuickMark(s._id, 'absent')}
                          title="Mark Bunked Today (Logs Date & Period)"
                          className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md shadow-red-500/25 active:scale-90 transition-all font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bunk History Pill / Drawer (Shows recorded bunk days & periods since using app) */}
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setExpandedBunkSubjectId(isBunkExpanded ? null : s._id)}
                      className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white font-semibold transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-blue-500" />
                        Bunked History ({bunkCount})
                      </span>
                      {isBunkExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {/* Expandable Bunk History List: Only Date and Period as requested */}
                    {isBunkExpanded && (
                      <div className="mt-2.5 space-y-1.5 animate-[fadeIn_0.2s_ease-out]">
                        {bunkCount === 0 ? (
                          <p className="text-[11px] text-slate-500 italic py-1">
                            No bunks recorded in BunkClub yet 🎯
                          </p>
                        ) : (
                          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                            {s.bunkHistory.map((b, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-white/5 border border-white/5 text-xs"
                              >
                                <span className="font-medium text-slate-300">
                                  📅 {formatDate(b.date)}
                                </span>
                                <span className="font-bold text-red-400 text-[11px]">
                                  Period {b.periodNumber}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <SubjectModal
          subject={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={loadData}
        />
      )}
    </div>
  );
}

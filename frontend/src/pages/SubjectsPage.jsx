import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit3, X, Check, Palette, GraduationCap } from 'lucide-react';

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#84cc16', '#f97316',
];

function SubjectModal({ subject, onClose, onSave }) {
  const [form, setForm] = useState({
    name: subject?.name || '',
    code: subject?.code || '',
    faculty: subject?.faculty || '',
    color: subject?.color || COLORS[0],
    type: subject?.type || 'theory',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name) { toast.error('Subject name required'); return; }
    setSaving(true);
    try {
      if (subject?._id) {
        const res = await api.put(`/subjects/${subject._id}`, form);
        onSave(res.data.subject);
        toast.success('Subject updated');
      } else {
        const res = await api.post('/subjects', form);
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full max-w-md glass-card rounded-2xl p-6 animate-[slideUp_0.3s_ease-out]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-lg">{subject?._id ? 'Edit Subject' : 'Add Subject'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1.5 block">Subject Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Data Structures"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#2a2a4a] text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm" />
          </div>

          {/* Code + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1.5 block">Subject Code</label>
              <input type="text" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="e.g. CS201"
                className="w-full px-3 py-3 rounded-xl bg-white/5 border border-[#2a2a4a] text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1.5 block">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-3 rounded-xl bg-[#16162a] border border-[#2a2a4a] text-white focus:outline-none focus:border-amber-500 text-sm">
                <option value="theory">Theory</option>
                <option value="lab">Lab</option>
                <option value="elective">Elective</option>
              </select>
            </div>
          </div>

          {/* Faculty */}
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1.5 block">Faculty Name</label>
            <input type="text" value={form.faculty} onChange={e => setForm(f => ({ ...f, faculty: e.target.value }))}
              placeholder="e.g. Dr. Sharma"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#2a2a4a] text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm" />
          </div>

          {/* Color */}
          <div>
            <label className="text-xs text-slate-400 font-medium mb-2 flex items-center gap-1.5 block"><Palette size={13} /> Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#16162a] scale-110' : 'hover:scale-105'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#2a2a4a] text-slate-400 text-sm hover:text-white hover:border-amber-500 transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all">
            {saving ? 'Saving...' : subject?._id ? 'Update' : 'Add Subject'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | subject object

  useEffect(() => {
    api.get('/subjects').then(res => setSubjects(res.data.subjects)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSave = (saved) => {
    setSubjects(prev => {
      const idx = prev.findIndex(s => s._id === saved._id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [...prev, saved];
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this subject?')) return;
    await api.delete(`/subjects/${id}`);
    setSubjects(prev => prev.filter(s => s._id !== id));
    toast.success('Subject removed');
  };

  const typeColors = { theory: 'text-blue-400 bg-blue-500/10', lab: 'text-purple-400 bg-purple-500/10', elective: 'text-amber-400 bg-amber-500/10' };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
            <GraduationCap size={24} className="text-amber-500" /> Subjects
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">{subjects.length} subject{subjects.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button
          onClick={() => setModal('add')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 text-white text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-orange-500/25"
        >
          <Plus size={17} /> Add Subject
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl shimmer" />)}</div>
      ) : subjects.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={32} className="text-amber-500" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">No subjects yet</h3>
          <p className="text-slate-500 text-sm mb-4">Add your subjects to start tracking attendance.</p>
          <button onClick={() => setModal('add')} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 text-white text-sm font-medium hover:opacity-90 transition-all">
            Add First Subject
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {subjects.map(s => (
            <div key={s._id} className="glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ background: `${s.color}30`, border: `2px solid ${s.color}` }}>
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold" style={{ color: s.color }}>
                      {s.name.charAt(0)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{s.name}</p>
                    {s.code && <p className="text-xs text-slate-500">{s.code}</p>}
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => setModal(s)} className="p-2 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors">
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => handleDelete(s._id)} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[s.type]}`}>{s.type}</span>
                {s.faculty && <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-400">{s.faculty}</span>}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-slate-500">
                <span>Attended: <b className="text-white">{s.attendedClasses}</b></span>
                <span>Total: <b className="text-white">{s.totalClasses}</b></span>
                <span className="ml-auto font-semibold" style={{ color: s.attendancePercentage >= 80 ? '#10b981' : '#ef4444' }}>
                  {s.attendancePercentage?.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <SubjectModal
          subject={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

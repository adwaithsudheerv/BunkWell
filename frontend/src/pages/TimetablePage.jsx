import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { CalendarDays, Plus, Save, Trash2, Clock, BookOpen, Users } from 'lucide-react';
import ShareTimetableModal from '../components/ShareTimetableModal';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_TIMES = [
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  { start: '11:00', end: '12:00' },
  { start: '13:00', end: '14:00' },
  { start: '14:00', end: '15:00' },
  { start: '15:00', end: '16:00' },
];

export default function TimetablePage() {
  const [subjects, setSubjects] = useState([]);
  const [timetable, setTimetable] = useState(null);
  const [timetableId, setTimetableId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [semName, setSemName] = useState('Semester 1');
  const [showShareModal, setShowShareModal] = useState(false);

  // days state: { Monday: [{periodNumber, subjectId, subjectName, startTime, endTime}], ... }
  const [days, setDays] = useState(() => {
    const d = {};
    DAYS.forEach(day => { d[day] = []; });
    return d;
  });

  const loadData = () => {
    return Promise.all([api.get('/subjects'), api.get('/timetable')]).then(([subRes, ttRes]) => {
      setSubjects(subRes.data.subjects);
      if (ttRes.data.timetable) {
        const tt = ttRes.data.timetable;
        setTimetableId(tt._id);
        setSemName(tt.semesterName || 'Semester 1');
        const d = {};
        DAYS.forEach(day => { d[day] = []; });
        tt.days.forEach(dayData => {
          d[dayData.day] = dayData.periods.map(p => ({
            periodNumber: p.periodNumber,
            subjectId: p.subjectId?._id || p.subjectId || '',
            subjectName: p.subjectName || p.subjectId?.name || '',
            startTime: p.startTime || '',
            endTime: p.endTime || '',
          }));
        });
        setDays(d);
      }
    }).catch(console.error);
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  const addPeriod = (day) => {
    setDays(prev => {
      const periods = prev[day];
      const num = periods.length + 1;
      const timeDefaults = DEFAULT_TIMES[num - 1] || { start: '', end: '' };
      return {
        ...prev,
        [day]: [...periods, { periodNumber: num, subjectId: '', subjectName: '', startTime: timeDefaults.start, endTime: timeDefaults.end }]
      };
    });
  };

  const removePeriod = (day, idx) => {
    setDays(prev => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== idx).map((p, i) => ({ ...p, periodNumber: i + 1 }))
    }));
  };

  const updatePeriod = (day, idx, key, value) => {
    setDays(prev => {
      const periods = [...prev[day]];
      periods[idx] = { ...periods[idx], [key]: value };
      if (key === 'subjectId') {
        const sub = subjects.find(s => s._id === value);
        periods[idx].subjectName = sub?.name || '';
      }
      return { ...prev, [day]: periods };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        semesterName: semName,
        days: DAYS.filter(d => days[d].length > 0).map(day => ({
          day,
          periods: days[day].map(p => ({
            periodNumber: p.periodNumber,
            subjectId: p.subjectId || undefined,
            subjectName: p.subjectName,
            startTime: p.startTime,
            endTime: p.endTime,
          }))
        }))
      };
      if (timetableId) {
        await api.put(`/timetable/${timetableId}`, payload);
      } else {
        const res = await api.post('/timetable', payload);
        setTimetableId(res.data.timetable._id);
      }
      toast.success('Timetable saved! ✅');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="p-6 space-y-4 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-40 rounded-2xl shimmer" />)}</div>
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
            <CalendarDays size={24} className="text-amber-500" /> Timetable
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Set up your weekly class schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-sm font-semibold border border-purple-500/30 transition-all shadow"
          >
            <Users size={16} /> Section Sync / Share
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-orange-500/25">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Timetable'}
          </button>
        </div>
      </div>

      {/* Semester name */}
      <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
        <BookOpen size={18} className="text-amber-500 flex-shrink-0" />
        <input type="text" value={semName} onChange={e => setSemName(e.target.value)}
          placeholder="Semester name (e.g. Semester 3 - 2024)"
          className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none text-sm" />
      </div>

      {subjects.length === 0 && (
        <div className="glass-card rounded-xl p-4 border border-amber-500/30 text-amber-400 text-sm flex items-center gap-2">
          ⚠️ No subjects found. Add subjects first to assign them to periods.
        </div>
      )}

      {/* Day grid */}
      <div className="space-y-4">
        {DAYS.map(day => (
          <div key={day} className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a4a]">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {day}
                <span className="text-slate-500 font-normal">({days[day].length} periods)</span>
              </h3>
              <button onClick={() => addPeriod(day)}
                className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium">
                <Plus size={15} /> Add Period
              </button>
            </div>

            {days[day].length === 0 ? (
              <div className="px-5 py-4 text-slate-500 text-sm text-center">
                No periods — <button onClick={() => addPeriod(day)} className="text-amber-400 hover:text-amber-300">Add one</button>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {days[day].map((period, idx) => (
                  <div key={idx} className="flex items-center gap-3 flex-wrap">
                    {/* Period number */}
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-xs font-bold text-[#818cf8] flex-shrink-0">
                      {period.periodNumber}
                    </div>

                    {/* Subject */}
                    <select
                      value={period.subjectId}
                      onChange={e => updatePeriod(day, idx, 'subjectId', e.target.value)}
                      className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-white/5 border border-[#2a2a4a] text-white focus:outline-none focus:border-amber-500 text-sm"
                    >
                      <option value="">Select Subject</option>
                      {subjects.map(s => <option key={s._id} value={s._id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
                    </select>

                    {/* Time */}
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className="text-slate-500" />
                      <input type="time" value={period.startTime} onChange={e => updatePeriod(day, idx, 'startTime', e.target.value)}
                        className="w-28 px-2 py-2 rounded-lg bg-white/5 border border-[#2a2a4a] text-white focus:outline-none focus:border-amber-500 text-sm" />
                      <span className="text-slate-500">–</span>
                      <input type="time" value={period.endTime} onChange={e => updatePeriod(day, idx, 'endTime', e.target.value)}
                        className="w-28 px-2 py-2 rounded-lg bg-white/5 border border-[#2a2a4a] text-white focus:outline-none focus:border-amber-500 text-sm" />
                    </div>

                    {/* Delete */}
                    <button onClick={() => removePeriod(day, idx)} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-orange-500/25">
        {saving ? 'Saving...' : '💾 Save Timetable'}
      </button>

      {/* Share & Fork Timetable Modal */}
      <ShareTimetableModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onImportSuccess={loadData}
      />
    </div>
  );
}

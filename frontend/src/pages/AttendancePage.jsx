import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Ban, UserCheck, FlaskConical, BookOpen, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

const STATUS_CONFIG = {
  present: { label: 'Present', color: '#10b981', bg: 'bg-emerald-500/20 text-emerald-400' },
  absent: { label: 'Absent', color: '#ef4444', bg: 'bg-red-500/20 text-red-400' },
  cancelled: { label: 'Cancelled', color: '#64748b', bg: 'bg-slate-500/20 text-slate-400' },
  substitute: { label: 'Substitute', color: '#f59e0b', bg: 'bg-amber-500/20 text-amber-400' },
  lab: { label: 'Lab', color: '#8b5cf6', bg: 'bg-purple-500/20 text-purple-400' },
  not_marked: { label: 'Not Marked', color: '#94a3b8', bg: 'bg-white/10 text-slate-400' },
};

export default function AttendancePage() {
  const [records, setRecords] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    api.get('/subjects').then(res => setSubjects(res.data.subjects)).catch(console.error);
    fetchRecords();
  }, []);

  const fetchRecords = async (subjectId = '', date = '') => {
    setLoading(true);
    try {
      let url = '/attendance?';
      if (subjectId) url += `subjectId=${subjectId}&`;
      if (date) url += `date=${date}`;
      const res = await api.get(url);
      setRecords(res.data.records);
    } catch (err) {
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => fetchRecords(selectedSubject, selectedDate);
  const clearFilters = () => {
    setSelectedSubject('');
    setSelectedDate('');
    fetchRecords();
  };

  // Group by date
  const grouped = records.reduce((acc, rec) => {
    const d = new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    if (!acc[d]) acc[d] = [];
    acc[d].push(rec);
    return acc;
  }, {});

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
      <div>
        <h2 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen size={24} className="text-amber-500" /> Attendance Log
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">Complete history of your attendance</p>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <Filter size={16} className="text-slate-500" />
        <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
          className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-white/5 border border-[#2a2a4a] text-white text-sm focus:outline-none focus:border-amber-500">
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-[#2a2a4a] text-white text-sm focus:outline-none focus:border-amber-500"
          style={{ colorScheme: 'dark' }} />
        <button onClick={handleFilter} className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-red-500 text-white text-sm font-medium hover:opacity-90 transition-colors">
          Filter
        </button>
        {(selectedSubject || selectedDate) && (
          <button onClick={clearFilters} className="px-3 py-2 rounded-lg border border-[#2a2a4a] text-slate-400 text-sm hover:text-white transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {['present', 'absent', 'cancelled', 'substitute'].map(s => {
          const count = records.filter(r => r.status === s || (s === 'present' && r.status === 'lab')).length;
          const cfg = STATUS_CONFIG[s];
          return (
            <div key={s} className={`glass-card rounded-xl p-3 text-center border border-white/5`}>
              <p className="text-2xl font-bold" style={{ color: cfg.color }}>{count}</p>
              <p className="text-xs text-slate-500 mt-0.5">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Records */}
      {loading ? (
        <div className="space-y-3 animate-pulse">{[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl shimmer" />)}</div>
      ) : records.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <BookOpen size={48} className="text-amber-500 opacity-50 mx-auto mb-4" />
          <p className="text-slate-500">No attendance records found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, recs]) => (
            <div key={date}>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2 px-1">{date}</p>
              <div className="space-y-2">
                {recs.map(rec => {
                  const cfg = STATUS_CONFIG[rec.status] || STATUS_CONFIG.not_marked;
                  return (
                    <div key={rec._id} className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: rec.subjectId?.color || '#6366f1' }}>
                        {rec.periodNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{rec.subjectId?.name || 'Unknown Subject'}</p>
                        {rec.substituteFaculty && (
                          <p className="text-xs text-amber-400/70">Sub: {rec.substituteFaculty}</p>
                        )}
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${cfg.bg}`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

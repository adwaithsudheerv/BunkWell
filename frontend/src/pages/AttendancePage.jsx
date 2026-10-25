import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  BookOpen, Filter, CheckCircle2, XCircle, RotateCcw,
  Calendar, Clock, ChevronLeft, ChevronRight, Table, Layers
} from 'lucide-react';

const PERIOD_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function AttendancePage() {
  const [records, setRecords] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [viewMode, setViewMode] = useState('daily'); // 'daily' (Date x Periods) | 'subject' (Subject x Dates)

  const loadData = async () => {
    setLoading(true);
    try {
      const [subRes, recRes] = await Promise.all([
        api.get('/subjects'),
        api.get(`/attendance${selectedSubject ? `?subjectId=${selectedSubject}` : ''}`)
      ]);
      setSubjects(subRes.data.subjects || []);
      setRecords(recRes.data.records || []);
    } catch (err) {
      toast.error('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSubject]);

  // Toggle cell status on click (e.g. Present <-> Absent)
  const handleToggleCell = async (rec) => {
    const nextStatus = rec.status === 'present' ? 'absent' : 'present';
    try {
      const res = await api.post('/attendance/mark', {
        subjectId: rec.subjectId?._id || rec.subjectId,
        date: rec.date,
        periodNumber: rec.periodNumber,
        status: nextStatus
      });
      toast.success(`Period ${rec.periodNumber} marked ${nextStatus === 'present' ? 'Present (P) ✅' : 'Absent (A) ❌'}`);
      // Update local state smoothly
      setRecords(prev => prev.map(r => r._id === rec._id ? { ...r, status: nextStatus } : r));
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // Group records by unique Date (YYYY-MM-DD)
  const dateMap = {};
  records.forEach(rec => {
    const dStr = new Date(rec.date).toISOString().split('T')[0];
    if (!dateMap[dStr]) {
      dateMap[dStr] = {
        dateStr: dStr,
        rawDate: new Date(rec.date),
        periods: {},
        presentCount: 0,
        absentCount: 0,
        total: 0
      };
    }
    dateMap[dStr].periods[rec.periodNumber] = rec;
    if (['present', 'substitute', 'lab'].includes(rec.status)) {
      dateMap[dStr].presentCount++;
      dateMap[dStr].total++;
    } else if (rec.status === 'absent') {
      dateMap[dStr].absentCount++;
      dateMap[dStr].total++;
    }
  });

  // Sort dates descending (newest first)
  const sortedDates = Object.keys(dateMap).sort((a, b) => new Date(b) - new Date(a));

  // Compute overall register statistics
  const totalClasses = records.filter(r => r.status !== 'not_marked' && r.status !== 'cancelled').length;
  const totalPresent = records.filter(r => ['present', 'substitute', 'lab'].includes(r.status)).length;
  const totalAbsent = records.filter(r => r.status === 'absent').length;
  const overallRate = totalClasses > 0 ? ((totalPresent / totalClasses) * 100).toFixed(1) : '100.0';

  const formatRowDate = (dateObj) => {
    return dateObj.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-5 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-black flex items-center gap-2">
            <BookOpen size={22} className="text-blue-500" /> Attendance Register
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">MAM's rows & columns attendance ledger</p>
        </div>

        {/* View mode toggle */}
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 text-xs font-semibold">
          <button
            onClick={() => setViewMode('daily')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'daily' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Table size={13} /> Daily Register Matrix
          </button>
          <button
            onClick={() => setViewMode('subject')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'subject' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers size={13} /> Subject Ledger
          </button>
        </div>
      </div>

      {/* Top 4 Quick Stats (Matching Mam's register counters) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="glass-card rounded-2xl p-3 sm:p-3.5 border border-white/10 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Days Logged</p>
          <p className="text-xl sm:text-2xl font-black text-white mt-0.5">{sortedDates.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-3 sm:p-3.5 border border-white/10 text-center">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Present (P)</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">{totalPresent}</p>
        </div>
        <div className="glass-card rounded-2xl p-3 sm:p-3.5 border border-white/10 text-center">
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Absent / Bunk (A)</p>
          <p className="text-xl sm:text-2xl font-black text-red-400 mt-0.5">{totalAbsent}</p>
        </div>
        <div className="glass-card rounded-2xl p-3 sm:p-3.5 border border-white/10 text-center">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Attendance Rate</p>
          <p className="text-xl sm:text-2xl font-black text-blue-400 mt-0.5">{overallRate}%</p>
        </div>
      </div>

      {/* Filter Row */}
      <div className="glass-card rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2.5 border border-white/10">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Filter size={15} className="text-slate-500 flex-shrink-0" />
          <select
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
            className="w-full max-w-xs px-3 py-1.5 rounded-xl bg-black/20 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Subjects</option>
            {subjects.map(s => (
              <option key={s._id} value={s._id} className="bg-slate-900 text-white">
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded-md bg-emerald-500 text-white font-black text-[10px] flex items-center justify-center">P</span>
            <span>Present</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded-md bg-red-600 text-white font-black text-[10px] flex items-center justify-center">A</span>
            <span>Absent</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-slate-500 font-bold">—</span>
            <span>No Class</span>
          </span>
        </div>
      </div>

      {/* VIEW 1: DAILY REGISTER MATRIX (Rows = Dates, Columns = P1..P8) */}
      {viewMode === 'daily' && (
        <div className="glass-card rounded-3xl border border-white/10 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3 sm:px-4 w-32 sm:w-40 sticky left-0 bg-[#0c0e14] z-10">Date & Day</th>
                  {PERIOD_NUMBERS.map(p => (
                    <th key={p} className="py-3 px-2 sm:px-3 text-center min-w-[54px]">
                      P{p}
                    </th>
                  ))}
                  <th className="py-3 px-3 sm:px-4 text-center min-w-[80px]">Day Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      Loading attendance register…
                    </td>
                  </tr>
                ) : sortedDates.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      No attendance classes logged yet. Use the 1-tap green check (✓) on your Subject cards or Today's Class to populate.
                    </td>
                  </tr>
                ) : (
                  sortedDates.map(dateKey => {
                    const row = dateMap[dateKey];
                    const isFullAttendance = row.total > 0 && row.presentCount === row.total;
                    const hasBunk = row.absentCount > 0;

                    return (
                      <tr key={dateKey} className="hover:bg-white/[0.02] transition-colors">
                        {/* Sticky Date Column */}
                        <td className="py-2.5 px-3 sm:px-4 font-bold text-white whitespace-nowrap sticky left-0 bg-[#0c0e14] z-10 border-r border-white/5">
                          <div className="leading-tight">
                            <span>{formatRowDate(row.rawDate)}</span>
                            <span className="block text-[10px] text-slate-400 font-normal">{dateKey}</span>
                          </div>
                        </td>

                        {/* Period Columns P1..P8 */}
                        {PERIOD_NUMBERS.map(pNum => {
                          const rec = row.periods[pNum];
                          if (!rec) {
                            return (
                              <td key={pNum} className="py-2.5 px-2 text-center text-slate-600 font-bold select-none">
                                —
                              </td>
                            );
                          }

                          const isP = ['present', 'substitute', 'lab'].includes(rec.status);
                          const isA = rec.status === 'absent';
                          const subName = rec.subjectId?.name || 'Class';

                          return (
                            <td key={pNum} className="py-2 px-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleCell(rec)}
                                title={`${subName} (Period ${pNum}): Click to toggle P/A`}
                                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl font-black text-xs inline-flex flex-col items-center justify-center transition-all active:scale-90 shadow-sm cursor-pointer ${
                                  isP
                                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                                    : isA
                                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20'
                                    : 'bg-white/10 text-slate-400 hover:bg-white/20'
                                }`}
                              >
                                <span>{isP ? 'P' : isA ? 'A' : '·'}</span>
                                <span className="text-[7px] truncate max-w-[28px] opacity-75 font-normal">
                                  {subName.slice(0, 4)}
                                </span>
                              </button>
                            </td>
                          );
                        })}

                        {/* Day Score / Total for the date */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                              isFullAttendance
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : hasBunk
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            {row.presentCount}/{row.total}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: SUBJECT LEDGER (Rows = Subjects, Columns = Total, Attended, Bunked, Rate, Status) */}
      {viewMode === 'subject' && (
        <div className="glass-card rounded-3xl border border-white/10 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-3 text-center">Type</th>
                  <th className="py-3 px-3 text-center">Attended</th>
                  <th className="py-3 px-3 text-center">Bunked</th>
                  <th className="py-3 px-3 text-center">Total</th>
                  <th className="py-3 px-3 text-center">Attendance %</th>
                  <th className="py-3 px-4 text-center">Safe Bunks Left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {subjects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No subjects configured yet.
                    </td>
                  </tr>
                ) : (
                  subjects.map(s => {
                    const total = s.totalClasses || 0;
                    const attended = s.attendedClasses || 0;
                    const bunked = Math.max(0, total - attended);
                    const pct = total > 0 ? (attended / total) * 100 : 100;
                    const target = 80;
                    const minNeeded = Math.ceil(total * (target / 100));
                    const safeBunks = Math.max(0, attended - minNeeded);
                    const isSafe = pct >= target;

                    return (
                      <tr key={s._id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color || '#0047FF' }} />
                          <span>{s.name}</span>
                        </td>
                        <td className="py-3 px-3 text-center text-slate-400 capitalize text-[11px]">
                          {s.type || 'theory'}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-400">
                          {attended}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-red-400">
                          {bunked}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-white">
                          {total}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-lg font-black text-xs ${
                              isSafe ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                            }`}
                          >
                            {pct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {safeBunks > 0 ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs">
                              {safeBunks} safe bunk{safeBunks !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 font-bold text-xs">
                              0 bunks (Attend Next)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

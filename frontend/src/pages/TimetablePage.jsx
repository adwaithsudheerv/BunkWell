import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  CalendarDays, Plus, Save, Clock, BookOpen, Users,
  Check, LayoutGrid, X
} from 'lucide-react';
import ShareTimetableModal from '../components/ShareTimetableModal';
import { scheduleScheduleReminders } from '../lib/nativeNotifications';
import { Link } from 'react-router-dom';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// 10 standard hourly blocks from 8:00 AM to 6:00 PM
export const TIME_BLOCKS = [
  { periodNumber: 1, startTime: '08:00', endTime: '09:00', label: '08:00 AM - 09:00 AM' },
  { periodNumber: 2, startTime: '09:00', endTime: '10:00', label: '09:00 AM - 10:00 AM' },
  { periodNumber: 3, startTime: '10:00', endTime: '11:00', label: '10:00 AM - 11:00 AM' },
  { periodNumber: 4, startTime: '11:00', endTime: '12:00', label: '11:00 AM - 12:00 PM' },
  { periodNumber: 5, startTime: '12:00', endTime: '13:00', label: '12:00 PM - 01:00 PM' },
  { periodNumber: 6, startTime: '13:00', endTime: '14:00', label: '01:00 PM - 02:00 PM' },
  { periodNumber: 7, startTime: '14:00', endTime: '15:00', label: '02:00 PM - 03:00 PM' },
  { periodNumber: 8, startTime: '15:00', endTime: '16:00', label: '03:00 PM - 04:00 PM' },
  { periodNumber: 9, startTime: '16:00', endTime: '17:00', label: '04:00 PM - 05:00 PM' },
  { periodNumber: 10, startTime: '17:00', endTime: '18:00', label: '05:00 PM - 06:00 PM' },
];

export default function TimetablePage() {
  const [subjects, setSubjects] = useState([]);
  const [timetableId, setTimetableId] = useState(null);
  const [semName, setSemName] = useState('MCA Semester 1');
  const [section, setSection] = useState('A');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [slotPickerModal, setSlotPickerModal] = useState(null); // { day, slotIndex }

  // Schedule map: { Monday: [10 slots], Tuesday: [10 slots], ... }
  const [schedule, setSchedule] = useState(() => {
    const s = {};
    DAYS.forEach(day => {
      s[day] = TIME_BLOCKS.map(tb => ({
        periodNumber: tb.periodNumber,
        startTime: tb.startTime,
        endTime: tb.endTime,
        subjectId: '',
        subjectName: '',
        color: '',
      }));
    });
    return s;
  });

  const loadData = async () => {
    try {
      const [subRes, ttRes] = await Promise.all([api.get('/subjects'), api.get('/timetable')]);
      const fetchedSubjects = subRes.data.subjects || [];
      setSubjects(fetchedSubjects);

      if (ttRes.data.timetable) {
        const tt = ttRes.data.timetable;
        setTimetableId(tt._id);
        setSemName(tt.semesterName || 'MCA Semester 1');
        setSection(tt.section || 'A');

        const newSched = {};
        DAYS.forEach(day => {
          // Initialize empty 10 slots
          newSched[day] = TIME_BLOCKS.map(tb => ({
            periodNumber: tb.periodNumber,
            startTime: tb.startTime,
            endTime: tb.endTime,
            subjectId: '',
            subjectName: '',
            color: '',
          }));

          const dayData = tt.days?.find(d => d.day === day);
          if (dayData && dayData.periods) {
            dayData.periods.forEach(p => {
              // Match by startTime or periodNumber
              const slotIdx = TIME_BLOCKS.findIndex(tb => tb.startTime === p.startTime) !== -1
                ? TIME_BLOCKS.findIndex(tb => tb.startTime === p.startTime)
                : (p.periodNumber - 1);

              if (slotIdx >= 0 && slotIdx < 10) {
                const subObj = fetchedSubjects.find(s => s._id === (p.subjectId?._id || p.subjectId));
                newSched[day][slotIdx] = {
                  periodNumber: TIME_BLOCKS[slotIdx].periodNumber,
                  startTime: TIME_BLOCKS[slotIdx].startTime,
                  endTime: TIME_BLOCKS[slotIdx].endTime,
                  subjectId: subObj?._id || p.subjectId?._id || p.subjectId || '',
                  subjectName: subObj?.name || p.subjectName || p.subjectId?.name || '',
                  color: subObj?.color || '',
                };
              }
            });
          }
        });
        setSchedule(newSched);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load timetable data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignSubject = (day, slotIdx, subject) => {
    setSchedule(prev => {
      const nextDay = [...prev[day]];
      if (subject) {
        nextDay[slotIdx] = {
          ...nextDay[slotIdx],
          subjectId: subject._id,
          subjectName: subject.name,
          color: subject.color,
        };
      } else {
        // Clear slot
        nextDay[slotIdx] = {
          ...nextDay[slotIdx],
          subjectId: '',
          subjectName: '',
          color: '',
        };
      }
      return { ...prev, [day]: nextDay };
    });
    setSlotPickerModal(null);
  };

  const saveTimetable = async () => {
    setSaving(true);
    try {
      const daysPayload = DAYS.map(day => {
        const activePeriods = schedule[day]
          .filter(slot => Boolean(slot.subjectId || slot.subjectName))
          .map((slot, idx) => ({
            periodNumber: idx + 1,
            subjectId: slot.subjectId || undefined,
            subjectName: slot.subjectName,
            startTime: slot.startTime,
            endTime: slot.endTime,
          }));

        return {
          day,
          periods: activePeriods,
          isHoliday: activePeriods.length === 0,
        };
      });

      const payload = {
        semesterName: semName,
        section,
        days: daysPayload,
      };

      if (timetableId) {
        await api.put(`/timetable/${timetableId}`, payload);
      } else {
        const res = await api.post('/timetable', payload);
        setTimetableId(res.data.timetable._id);
      }
      scheduleScheduleReminders(payload);
      toast.success('Timetable saved successfully! 💾');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save timetable');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-20 rounded-2xl shimmer" />
        <div className="h-64 rounded-2xl shimmer" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
            <CalendarDays size={24} className="text-blue-500" /> Weekly Timetable
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            8:00 AM – 6:00 PM hourly block schedule (Monday to Saturday)
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowShareModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-semibold border border-blue-500/20 transition-all shadow-sm"
          >
            <Users size={14} /> Section Timetables
          </button>
          <button
            onClick={saveTimetable}
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold disabled:opacity-50 transition-all shadow-md shadow-blue-500/25 active:scale-95"
          >
            <Save size={15} /> {saving ? 'Saving...' : 'Save Timetable'}
          </button>
        </div>
      </div>

      {/* Timetable Name & Section Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 glass-card rounded-xl px-4 py-2.5 flex items-center gap-3 border border-white/10">
          <BookOpen size={18} className="text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">
              Timetable Name
            </label>
            <input
              type="text"
              value={semName}
              onChange={e => setSemName(e.target.value)}
              placeholder="Timetable name (e.g. MCA Semester 1)"
              className="w-full bg-transparent placeholder-slate-500 focus:outline-none text-sm font-semibold"
            />
          </div>
        </div>

        <div className="glass-card rounded-xl px-4 py-2.5 flex items-center gap-3 border border-white/10">
          <Users size={18} className="text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">
              Section
            </label>
            <input
              type="text"
              value={section}
              onChange={e => setSection(e.target.value)}
              placeholder="Section (e.g. A, B, C)"
              className="w-full bg-transparent placeholder-slate-500 focus:outline-none text-sm font-semibold"
            />
          </div>
        </div>
      </div>

      {subjects.length === 0 && (
        <div className="glass-card rounded-xl p-4 border border-blue-500/30 text-sm flex items-center justify-between gap-3">
          <span className="text-slate-300">
            ⚠️ You haven't added any subjects yet. Add subjects to assign them into your 8:00 AM – 6:00 PM blocks.
          </span>
          <Link
            to="/subjects"
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            Add Subjects
          </Link>
        </div>
      )}

      {/* Week-wise Timetable Matrix */}
      <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
        <div className="p-3.5 bg-white/5 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">
            Week-wise Timetable (Click any slot to assign or edit subject)
          </span>
          <span className="text-[11px] text-blue-400 font-medium">
            Section {section || 'A'} · Monday to Saturday
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[750px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="p-3 font-semibold text-slate-400 w-28">Time Slot</th>
                {DAYS.map(day => (
                  <th key={day} className="p-3 font-bold text-center border-l border-white/10">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {TIME_BLOCKS.map((tb, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-2.5 font-medium text-slate-400 whitespace-nowrap">
                    {tb.startTime} - {tb.endTime}
                  </td>
                  {DAYS.map(day => {
                    const slot = schedule[day]?.[idx];
                    const isAssigned = Boolean(slot?.subjectName);

                    return (
                      <td
                        key={day}
                        onClick={() => setSlotPickerModal({ day, slotIndex: idx })}
                        className="p-2 border-l border-white/10 text-center cursor-pointer hover:bg-blue-600/10 transition-colors"
                      >
                        {isAssigned ? (
                          <div
                            className="py-1.5 px-2 rounded-lg font-semibold truncate text-[11px] shadow-sm"
                            style={{
                              background: `${slot.color || '#0047FF'}25`,
                              color: slot.color || '#60a5fa',
                              border: `1px solid ${slot.color || '#0047FF'}50`
                            }}
                            title={slot.subjectName}
                          >
                            {slot.subjectName}
                          </div>
                        ) : (
                          <div className="py-1.5 text-slate-600 hover:text-blue-400 flex items-center justify-center">
                            <Plus size={13} />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={saveTimetable}
        disabled={saving}
        className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25 active:scale-[0.99] flex items-center justify-center gap-2"
      >
        <Save size={18} /> {saving ? 'Saving Timetable...' : 'Save Timetable Changes'}
      </button>

      {/* Slot Subject Picker Modal */}
      {slotPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="w-full max-w-sm glass-card rounded-2xl p-5 border border-white/10 animate-[slideUp_0.3s_ease-out]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <div>
                <h4 className="font-bold text-sm">Assign Class</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {slotPickerModal.day} · {TIME_BLOCKS[slotPickerModal.slotIndex]?.label}
                </p>
              </div>
              <button
                onClick={() => setSlotPickerModal(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {subjects.map(s => (
                <button
                  key={s._id}
                  onClick={() => handleAssignSubject(slotPickerModal.day, slotPickerModal.slotIndex, s)}
                  className="w-full p-3 rounded-xl bg-white/5 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/50 flex items-center gap-3 transition-all text-left"
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ background: s.color || '#0047FF' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{s.name}</p>
                    <span className="text-[10px] text-slate-400 capitalize">{s.type || 'theory'}</span>
                  </div>
                  <span className="text-xs text-blue-400 font-semibold">Select</span>
                </button>
              ))}

              {/* Clear Option */}
              <button
                onClick={() => handleAssignSubject(slotPickerModal.day, slotPickerModal.slotIndex, null)}
                className="w-full p-2.5 rounded-xl border border-dashed border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold text-center mt-2 transition-colors"
              >
                Set as Free / Break (Empty)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Timetable Modal */}
      <ShareTimetableModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onImportSuccess={loadData}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  CalendarDays, Plus, Save, Trash2, Clock, BookOpen, Users,
  Copy, Check, LayoutGrid, List, Sparkles, X, Camera
} from 'lucide-react';
import ShareTimetableModal from '../components/ShareTimetableModal';
import AITimetableScannerModal from '../components/AITimetableScannerModal';
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
  const [semName, setSemName] = useState('Semester 1');
  const [activeDay, setActiveDay] = useState('Monday');
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'grid'
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
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
        setSemName(tt.semesterName || 'Semester 1');

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
    // Auto-select current day of week if Mon-Sat
    const daysArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const cur = daysArr[new Date().getDay()];
    if (DAYS.includes(cur)) setActiveDay(cur);
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

  const handleCopyDay = (targetDay) => {
    if (!window.confirm(`Copy all classes from ${activeDay} to ${targetDay}?`)) return;
    setSchedule(prev => ({
      ...prev,
      [targetDay]: prev[activeDay].map(slot => ({ ...slot }))
    }));
    toast.success(`Schedule copied from ${activeDay} to ${targetDay}!`);
  };

  const handleClearDay = (day) => {
    if (!window.confirm(`Clear all scheduled classes for ${day}?`)) return;
    setSchedule(prev => ({
      ...prev,
      [day]: TIME_BLOCKS.map(tb => ({
        periodNumber: tb.periodNumber,
        startTime: tb.startTime,
        endTime: tb.endTime,
        subjectId: '',
        subjectName: '',
        color: '',
      }))
    }));
    toast.success(`Cleared ${day}`);
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

  const activePeriodsCount = schedule[activeDay]?.filter(s => s.subjectName).length || 0;

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
          {/* View toggle */}
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setViewMode('day')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <List size={14} /> Day
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={14} /> Week
            </button>
          </div>

          <button
            onClick={() => setShowScannerModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 hover:from-blue-600/30 hover:to-indigo-600/30 text-blue-300 text-xs font-bold border border-blue-500/30 transition-all shadow-sm active:scale-95"
          >
            <Camera size={14} className="text-blue-400" />
            AI Scan
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-semibold border border-blue-500/20 transition-all shadow-sm"
          >
            <Users size={14} /> Section
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

      {/* Semester Name input */}
      <div className="glass-card rounded-xl px-4 py-2.5 flex items-center gap-3 border border-white/10">
        <BookOpen size={18} className="text-blue-500 flex-shrink-0" />
        <input
          type="text"
          value={semName}
          onChange={e => setSemName(e.target.value)}
          placeholder="Semester name (e.g. Semester 3 - 2026)"
          className="flex-1 bg-transparent placeholder-slate-500 focus:outline-none text-sm font-medium"
        />
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

      {/* Day Mode (Single Day 8:00 AM to 6:00 PM Block Grid) */}
      {viewMode === 'day' && (
        <div className="space-y-4">
          {/* Day selection tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {DAYS.map(day => {
              const count = schedule[day]?.filter(s => s.subjectName).length || 0;
              const isActive = activeDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`flex-1 min-w-[100px] py-3 px-3 rounded-2xl border text-center transition-all ${
                    isActive
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/25 scale-[1.02]'
                      : 'glass-card border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider">{day.slice(0, 3)}</p>
                  <p className={`text-[11px] mt-0.5 ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                    {count} {count === 1 ? 'class' : 'classes'}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Active Day Action Bar */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-slate-300">
              {activeDay} Schedule ({activePeriodsCount} classes assigned)
            </span>
            <div className="flex items-center gap-2">
              <select
                onChange={e => {
                  if (e.target.value) {
                    handleCopyDay(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 hover:text-white focus:outline-none"
              >
                <option value="" disabled>Copy to...</option>
                {DAYS.filter(d => d !== activeDay).map(d => (
                  <option key={d} value={d} className="bg-slate-900 text-white">{d}</option>
                ))}
              </select>
              {activePeriodsCount > 0 && (
                <button
                  onClick={() => handleClearDay(activeDay)}
                  className="px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
                >
                  Clear Day
                </button>
              )}
            </div>
          </div>

          {/* 10 Hourly Blocks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {schedule[activeDay]?.map((slot, idx) => {
              const isAssigned = Boolean(slot.subjectName);
              const timeLabel = TIME_BLOCKS[idx].label;

              return (
                <div
                  key={idx}
                  className={`glass-card rounded-2xl p-4 border transition-all ${
                    isAssigned
                      ? 'border-blue-500/30 hover:border-blue-500/60'
                      : 'border-white/10 hover:border-white/20 border-dashed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {/* Time & Slot indicator */}
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                        <Clock size={13} className="text-blue-500" />
                        <span>{timeLabel}</span>
                      </div>
                    </div>

                    {/* Slot Actions */}
                    {isAssigned && (
                      <button
                        onClick={() => handleAssignSubject(activeDay, idx, null)}
                        title="Remove class"
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Slot Content */}
                  <div className="mt-3">
                    {isAssigned ? (
                      <div
                        onClick={() => setSlotPickerModal({ day: activeDay, slotIndex: idx })}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                            style={{ background: slot.color || '#0047FF' }}
                          />
                          <p className="font-semibold text-sm truncate">{slot.subjectName}</p>
                        </div>
                        <span className="text-[11px] text-blue-400 font-medium ml-2">Change</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSlotPickerModal({ day: activeDay, slotIndex: idx })}
                        className="w-full py-3 px-4 rounded-xl border border-dashed border-white/15 hover:border-blue-500/50 hover:bg-blue-600/5 text-slate-400 hover:text-blue-400 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                      >
                        <Plus size={15} />
                        Add Class to {TIME_BLOCKS[idx].startTime} slot
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week Matrix Mode (Desktop & Tablet Overview) */}
      {viewMode === 'grid' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
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
      )}

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

      {/* AI Timetable Photo Scanner Modal */}
      <AITimetableScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onTimetableApplied={() => {
          loadData();
          toast.success('AI Timetable Applied Successfully! 🎉');
        }}
      />
    </div>
  );
}

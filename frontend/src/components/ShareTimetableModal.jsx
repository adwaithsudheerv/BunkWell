import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Share2, Download, Copy, Check, X, Users, BookOpen, Sparkles, Calendar, Clock, ChevronDown, ChevronUp, FileText } from 'lucide-react';

export default function ShareTimetableModal({ isOpen, onClose, onImportSuccess }) {
  const [tab, setTab] = useState('share'); // 'share' | 'import'

  // Share state
  const [section, setSection] = useState('A');
  const [customCode, setCustomCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [sharedData, setSharedData] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [mySchedule, setMySchedule] = useState(null);
  const [mySubjects, setMySubjects] = useState([]);
  const [activeDayView, setActiveDayView] = useState('Monday');

  // Import state
  const [importCode, setImportCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewDay, setPreviewDay] = useState('Monday');

  useEffect(() => {
    if (isOpen) {
      // Preload current user's timetable and subjects for share review
      Promise.all([
        api.get('/timetable'),
        api.get('/subjects')
      ]).then(([ttRes, subRes]) => {
        setMySchedule(ttRes.data.timetable);
        setMySubjects(subRes.data.subjects || []);
      }).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleShare = async (e) => {
    e.preventDefault();
    setShareLoading(true);
    try {
      const res = await api.post('/timetable/share', {
        section,
        customCode: customCode.trim()
      });
      setGeneratedCode(res.data.shareCode);
      setSharedData(res.data);
      toast.success(res.data.message || 'Timetable shared successfully! 🎉');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to share timetable');
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    toast.success(`Share Code ${generatedCode} copied! 📋`);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyFullText = () => {
    const tt = sharedData?.days || mySchedule?.days || [];
    const subs = sharedData?.subjects || mySubjects || [];

    let text = `📅 BunkClub Class Timetable (Code: ${generatedCode || 'Active'})\n`;
    text += `Section: ${section}\n`;
    text += `Subjects: ${subs.map(s => s.name).join(', ')}\n\n`;

    tt.forEach(d => {
      const periods = (d.periods || []).filter(p => p.subjectName);
      if (periods.length > 0) {
        text += `📍 ${d.day}:\n`;
        periods.forEach(p => {
          text += `  • P${p.periodNumber} (${p.startTime || '—'}): ${p.subjectName}\n`;
        });
        text += '\n';
      }
    });

    text += `👉 Import this timetable directly in BunkClub using Code: ${generatedCode}`;

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    toast.success('Full timetable copied as text! Paste in your class group 📋');
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleFetchPreview = async (e) => {
    e.preventDefault();
    if (!importCode.trim()) return;

    setPreviewLoading(true);
    try {
      const res = await api.get(`/timetable/shared/${importCode.trim()}`);
      setPreview(res.data.shared);
      if (res.data.shared?.days?.length > 0) {
        setPreviewDay(res.data.shared.days[0].day);
      }
      toast.success('Timetable found! Full schedule loaded.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not find that timetable code');
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await api.post(`/timetable/import/${preview.shareCode}`);
      toast.success(res.data.message || 'Timetable imported into your BunkClub! 🎉');
      if (onImportSuccess) onImportSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to import timetable');
    } finally {
      setImporting(false);
    }
  };

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full max-w-xl rounded-3xl modal-surface shadow-2xl p-5 sm:p-6 relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center flex-shrink-0">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Class Section Timetable Sync</h2>
              <p className="text-[11px] text-slate-400">Share or clone full semester schedules in 1 tap</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-1 bg-white/5 rounded-xl my-3 text-xs font-semibold">
          <button
            onClick={() => setTab('share')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              tab === 'share' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Share2 size={13} /> Share My Timetable
          </button>
          <button
            onClick={() => setTab('import')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              tab === 'import' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Download size={13} /> Import Class Code
          </button>
        </div>

        {/* CONTENT 1: SHARE */}
        {tab === 'share' && (
          <div className="space-y-4 overflow-y-auto pr-1">
            <form onSubmit={handleShare} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Section
                  </label>
                  <input
                    type="text"
                    value={section}
                    onChange={e => setSection(e.target.value.toUpperCase())}
                    placeholder="e.g. A, B, CS-1"
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                    maxLength={10}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Custom Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={customCode}
                    onChange={e => setCustomCode(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                    placeholder="e.g. AMR-MCA-A"
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono font-semibold"
                    maxLength={14}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={shareLoading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs active:scale-95 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5"
              >
                <Sparkles size={14} />
                {shareLoading ? 'Packaging Everything…' : 'Generate Full Timetable Share Code'}
              </button>
            </form>

            {/* Generated Code Result */}
            {generatedCode && (
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-center animate-[fadeIn_0.2s_ease-out] space-y-3">
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">
                  Class Share Code Generated
                </span>
                <div className="text-2xl font-black text-white font-mono tracking-widest select-all">
                  {generatedCode}
                </div>

                <div className="flex gap-2 justify-center">
                  <button
                    onClick={handleCopyCode}
                    className="px-3.5 py-1.5 rounded-xl bg-white text-black text-xs font-bold hover:bg-slate-200 transition-all inline-flex items-center gap-1.5"
                  >
                    {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    {copied ? 'Code Copied!' : 'Copy Code'}
                  </button>

                  <button
                    onClick={handleCopyFullText}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-sm"
                  >
                    {copiedText ? <Check size={13} className="text-white" /> : <FileText size={13} />}
                    {copiedText ? 'Text Copied!' : 'Copy Full Timetable Text'}
                  </button>
                </div>
              </div>
            )}

            {/* What is being shared: Full list of subjects and schedule */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <BookOpen size={14} className="text-blue-500" /> All Subjects Included ({mySubjects.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mySubjects.map((s, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 font-semibold flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color || '#0047FF' }} />
                    <span className="text-white">{s.name}</span>
                    <span className="text-slate-400 text-[10px]">({s.type || 'theory'})</span>
                  </span>
                ))}
              </div>

              {/* Day preview toggle */}
              <div className="pt-2 border-t border-white/10">
                <p className="text-[11px] text-slate-400 font-semibold mb-1.5">Schedule Preview by Day:</p>
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setActiveDayView(day)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        activeDayView === day
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>

                {/* Period slots for active day */}
                <div className="mt-2 space-y-1">
                  {(() => {
                    const dayObj = mySchedule?.days?.find(d => d.day === activeDayView);
                    const periods = (dayObj?.periods || []).filter(p => p.subjectName);
                    if (periods.length === 0) {
                      return <p className="text-[10px] text-slate-500 italic py-1">No classes on {activeDayView}</p>;
                    }
                    return periods.map((p, i) => (
                      <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/5 text-[11px]">
                        <span className="text-slate-400 font-mono font-bold">P{p.periodNumber} ({p.startTime || '—'})</span>
                        <span className="text-white font-bold">{p.subjectName}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONTENT 2: IMPORT / FORK */}
        {tab === 'import' && (
          <div className="space-y-4 overflow-y-auto pr-1">
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter your classmate's 6-character code to clone their entire timetable & subject list in 1 second.
            </p>

            <form onSubmit={handleFetchPreview} className="flex gap-2">
              <input
                type="text"
                value={importCode}
                onChange={e => setImportCode(e.target.value.toUpperCase())}
                placeholder="Enter Code (e.g. BC-4821 or AMR-MCA-A)"
                className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono tracking-wider uppercase font-semibold"
                required
              />
              <button
                type="submit"
                disabled={previewLoading || !importCode.trim()}
                className="px-4 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-slate-200 transition-all flex items-center gap-1 shadow-sm"
              >
                {previewLoading ? 'Finding…' : 'Load Preview'}
              </button>
            </form>

            {preview && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3.5 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-white font-bold text-sm">{preview.title}</h4>
                    <p className="text-xs text-slate-400">
                      Created by <strong className="text-blue-400">{preview.creatorName}</strong>
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {preview.subjects?.length || 0} Subjects Included
                  </span>
                </div>

                {/* 1. Subjects list */}
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Subjects to be Imported:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.subjects?.map((sub, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-white font-semibold flex items-center gap-1.5"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: sub.color || '#0047FF' }} />
                        <span>{sub.name}</span>
                        <span className="text-slate-400 text-[10px]">({sub.type || 'theory'})</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* 2. Full Day-wise Timetable Breakdown */}
                <div className="pt-2 border-t border-white/10">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Day-by-Day Schedule on That Date:
                  </p>

                  <div className="flex gap-1 overflow-x-auto pb-1.5 scrollbar-none">
                    {DAYS.map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setPreviewDay(day)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          previewDay === day
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
                    {(() => {
                      const dayObj = preview.days?.find(d => d.day === previewDay);
                      const periods = (dayObj?.periods || []).filter(p => p.subjectName);
                      if (periods.length === 0) {
                        return <p className="text-[11px] text-slate-500 italic py-1">No periods scheduled on {previewDay}</p>;
                      }
                      return periods.map((p, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 text-xs">
                          <span className="text-slate-400 font-mono font-bold">Period {p.periodNumber} ({p.startTime || '8:00 AM'})</span>
                          <span className="text-white font-bold">{p.subjectName}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <button
                    onClick={handleConfirmImport}
                    disabled={importing}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs active:scale-95 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5"
                  >
                    <Download size={14} />
                    {importing ? 'Cloning All Subjects & Schedule…' : 'Fork & Clone All Subjects & Timetables'}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-1.5">
                    Clones entire subject list and all 8:00 AM – 6:00 PM blocks. You can customize them personally anytime.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

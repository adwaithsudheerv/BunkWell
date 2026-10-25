import { useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Share2, Download, Copy, Check, X, Users, BookOpen, Sparkles, ArrowRight } from 'lucide-react';

export default function ShareTimetableModal({ isOpen, onClose, onImportSuccess }) {
  const [tab, setTab] = useState('share'); // 'share' | 'import'

  // Share state
  const [section, setSection] = useState('A');
  const [customCode, setCustomCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Import state
  const [importCode, setImportCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);

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
    toast.success(`Share Code ${generatedCode} copied to clipboard! 📋`);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleFetchPreview = async (e) => {
    e.preventDefault();
    if (!importCode.trim()) return;

    setPreviewLoading(true);
    try {
      const res = await api.get(`/timetable/shared/${importCode.trim()}`);
      setPreview(res.data.shared);
      toast.success('Timetable found! Review details below.');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full max-w-lg rounded-3xl modal-surface shadow-2xl p-6 sm:p-7 relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Users size={19} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Class Section Timetable Sync</h2>
              <p className="text-xs text-slate-400">Share with classmates or fork your section's schedule</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-1 bg-white/5 rounded-xl my-4 text-xs font-semibold">
          <button
            onClick={() => setTab('share')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              tab === 'share' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Share2 size={14} /> Share My Timetable
          </button>
          <button
            onClick={() => setTab('import')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              tab === 'import' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Download size={14} /> Import Class Code
          </button>
        </div>

        {/* CONTENT 1: SHARE */}
        {tab === 'share' && (
          <div className="space-y-4 overflow-y-auto pr-1">
            <p className="text-xs text-slate-300 leading-relaxed">
              Generate a shareable code for your college section (e.g. Section A). Classmates can clone your entire timetable with 1 click without typing 36 periods!
            </p>

            <form onSubmit={handleShare} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Section
                  </label>
                  <input
                    type="text"
                    value={section}
                    onChange={e => setSection(e.target.value.toUpperCase())}
                    placeholder="e.g. A, B, CS-1"
                    className="w-full bg-[#18181b] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    maxLength={10}
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Custom Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={customCode}
                    onChange={e => setCustomCode(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                    placeholder="e.g. AMR-MCA-A"
                    className="w-full bg-[#18181b] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    maxLength={14}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={shareLoading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs active:scale-95 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5"
              >
                <Sparkles size={14} />
                {shareLoading ? 'Generating Share Code…' : 'Generate Class Share Code'}
              </button>
            </form>

            {generatedCode && (
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-center animate-[fadeIn_0.2s_ease-out]">
                <span className="text-xs text-blue-400 font-semibold uppercase tracking-wider block mb-1">
                  Your Section Share Code
                </span>
                <div className="text-2xl font-black text-white font-mono tracking-widest my-2 select-all">
                  {generatedCode}
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Share this code with your classmates. They can enter it in BunkClub to clone your timetable!
                </p>
                <button
                  onClick={handleCopyCode}
                  className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-slate-200 transition-all inline-flex items-center gap-1.5"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copied ? 'Code Copied!' : 'Copy Code to Share'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* CONTENT 2: IMPORT / FORK */}
        {tab === 'import' && (
          <div className="space-y-4 overflow-y-auto pr-1">
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter your classmate's or CR's 6-character code to clone their timetable. You will receive an independent copy that you can personalize anytime.
            </p>

            <form onSubmit={handleFetchPreview} className="flex gap-2">
              <input
                type="text"
                value={importCode}
                onChange={e => setImportCode(e.target.value.toUpperCase())}
                placeholder="Enter Code (e.g. BC-4821 or AMR-MCA-A)"
                className="flex-1 bg-[#18181b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono tracking-wider uppercase"
                required
              />
              <button
                type="submit"
                disabled={previewLoading || !importCode.trim()}
                className="px-4 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-slate-200 transition-all flex items-center gap-1"
              >
                {previewLoading ? 'Finding…' : 'Preview'}
              </button>
            </form>

            {preview && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-white font-bold text-sm">{preview.title}</h4>
                    <p className="text-xs text-slate-400">
                      Shared by <strong className="text-blue-400">{preview.creatorName}</strong>
                      {preview.college && ` • ${preview.college}`}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                    {preview.subjects?.length || 0} Subjects
                  </span>
                </div>

                {/* Subject chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {preview.subjects?.map((sub, i) => (
                    <span
                      key={i}
                      className="text-[11px] px-2 py-1 rounded-lg bg-black/50 border border-white/10 text-slate-300"
                    >
                      {sub.name}
                    </span>
                  ))}
                </div>

                <div className="pt-2 border-t border-white/10">
                  <button
                    onClick={handleConfirmImport}
                    disabled={importing}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs active:scale-95 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5"
                  >
                    <Download size={14} />
                    {importing ? 'Cloning into Your Account…' : 'Fork & Import into My BunkClub'}
                  </button>
                  <p className="text-[10px] text-slate-500 text-center mt-1.5">
                    Cloning will set this as your active schedule. Your existing attendance records stay safe.
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
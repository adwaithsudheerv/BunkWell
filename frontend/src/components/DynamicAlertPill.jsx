import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { autoSilentService } from '../lib/classAutoSilent';
import {
  Flame, Check, X, Ban, RefreshCw, Send,
  Volume2, VolumeX, Clock, ChevronDown, ChevronUp
} from 'lucide-react';

export default function DynamicAlertPill() {
  const [expanded, setExpanded] = useState(false);
  const [silentInfo, setSilentInfo] = useState(null);
  const [periodAlert, setPeriodAlert] = useState(null);
  const [chitAlert, setChitAlert] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [marking, setMarking] = useState(false);

  // Listen to Auto-Silent events
  useEffect(() => {
    const handleSilent = (e) => {
      setSilentInfo(e.detail);
    };
    window.addEventListener('class-silent-status', handleSilent);
    return () => window.removeEventListener('class-silent-status', handleSilent);
  }, []);

  // Listen to Period Check-In events
  useEffect(() => {
    const handlePeriodCheck = (e) => {
      setPeriodAlert(e.detail);
      setExpanded(true);
    };
    window.addEventListener('period-check-prompt', handlePeriodCheck);
    return () => window.removeEventListener('period-check-prompt', handlePeriodCheck);
  }, []);

  // Listen to Incoming One-Time Chit events
  useEffect(() => {
    const handleIncomingChit = (e) => {
      setChitAlert(e.detail);
      setExpanded(true);
    };
    window.addEventListener('incoming-chit-popup', handleIncomingChit);
    return () => window.removeEventListener('incoming-chit-popup', handleIncomingChit);
  }, []);

  // Mark attendance directly from the heads-up pill
  const handleMarkAttendance = async (status) => {
    if (!periodAlert || marking) return;
    setMarking(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      await api.post('/attendance/mark', {
        subjectId: periodAlert.subjectId,
        periodNumber: periodAlert.periodNumber,
        date: now,
        status
      });

      if (status === 'absent' || status === 'cancelled') {
        autoSilentService.markPeriodBunked(periodAlert.periodNumber, now);
      }

      const label = status === 'present' ? 'Present ✅' : status === 'absent' ? 'Absent (Active Mode 🔔)' : status === 'cancelled' ? 'Cancelled 🚫' : 'Replaced 🔄';
      toast.success(`Marked P${periodAlert.periodNumber} (${periodAlert.subjectName}): ${label}`);
      window.dispatchEvent(new CustomEvent('attendance-updated'));
      setPeriodAlert(null);
      setExpanded(false);
    } catch (e) {
      toast.error('Failed to mark attendance');
    } finally {
      setMarking(false);
    }
  };

  // Reply to Chit directly from the heads-up pill and incinerate it
  const handleReplyAndBurn = async (e) => {
    e?.preventDefault();
    if (!chitAlert || !replyText.trim()) return;

    try {
      await api.post(`/chat/conversations/${chitAlert.conversationId}/messages`, {
        content: replyText.trim(),
        type: 'chit',
        isViewOnce: true,
        replyToMsgId: chitAlert.messageId
      });

      toast.success('Replied & original chit burned away! 🔥');
      setChitAlert(null);
      setReplyText('');
      setExpanded(false);
    } catch (err) {
      toast.error('Failed to reply');
    }
  };

  const hasActiveAlert = Boolean(periodAlert || chitAlert);

  return (
    <div className="fixed top-2.5 left-0 right-0 z-50 flex justify-center px-3 pointer-events-none select-none">
      <div
        className={`pointer-events-auto transition-all duration-300 ease-out border shadow-2xl backdrop-blur-2xl ${
          expanded
            ? 'w-full max-w-md rounded-3xl p-4 bg-black/90 border-white/20 shadow-blue-500/10'
            : 'rounded-full px-4 py-2 bg-black/85 border-white/15 cursor-pointer hover:border-white/30 hover:scale-105 active:scale-95'
        }`}
        onClick={() => {
          if (!expanded && (hasActiveAlert || silentInfo)) {
            setExpanded(true);
          }
        }}
      >
        {/* COMPACT PILL STATE */}
        {!expanded ? (
          <div className="flex items-center gap-2.5 text-xs font-extrabold text-white">
            {chitAlert ? (
              <>
                <span className="w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] flex items-center justify-center font-black animate-pulse">
                  ①
                </span>
                <span className="truncate">One-Time Chit from @{chitAlert.senderName}</span>
                <span className="text-[10px] text-amber-400 font-bold ml-1">Tap to View</span>
              </>
            ) : periodAlert ? (
              <>
                <Clock size={14} className="text-blue-400 animate-spin" />
                <span className="truncate">Mark P{periodAlert.periodNumber}: {periodAlert.subjectName}</span>
                <span className="text-[10px] text-blue-400 font-bold ml-1">Tap to Record</span>
              </>
            ) : silentInfo?.isSilent ? (
              <>
                <VolumeX size={14} className="text-amber-400" />
                <span className="truncate text-slate-200">
                  Lecture in Session • Auto-Silent Active
                </span>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping ml-1" />
              </>
            ) : (
              <>
                <Volume2 size={14} className="text-emerald-400" />
                <span className="truncate text-slate-200">
                  {silentInfo?.text ? silentInfo.text : 'Ringer Normal • Free / Break Hour'}
                </span>
              </>
            )}
          </div>
        ) : (
          /* EXPANDED HEADS-UP ISLAND STATE */
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                {chitAlert ? (
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-black text-xs flex items-center justify-center font-black">
                    ①
                  </span>
                ) : periodAlert ? (
                  <Clock size={16} className="text-blue-400" />
                ) : (
                  silentInfo?.isSilent ? <VolumeX size={16} className="text-amber-400" /> : <Volume2 size={16} className="text-emerald-400" />
                )}

                <span className="text-xs font-black uppercase tracking-wider text-white">
                  {chitAlert ? 'One-Time Chit (Will Burn)' : periodAlert ? 'Class Attendance Check-In' : 'Auto-Silent Class Status'}
                </span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <ChevronUp size={16} />
              </button>
            </div>

            {/* 1. ONE-TIME CHIT VIEW & DIRECT REPLY POP-UP */}
            {chitAlert && (
              <div className="space-y-2.5">
                <div className="p-3 rounded-2xl bg-white/5 border border-amber-500/30 text-white">
                  <p className="text-[11px] text-amber-400 font-bold mb-1">
                    Secret Chit from @{chitAlert.senderName}:
                  </p>
                  <p className="text-sm font-semibold">
                    "{chitAlert.content}"
                  </p>
                </div>

                <form onSubmit={handleReplyAndBurn} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Reply then & there itself (will burn original)..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1 p-2 rounded-xl text-xs font-bold bg-white/10 text-white placeholder-slate-400 border border-white/10 focus:outline-none focus:border-amber-400"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim()}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-400 hover:to-red-400 disabled:opacity-40 text-black font-black text-xs flex items-center gap-1 shadow-md active:scale-95"
                  >
                    <span>Reply & Burn</span>
                    <Flame size={13} className="fill-black" />
                  </button>
                </form>
              </div>
            )}

            {/* 2. DIRECT ATTENDANCE ACTION BUTTONS (Present, Absent, Cancelled, Replaced) */}
            {periodAlert && !chitAlert && (
              <div className="space-y-2">
                <p className="text-xs text-slate-300 font-medium">
                  Did you attend <strong className="text-white">Period {periodAlert.periodNumber} ({periodAlert.subjectName})</strong>?
                </p>

                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    onClick={() => handleMarkAttendance('present')}
                    disabled={marking}
                    className="py-2.5 px-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shadow-md flex flex-col items-center gap-0.5 active:scale-95 transition-all"
                  >
                    <Check size={14} />
                    <span>Present</span>
                  </button>

                  <button
                    onClick={() => handleMarkAttendance('absent')}
                    disabled={marking}
                    className="py-2.5 px-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-[11px] shadow-md flex flex-col items-center gap-0.5 active:scale-95 transition-all"
                  >
                    <X size={14} />
                    <span>Absent</span>
                  </button>

                  <button
                    onClick={() => handleMarkAttendance('cancelled')}
                    disabled={marking}
                    className="py-2.5 px-1 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black text-[11px] shadow-md flex flex-col items-center gap-0.5 active:scale-95 transition-all"
                  >
                    <Ban size={14} />
                    <span>Cancel</span>
                  </button>

                  <button
                    onClick={() => handleMarkAttendance('swapped')}
                    disabled={marking}
                    className="py-2.5 px-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-[11px] shadow-md flex flex-col items-center gap-0.5 active:scale-95 transition-all"
                  >
                    <RefreshCw size={14} />
                    <span>Swap</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. AUTO-SILENT & BREAK STATUS INFO */}
            {!chitAlert && !periodAlert && silentInfo && (
              <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <p className="text-xs font-bold text-slate-200">
                  {silentInfo.text}
                </p>
                <p className="text-[10px] text-slate-400">
                  {silentInfo.isSilent
                    ? 'Your phone is automatically silenced during lectures and restores ringer during breaks/free hours.'
                    : 'Ringer restored. Next lecture will automatically activate silent mode.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

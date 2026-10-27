import { useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import { Flame, Users, CheckCircle2, XCircle, AlertTriangle, Zap, Check } from 'lucide-react';

export default function MassBunkCard({ poll, onVoted, currentUserId }) {
  const { isDark } = useTheme();
  const [voting, setVoting] = useState(false);
  const [applying, setApplying] = useState(false);

  if (!poll) return null;

  const votes = poll.votes || [];
  const totalVotes = votes.length;
  const bunkVotes = votes.filter(v => v.choice === 'bunk');
  const attendVotes = votes.filter(v => v.choice === 'attend');
  const bunkPct = totalVotes > 0 ? Math.round((bunkVotes.length / totalVotes) * 100) : 0;

  const userVote = votes.find(v => String(v.userId) === String(currentUserId))?.choice;
  const isPassed = poll.status === 'passed' || (totalVotes >= 2 && bunkPct >= 60);
  const isFailed = poll.status === 'failed' || (totalVotes >= 2 && attendVotes.length > bunkVotes.length);

  const handleVote = async (choice) => {
    setVoting(true);
    try {
      const res = await api.post('/mass-bunk/vote', { pollId: poll._id, choice });
      toast.success(res.data.message);
      if (onVoted) onVoted(res.data.poll);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit vote');
    } finally {
      setVoting(false);
    }
  };

  const handleApplyBunk = async () => {
    setApplying(true);
    try {
      const res = await api.post('/mass-bunk/apply', { pollId: poll._id });
      toast.success(res.data.message || 'Mass bunk attendance applied! 🚨');
      window.dispatchEvent(new CustomEvent('attendance-updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply mass bunk');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className={`p-4 rounded-3xl border shadow-lg transition-all ${
      isPassed
        ? isDark
          ? 'bg-gradient-to-br from-red-950/40 via-[#151c28] to-[#0f1523] border-red-500/50 text-white shadow-red-950/30'
          : 'bg-gradient-to-br from-red-50 via-white to-amber-50 border-red-300 text-slate-900 shadow-red-100'
        : isDark
          ? 'bg-[#121824] border-slate-700/80 text-white shadow-blue-950/20'
          : 'bg-white border-slate-200 text-slate-900 shadow-slate-200/60'
    }`}>
      {/* Header Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span className="text-[11px] font-black uppercase tracking-wider text-red-500 dark:text-red-400">
            🚨 Class Mass Bunk Poll
          </span>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${
          isPassed
            ? 'bg-red-500/20 text-red-500 dark:text-red-400 border-red-500/40'
            : isFailed
              ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border-amber-500/40'
              : 'bg-blue-500/20 text-blue-500 dark:text-blue-400 border-blue-500/40'
        }`}>
          {isPassed ? 'Approved by Class! 🔥' : isFailed ? 'Traitor Alert ⚠️' : 'Voting Active 🗳️'}
        </span>
      </div>

      {/* Target Subject & Period */}
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <h4 className="font-black text-base sm:text-lg tracking-tight">
            {poll.subjectName}
          </h4>
          <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-red-600 text-white">
            Period {poll.periodNumber}
          </span>
        </div>
        <p className={`text-xs mt-1 italic font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          "{poll.reason}"
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          Initiated by <strong className={isDark ? 'text-white' : 'text-black'}>@{poll.creatorName}</strong> • {poll.date}
        </p>
      </div>

      {/* Consensus Meter */}
      <div className="space-y-1.5 my-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
            <Flame size={14} className="fill-red-500" />
            Class Bunk Solidarity: {bunkPct}%
          </span>
          <span className="text-slate-400 text-[11px]">
            {bunkVotes.length} Bunk vs {attendVotes.length} Attend ({totalVotes} votes)
          </span>
        </div>

        <div className="h-2.5 rounded-full overflow-hidden bg-black/20 dark:bg-white/10 flex">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-500"
            style={{ width: `${bunkPct}%` }}
          />
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${100 - bunkPct}%` }}
          />
        </div>
      </div>

      {/* Voting Buttons */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <button
          onClick={() => handleVote('bunk')}
          disabled={voting}
          className={`py-2 px-1 rounded-2xl text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1 border active:scale-95 ${
            userVote === 'bunk'
              ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30 ring-2 ring-red-400'
              : isDark
                ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
          }`}
        >
          <Flame size={14} className={userVote === 'bunk' ? 'fill-white' : 'text-red-500'} />
          <span>I'm In ({bunkVotes.length})</span>
        </button>

        <button
          onClick={() => handleVote('attend')}
          disabled={voting}
          className={`py-2 px-1 rounded-2xl text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1 border active:scale-95 ${
            userVote === 'attend'
              ? 'bg-amber-600 text-white border-amber-500 shadow-md ring-2 ring-amber-400'
              : isDark
                ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
          }`}
        >
          <Users size={14} className={userVote === 'attend' ? 'fill-white' : 'text-amber-500'} />
          <span>Attending ({attendVotes.length})</span>
        </button>

        <button
          onClick={() => handleVote('neutral')}
          disabled={voting}
          className={`py-2 px-1 rounded-2xl text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1 border active:scale-95 ${
            userVote === 'neutral'
              ? 'bg-blue-600 text-white border-blue-500 shadow-md ring-2 ring-blue-400'
              : isDark
                ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
          }`}
        >
          <span>👀 50-50</span>
        </button>
      </div>

      {/* 1-Tap Apply Bunk Button if Passed */}
      {isPassed && (
        <button
          onClick={handleApplyBunk}
          disabled={applying}
          className="w-full mt-3 py-2 px-3 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white font-black text-xs shadow-md shadow-red-600/30 transition-all flex items-center justify-center gap-1.5"
        >
          <Zap size={14} className="fill-white" />
          <span>{applying ? 'Applying...' : '⚡ 1-Tap Apply Mass Bunk to Today'}</span>
        </button>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  TrendingUp, TrendingDown, BookOpen, CalendarDays, Award,
  AlertTriangle, CheckCircle2, Clock, ChevronRight, Zap, Sparkles, HelpCircle, Users, ChevronDown, ChevronUp
} from 'lucide-react';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import OnboardingModal from '../components/OnboardingModal';
import QuickBunkSimulator from '../components/QuickBunkSimulator';
import ShareTimetableModal from '../components/ShareTimetableModal';

function SubjectCard({ subject, target, onUpdate }) {
  const [bunkExpanded, setBunkExpanded] = useState(false);
  const pct = subject.percentage ?? (subject.totalClasses > 0 ? (subject.attendedClasses / subject.totalClasses) * 100 : 100);
  const isOnTrack = pct >= target;
  const bunkCount = subject.bunkHistory?.length || 0;

  const handleQuickMark = async (status) => {
    try {
      const res = await api.post('/attendance/quick-mark', { subjectId: subject._id, status });
      toast.success(res.data.message);
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error('Failed to update attendance');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="glass-card rounded-3xl p-5 border border-white/10 relative overflow-hidden flex flex-col justify-between hover:border-blue-500/40 transition-all shadow-sm">
      {/* Accent vertical line (matching reference photo) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ background: isOnTrack ? '#10b981' : '#ef4444' }}
      />

      <div className="pl-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-base truncate">{subject.name}</h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 uppercase font-semibold">
                {subject.type || 'theory'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Attendance: <span className="text-white font-bold">{subject.attendedClasses}/{subject.totalClasses}</span>
            </p>
            <p className="text-xs font-bold mt-1 text-emerald-400">
              {isOnTrack ? (
                <span>On Track ✅ • You can miss {subject.canBunk ?? 0} class{subject.canBunk === 1 ? '' : 'es'}</span>
              ) : (
                <span className="text-red-400">Need next {subject.needMore ?? 1} classes to reach {target}%</span>
              )}
            </p>
          </div>

          {/* Radial badge and 1-tap manual buttons */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div
              className="px-2.5 py-1 rounded-xl text-xs font-black border"
              style={{
                background: isOnTrack ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                borderColor: isOnTrack ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                color: isOnTrack ? '#10b981' : '#ef4444'
              }}
            >
              {pct.toFixed(2)}%
            </div>

            {/* Quick 1-tap Buttons (Green Check & Red Cross from reference photo) */}
            <div className="flex items-center gap-2 mt-0.5">
              <button
                onClick={() => handleQuickMark('present')}
                title="Mark Attended Today (+1)"
                className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 active:scale-90 transition-all font-bold text-xs"
              >
                ✓
              </button>
              <button
                onClick={() => handleQuickMark('absent')}
                title="Mark Bunked Today (Logs Date & Period)"
                className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md shadow-red-500/25 active:scale-90 transition-all font-bold text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Bunk History Pill */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => setBunkExpanded(!bunkExpanded)}
            className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white font-semibold transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-blue-500" />
              Bunked Dates ({bunkCount})
            </span>
            {bunkExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {bunkExpanded && (
            <div className="mt-2 space-y-1 animate-[fadeIn_0.2s_ease-out]">
              {bunkCount === 0 ? (
                <p className="text-[11px] text-slate-500 italic py-0.5">
                  No bunks recorded in BunkClub yet 🎯
                </p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {subject.bunkHistory.map((b, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-white/5 border border-white/5 text-xs"
                    >
                      <span className="font-medium text-slate-300">
                        📅 {formatDate(b.date)}
                      </span>
                      <span className="font-bold text-red-400 text-[11px]">
                        Period {b.periodNumber}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const target = user?.attendanceTarget || 80;

  const loadData = () => {
    return Promise.all([
      api.get('/analytics/overview'),
      api.get('/timetable/today'),
    ]).then(([analyticsRes, todayRes]) => {
      setAnalytics(analyticsRes.data);
      setTodaySchedule(todayRes.data);
    }).catch(console.error);
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));

    if (!localStorage.getItem('bunkwell_tour_done')) {
      setShowTour(true);
    }
  }, []);

  const handleSeedDemo = async () => {
    try {
      setLoading(true);
      await api.post('/analytics/seed-demo');
      await loadData();
      toast.success('Sample semester subjects loaded! 🎉');
    } catch (err) {
      toast.error('Failed to load demo data');
    } finally {
      setLoading(false);
    }
  };

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  if (loading) return (
    <div className="p-6 space-y-4 animate-pulse">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-3xl shimmer" />)}
    </div>
  );

  const safe = analytics?.subjects?.filter(s => s.status === 'safe').length || 0;
  const danger = analytics?.subjects?.filter(s => s.status === 'danger').length || 0;

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Greeting & Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-black flex items-center gap-2">
            {greeting}, <span className="text-blue-500 font-black">@{user?.username || 'student'}</span> 👋
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">{today} • {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-xs font-bold text-blue-400 border border-blue-500/20 transition-all shadow-sm"
          >
            <Users size={15} /> Section Sync
          </button>
          <button
            onClick={() => setShowTour(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 border border-white/10 transition-all"
          >
            <HelpCircle size={15} /> Guide
          </button>
          <Link to="/today" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25">
            <Clock size={16} />
            Today's Log
          </Link>
        </div>
      </div>

      {/* Target & Overall Attendance Hero (Inspired by Reference Photo) */}
      <div className="glass-card rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 border border-white/10">
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%" data={[{ value: analytics?.overallPercentage || 0, fill: '#0047FF' }]} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" cornerRadius={8} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-base font-black">{(analytics?.overallPercentage || 0).toFixed(0)}%</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Target: {target}%</span>
            </div>
            <p className="text-xl sm:text-2xl font-black mt-0.5 text-white">
              Overall Attendance: {(analytics?.overallPercentage || 0).toFixed(1)}%
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                (analytics?.overallPercentage || 0) >= target
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
              }`}>
                {(analytics?.overallPercentage || 0) >= target ? '✓ On Track & Safe' : '⚠ Below Target'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 text-center self-stretch sm:self-auto justify-center">
          <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 min-w-[70px]">
            <p className="text-lg font-black text-emerald-400">{safe}</p>
            <p className="text-[11px] font-bold text-slate-400 uppercase">Safe</p>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 min-w-[70px]">
            <p className="text-lg font-black text-red-400">{danger}</p>
            <p className="text-[11px] font-bold text-slate-400 uppercase">At Risk</p>
          </div>
        </div>
      </div>

      {/* Row of 3 Stats: Bunked, Attended, Total (Directly from User Reference Photo) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-4 text-center border border-white/10">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bunked</p>
          <p className="text-2xl sm:text-3xl font-black text-blue-500 mt-1">{analytics?.totalBunked ?? 0}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center border border-white/10">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attended</p>
          <p className="text-2xl sm:text-3xl font-black text-blue-500 mt-1">{analytics?.totalAttended ?? 0}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center border border-white/10">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
          <p className="text-2xl sm:text-3xl font-black text-blue-500 mt-1">{analytics?.totalCompleted ?? 0}</p>
        </div>
      </div>

      {/* Quick Bunk Simulator */}
      {analytics?.subjects && analytics.subjects.length > 0 && (
        <QuickBunkSimulator subjects={analytics.subjects} target={target} />
      )}

      {/* Today's Schedule Preview */}
      {todaySchedule?.schedule && (
        <div className="glass-card rounded-3xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <CalendarDays size={18} className="text-blue-500" />
              Today's Schedule ({today})
            </h3>
            <Link to="/today" className="text-xs text-blue-500 hover:underline flex items-center gap-1 font-bold">
              Mark Attendance <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {todaySchedule.schedule.periods.map(p => (
              <div key={p.periodNumber} className="flex items-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center text-xs font-bold text-blue-400">
                  {p.periodNumber}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{p.subjectName || 'Class'}</p>
                  {p.startTime && <p className="text-[10px] text-slate-500">{p.startTime}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subjects Grid with 1-Tap Manual Buttons & Bunk History */}
      {analytics?.subjects && analytics.subjects.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base flex items-center gap-2">
              <Zap size={18} className="text-blue-500" />
              Subject Attendance & Manual Tick
            </h3>
            <Link to="/subjects" className="text-xs text-blue-500 hover:underline flex items-center gap-1 font-bold">
              Manage Subjects <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {analytics.subjects.map(s => (
              <SubjectCard key={s._id} subject={s} target={target} onUpdate={loadData} />
            ))}
          </div>
        </div>
      )}



      {/* Modals */}
      <OnboardingModal
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        onDemoLoaded={loadData}
      />
      <ShareTimetableModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onImportSuccess={loadData}
      />
    </div>
  );
}

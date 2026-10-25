import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  TrendingUp, TrendingDown, BookOpen, CalendarDays, Award,
  AlertTriangle, CheckCircle2, Clock, ChevronRight, Zap, Sparkles, HelpCircle, Users, Wallet
} from 'lucide-react';
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from 'recharts';
import OnboardingModal from '../components/OnboardingModal';
import QuickBunkSimulator from '../components/QuickBunkSimulator';
import ShareTimetableModal from '../components/ShareTimetableModal';

function StatCard({ label, value, sublabel, icon: Icon, color, trend }) {
  return (
    <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-slate-400 text-xs font-medium">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sublabel && <p className="text-xs text-slate-500 mt-0.5">{sublabel}</p>}
      </div>
      {trend !== undefined && (
        <div className={`ml-auto text-sm font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
        </div>
      )}
    </div>
  );
}

function SubjectCard({ subject, target }) {
  const pct = subject.percentage;
  const status = pct >= target ? 'safe' : pct >= target - 10 ? 'warning' : 'danger';
  const colors = { safe: '#10b981', warning: '#f59e0b', danger: '#ef4444' };
  const color = colors[status];

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: subject.color || '#6366f1' }} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{subject.name}</p>
            {subject.code && <p className="text-xs text-slate-500">{subject.code}</p>}
          </div>
        </div>
        <span className="text-lg font-bold ml-2 flex-shrink-0" style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-500">
        <span>{subject.attendedClasses}/{subject.eligibleClasses} classes</span>
        {subject.canBunk > 0 ? (
          <span className="text-emerald-400">✓ Can bunk {subject.canBunk}</span>
        ) : subject.needMore > 0 ? (
          <span className="text-red-400">Need {subject.needMore} more</span>
        ) : null}
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

    // Show onboarding tour automatically for new users
    if (!localStorage.getItem('bunkwell_tour_done')) {
      setShowTour(true);
    }
  }, []);

  const handleSeedDemo = async () => {
    try {
      setLoading(true);
      await api.post('/analytics/seed-demo');
      const [analyticsRes, todayRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/timetable/today'),
      ]);
      setAnalytics(analyticsRes.data);
      setTodaySchedule(todayRes.data);
      toast.success('Demo semester subjects, timetable & past attendance loaded! 🎉');
    } catch (err) {
      toast.error('Failed to load demo data: ' + (err.response?.data?.message || err.message));
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
      {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl shimmer" />)}
    </div>
  );

  const safe = analytics?.subjects?.filter(s => s.status === 'safe').length || 0;
  const danger = analytics?.subjects?.filter(s => s.status === 'danger').length || 0;
  const totalBunkPasses = analytics?.subjects?.reduce((acc, s) => acc + (s.canBunk || 0), 0) || 0;

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Greeting & Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
            {greeting}, <span className="bg-gradient-to-r from-amber-400 to-red-500 bg-clip-text text-transparent">{user?.name?.split(' ')[0]}</span> 👋
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">{today} • {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-xs font-semibold text-purple-300 border border-purple-500/30 transition-all shadow"
          >
            <Users size={15} /> Section Sync
          </button>
          <button
            onClick={() => setShowTour(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-amber-400 border border-amber-500/20 transition-all hover:border-amber-500/40"
          >
            <HelpCircle size={15} /> BunkClub Guide
          </button>
          <Link to="/today" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 text-white text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-orange-500/25">
            <Clock size={16} />
            Today's Log
          </Link>
        </div>
      </div>

      {/* Overall percentage hero */}
      <div className="glass-card rounded-2xl p-6 flex items-center gap-6">
        <div className="relative w-24 h-24 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%" data={[{ value: analytics?.overallPercentage || 0, fill: '#f59e0b' }]} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={8} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{(analytics?.overallPercentage || 0).toFixed(0)}%</span>
          </div>
        </div>
        <div>
          <p className="text-slate-400 text-sm">Overall Attendance</p>
          <p className="text-2xl font-bold text-white mt-1">{(analytics?.overallPercentage || 0).toFixed(1)}%</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              (analytics?.overallPercentage || 0) >= target
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {(analytics?.overallPercentage || 0) >= target ? '✓ Above target' : '⚠ Below target'}
            </span>
            <span className="text-xs text-slate-500">Target: {target}%</span>
          </div>
        </div>
        <div className="ml-auto hidden sm:grid grid-cols-2 gap-3 text-center">
          <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-lg font-bold text-emerald-400">{safe}</p>
            <p className="text-xs text-slate-500">Safe</p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-lg font-bold text-red-400">{danger}</p>
            <p className="text-xs text-slate-500">At Risk</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Subjects" value={analytics?.subjects?.length || 0} icon={BookOpen} color="#f59e0b" />
        <StatCard label="BunkBank Passes" value={`${totalBunkPasses} Safe`} sublabel="Available skips" icon={Wallet} color="#10b981" />
        <StatCard label="Today's Periods" value={todaySchedule?.schedule?.periods?.length || 0} sublabel={today} icon={CalendarDays} color="#8b5cf6" />
        <StatCard label="At Risk" value={danger} sublabel={danger > 0 ? 'Need recovery' : 'All safe'} icon={AlertTriangle} color="#ef4444" />
      </div>

      {/* Out-of-the-Box Innovation: Quick Bunk Simulator */}
      {analytics?.subjects && analytics.subjects.length > 0 && (
        <QuickBunkSimulator subjects={analytics.subjects} target={target} />
      )}

      {/* Today's schedule preview */}
      {todaySchedule?.schedule && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <CalendarDays size={18} className="text-[#6366f1]" />
              Today's Schedule
            </h3>
            <Link to="/today" className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
              Mark Attendance <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {todaySchedule.schedule.periods.map(p => (
              <div key={p.periodNumber} className="flex items-center gap-2 p-3 rounded-xl bg-white/5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400">
                  {p.periodNumber}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{p.subjectName || 'Subject'}</p>
                  {p.startTime && <p className="text-xs text-slate-500">{p.startTime}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subjects grid */}
      {analytics?.subjects && analytics.subjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Zap size={18} className="text-[#6366f1]" />
              Subject Overview
            </h3>
            <Link to="/analytics" className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
              Full Analytics <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {analytics.subjects.map(s => <SubjectCard key={s._id} subject={s} target={target} />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!analytics?.subjects || analytics.subjects.length === 0) && !loading && (
        <div className="glass-card rounded-2xl p-8 lg:p-12 text-center max-w-2xl mx-auto border border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
            <BookOpen size={32} />
          </div>
          <h3 className="text-white font-bold text-xl mb-2">Welcome to your Bunkwell Dashboard!</h3>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
            You don't have any subjects yet. You can add your own subjects & timetable, or load a realistic sample semester to test all features instantly.
          </p>
          <div className="flex flex-wrap gap-3 justify-center items-center">
            <button
              onClick={handleSeedDemo}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-orange-500/30 flex items-center gap-2"
            >
              <Sparkles size={17} /> Load Sample Semester (1-Click Demo)
            </button>
            <Link
              to="/subjects"
              className="px-5 py-3 rounded-xl border border-white/20 text-slate-300 text-sm font-medium hover:text-white hover:border-white/40 transition-colors"
            >
              Add Subjects Manually
            </Link>
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

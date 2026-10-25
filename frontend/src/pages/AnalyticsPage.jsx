import { useEffect, useState } from 'react';
import api from '../lib/api';
import { BarChart3, TrendingUp, Award, AlertTriangle, CheckCircle2, Zap, BookOpen } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = { safe: '#10b981', warning: '#3b82f6', danger: '#ef4444' };

function AttendancePieCard({ subject }) {
  const attended = subject.attendedClasses;
  const absent = subject.eligibleClasses - subject.attendedClasses;
  const bunked = Math.max(0, subject.totalClasses - subject.attendedClasses);
  const data = [
    { name: 'Attended', value: attended },
    { name: 'Bunked', value: bunked },
  ].filter(d => d.value > 0);
  const color = STATUS_COLORS[subject.status];

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: subject.color || '#0047FF' }} />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{subject.name}</p>
            <p className="text-xs text-slate-500 capitalize">{subject.type || 'theory'} · {attended}/{subject.totalClasses} classes</p>
          </div>
        </div>
        <span className="text-xl font-bold flex-shrink-0 ml-2" style={{ color }}>{subject.percentage.toFixed(1)}%</span>
      </div>

      {/* Bar */}
      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-3">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(subject.percentage, 100)}%`, background: color }} />
      </div>

      {/* Stats row: Bunked, Attended, Total */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-emerald-500/10 py-2">
          <p className="font-bold text-emerald-400">{subject.attendedClasses}</p>
          <p className="text-slate-500 text-[10px]">Attended</p>
        </div>
        <div className="rounded-lg bg-red-500/10 py-2">
          <p className="font-bold text-red-400">{bunked}</p>
          <p className="text-slate-500 text-[10px]">Bunked</p>
        </div>
        <div className="rounded-lg bg-white/5 py-2">
          <p className="font-bold text-slate-300">{subject.totalClasses}</p>
          <p className="text-slate-500 text-[10px]">Total</p>
        </div>
      </div>

      {/* Bunk advisory */}
      {subject.canBunk > 0 ? (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
          <Zap size={13} /> You can safely bunk <b>{subject.canBunk}</b> more class{subject.canBunk !== 1 ? 'es' : ''}
        </div>
      ) : subject.needMore > 0 ? (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertTriangle size={13} /> Attend <b>{subject.needMore}</b> more to reach target
        </div>
      ) : null}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl px-4 py-3 border border-[#2a2a4a]">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-white font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [bunkData, setBunkData] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [loading, setLoading] = useState(true);
  const target = user?.attendanceTarget || 80;

  useEffect(() => {
    Promise.all([
      api.get('/analytics/overview'),
      api.get('/analytics/bunk-suggestions'),
      api.get('/analytics/weekly'),
    ]).then(([a, b, w]) => {
      setAnalytics(a.data);
      setBunkData(b.data);
      setWeekly(w.data.weekly);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-6 space-y-4 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-40 rounded-2xl shimmer" />)}</div>
  );

  const subjectBarData = analytics?.subjects?.map(s => ({
    name: s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name,
    percentage: s.percentage,
    target,
    fill: STATUS_COLORS[s.status],
  })) || [];

  const radarData = analytics?.subjects?.map(s => ({
    subject: s.name.length > 10 ? s.name.slice(0, 10) + '…' : s.name,
    attendance: s.percentage,
  })) || [];

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
      <div>
        <h2 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 size={24} className="text-amber-500" /> Analytics
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">Detailed attendance insights & bunk suggestions</p>
      </div>

      {/* Bunk Suggestion Banner */}
      {bunkData?.canBunkSubjects?.length > 0 && (
        <div className="glass-card rounded-2xl p-5 border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Zap size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-emerald-400 font-semibold">Today's Bunk Suggestions 🎯</h3>
              <p className="text-slate-400 text-sm mt-1">
                You can safely skip today's class for: <span className="text-white font-medium">{bunkData.canBunkSubjects.map(s => s.name).join(', ')}</span> and still maintain {target}%+
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Must attend warning */}
      {bunkData?.mustAttendSubjects?.length > 0 && (
        <div className="glass-card rounded-2xl p-5 border border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-red-400 font-semibold">Must Attend ⚠️</h3>
              <p className="text-slate-400 text-sm mt-1">
                Do NOT bunk: <span className="text-white font-medium">{bunkData.mustAttendSubjects.map(s => s.name).join(', ')}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Subject bar chart */}
      {subjectBarData.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-amber-500" /> Attendance by Subject
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={subjectBarData} margin={{ top: 5, right: 5, bottom: 20, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="percentage" radius={[6, 6, 0, 0]} name="Attendance %">
                {subjectBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
              {/* Target line would need ReferenceLine - skip for cleanliness */}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weekly trend */}
      {weekly.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-amber-500" /> Weekly Trend
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weekly} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} name="Present" />
              <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2.5} dot={{ fill: '#ef4444', r: 4 }} name="Absent" />
              <Line type="monotone" dataKey="cancelled" stroke="#64748b" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Cancelled" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Radar chart */}
      {radarData.length >= 3 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Award size={18} className="text-amber-500" /> Subject Radar
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#2a2a4a" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Radar name="Attendance" dataKey="attendance" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Individual subject cards */}
      {analytics?.subjects && analytics.subjects.length > 0 && (
        <div>
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <BookOpen size={18} className="text-[#6366f1]" /> Per Subject Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {analytics.subjects.map(s => <AttendancePieCard key={s._id} subject={s} />)}
          </div>
        </div>
      )}

      {(!analytics?.subjects || analytics.subjects.length === 0) && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <BarChart3 size={48} className="text-[#6366f1] opacity-50 mx-auto mb-4" />
          <p className="text-slate-500">No data yet. Start marking attendance to see analytics.</p>
        </div>
      )}
    </div>
  );
}

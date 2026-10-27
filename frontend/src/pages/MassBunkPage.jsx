import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Flame, Plus, Users, Sparkles, Shield, AlertTriangle } from 'lucide-react';
import MassBunkCard from '../components/MassBunkCard';
import MassBunkModal from '../components/MassBunkModal';

export default function MassBunkPage() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [polls, setPolls] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadData = async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        api.get('/mass-bunk/active'),
        api.get('/subjects')
      ]);
      setPolls(pRes.data.polls || []);
      setSubjects(sRes.data.subjects || []);
    } catch (err) {
      console.warn('Failed to load mass bunk data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Hero Header */}
      <div className={`p-5 sm:p-6 rounded-3xl border shadow-xl relative overflow-hidden ${
        isDark
          ? 'bg-gradient-to-r from-red-950/40 via-[#101726] to-[#0d121c] border-red-500/40 text-white shadow-red-950/30'
          : 'bg-gradient-to-r from-red-50 via-white to-amber-50 border-red-200 text-slate-900 shadow-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30 flex-shrink-0 animate-bounce">
              <Flame size={26} className="fill-white text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  🚨 Mass Bunk Command Room
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 border border-red-500/30">
                  Class Democracy
                </span>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Coordinate mass bunks with your classmates. 60%+ agreement makes it official!
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white font-black text-xs shadow-lg shadow-red-600/40 transition-all self-start sm:self-auto"
          >
            <Flame size={16} className="fill-white" />
            <span>Initiate Mass Bunk</span>
          </button>
        </div>
      </div>

      {/* Active Polls List */}
      <div className="space-y-4">
        <h3 className="font-extrabold text-base flex items-center gap-2">
          <span>Active Class Polls & Consensus</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold">
            {polls.length}
          </span>
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading polls...</div>
        ) : polls.length === 0 ? (
          <div className={`p-8 text-center rounded-3xl border space-y-3 ${
            isDark ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
          }`}>
            <Flame size={40} className="mx-auto text-slate-500 opacity-60" />
            <p className="font-extrabold text-sm">No Active Mass Bunks Right Now</p>
            <p className="text-xs max-w-sm mx-auto">
              Got tired after lab, or heavy rain outside? Initiate a mass bunk to get everyone to vote!
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs shadow-md"
            >
              Start First Poll
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {polls.map(p => (
              <MassBunkCard
                key={p._id}
                poll={p}
                currentUserId={user?._id}
                onVoted={loadData}
              />
            ))}
          </div>
        )}
      </div>

      <MassBunkModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        subjects={subjects}
        onCreated={loadData}
      />
    </div>
  );
}

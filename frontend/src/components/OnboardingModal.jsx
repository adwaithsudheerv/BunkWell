import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  Sparkles,
  CalendarDays,
  Clock,
  Calculator,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  BookOpen,
  UserCheck,
  AlertCircle
} from 'lucide-react';

export default function OnboardingModal({ isOpen, onClose, onDemoLoaded }) {
  const [step, setStep] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const slides = [
    {
      title: "Welcome to BunkClub",
      subtitle: "Smart Attendance & Safe Bunk Intelligence",
      badge: "Step 1 of 4",
      icon: Sparkles,
      color: "#0047FF",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">
            BunkClub eliminates the fear of low attendance, exam detention, and confusing college calculations.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-blue-400 font-bold text-sm block mb-1">🎯 Target Goal</span>
              <p className="text-xs text-slate-400">Set your minimum required attendance (e.g. 75% or 80%) to stay exam-eligible.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-emerald-400 font-bold text-sm block mb-1">🛡️ Safe Bunks</span>
              <p className="text-xs text-slate-400">Know the exact number of classes you can skip without dipping below target.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Set Up Your Weekly Timetable",
      subtitle: "Monday through Saturday Periods (8 AM - 6 PM)",
      badge: "Step 2 of 4",
      icon: CalendarDays,
      color: "#0047FF",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">
            Add your subjects and weekly class periods. BunkClub automatically generates your daily attendance board.
          </p>
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-2 text-blue-400 font-semibold">
              <BookOpen size={16} /> What you can configure:
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>8:00 AM – 6:00 PM standard hourly class blocks</li>
              <li>Subject Name, Color Tag & Type (Theory / Lab)</li>
              <li>Attendance calibration: Attended, Completed, and Leftover classes</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Daily Routine & Substitute Tracking",
      subtitle: "Morning 7 AM Check & Period Marking",
      badge: "Step 3 of 4",
      icon: Clock,
      color: "#ec4899",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">
            Every day, track your attendance period-by-period with realistic college situations:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-emerald-400 font-bold block mb-1">✓ Present</span>
              <span className="text-slate-400">Attended the class normally.</span>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <span className="text-red-400 font-bold block mb-1">✗ Absent (Bunk)</span>
              <span className="text-slate-400">Skipped or missed the lecture.</span>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <span className="text-blue-400 font-bold block mb-1">🔄 Replaced</span>
              <span className="text-slate-400">Class or teacher substituted.</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-500/10 border border-slate-500/20">
              <span className="text-slate-300 font-bold block mb-1">⚪ Cancelled</span>
              <span className="text-slate-400">Class cancelled (doesn't hurt %!).</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Smart Bunk Calculator",
      subtitle: "Instant Math So You Never Guess",
      badge: "Step 4 of 4",
      icon: Calculator,
      color: "#10b981",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">
            The heart of BunkClub is mathematical clarity. For every subject, you immediately see:
          </p>
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
            <div>
              <p className="text-white font-semibold">"You can bunk 2 classes"</p>
              <p className="text-slate-400 mt-0.5">Your percentage stays safely above your 80% target.</p>
            </div>
            <span className="text-emerald-400 font-bold text-sm bg-emerald-500/20 px-2.5 py-1 rounded-lg">SAFE</span>
          </div>
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between text-xs">
            <div>
              <p className="text-white font-semibold">"Need 3 consecutive classes"</p>
              <p className="text-slate-400 mt-0.5">Attendance is below target; recovery plan calculated.</p>
            </div>
            <span className="text-red-400 font-bold text-sm bg-red-500/20 px-2.5 py-1 rounded-lg">AT RISK</span>
          </div>
        </div>
      )
    }
  ];

  const currentSlide = slides[step];
  const Icon = currentSlide.icon;

  const handleFinish = () => {
    localStorage.setItem('bunkwell_tour_done', 'true');
    onClose();
  };

  const handleLoadDemo = async () => {
    try {
      setSeeding(true);
      await api.post('/analytics/seed-demo');
      localStorage.setItem('bunkwell_tour_done', 'true');
      toast.success('Sample semester subjects & timetable loaded! 🎉');
      if (onDemoLoaded) onDemoLoaded();
      onClose();
    } catch (err) {
      toast.error('Failed to load demo data: ' + (err.response?.data?.message || err.message));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full max-w-lg rounded-3xl modal-surface shadow-2xl p-6 sm:p-8 relative overflow-hidden flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-slate-300">
              {currentSlide.badge}
            </span>
          </div>
          <button
            onClick={handleFinish}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Slide Header */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${currentSlide.color}20`, border: `1px solid ${currentSlide.color}40` }}
          >
            <Icon size={24} style={{ color: currentSlide.color }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{currentSlide.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{currentSlide.subtitle}</p>
          </div>
        </div>

        {/* Slide Content */}
        <div className="my-2 min-h-[170px]">
          {currentSlide.content}
        </div>

        {/* Action button on last slide */}
        {step === slides.length - 1 && (
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
            <button
              onClick={handleLoadDemo}
              disabled={seeding}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm active:scale-95 transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              <Sparkles size={16} />
              {seeding ? 'Loading Demo Semester…' : 'Load 1-Click Demo Semester (Instant Data)'}
            </button>
          </div>
        )}

        {/* Navigation footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#262626]">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all ${
                  step === i ? 'w-6 bg-blue-500' : 'w-2 bg-white/20'
                }`}
              />
            ))}
          </div>

          {/* Prev / Next buttons */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-3 py-2 rounded-xl border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1"
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}

            {step < slides.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-slate-200 transition-all flex items-center gap-1"
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-all flex items-center gap-1"
              >
                Got It! Start Exploring <CheckCircle2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
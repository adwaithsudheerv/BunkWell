import { useState, useEffect } from 'react';
import { Download, ShieldCheck, Zap, VolumeX, Sparkles, CheckCircle2, ArrowRight, Smartphone, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PublicDownloadPage() {
  const [downloadCount, setDownloadCount] = useState(482);

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col items-center justify-between p-4 sm:p-8 selection:bg-blue-600 selection:text-white">
      {/* Top Ambient Light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-blue-600/20 via-indigo-600/10 to-transparent blur-3xl pointer-events-none rounded-full" />

      {/* Navigation Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-4 border-b border-white/10 relative z-10">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-blue-500/30">
            B
          </div>
          <div>
            <span className="font-black text-lg tracking-tight">Bunk<span className="text-blue-500">Club</span></span>
            <span className="text-[10px] ml-1.5 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Official
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-colors"
          >
            Web App Sign In
          </Link>
          <a
            href="/BunkClub.apk"
            download="BunkClub.apk"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-md shadow-blue-600/30 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Download size={14} />
            <span>Get APK</span>
          </a>
        </div>
      </header>

      {/* Main Download Hero */}
      <main className="w-full max-w-2xl py-12 flex flex-col items-center text-center relative z-10 space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold">
          <Sparkles size={14} />
          <span>Latest Release v1.5.3 • Android 8.0+ Supported</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
          The Smartest Attendance & <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            Auto-Silent App for College
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-400 max-w-lg leading-relaxed">
          BunkClub automatically puts your phone on silent during lectures, un-mutes when you bunk, counts extra class attendance, and predicts your safe bunk credits.
        </p>

        {/* Primary Download Button */}
        <div className="pt-2 flex flex-col items-center gap-3 w-full max-w-sm">
          <a
            href="/BunkClub.apk"
            download="BunkClub.apk"
            onClick={() => setDownloadCount(c => c + 1)}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-base shadow-xl shadow-blue-600/40 active:scale-95 transition-all flex items-center justify-center gap-3 border border-blue-400/30"
          >
            <Download size={22} className="animate-bounce" />
            <span>Download BunkClub APK</span>
          </a>
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Verified Clean • Direct Download (5.9 MB) • {downloadCount} Downloads</span>
          </span>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-8 text-left">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <VolumeX size={18} />
            </div>
            <h4 className="font-black text-sm">24/7 Auto-Silent</h4>
            <p className="text-xs text-slate-400">
              Phone mutes automatically when your class begins, and instantly un-mutes when you bunk or class ends.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <Zap size={18} />
            </div>
            <h4 className="font-black text-sm">Lightning Reconciler</h4>
            <p className="text-xs text-slate-400">
              One-tap attendance marking for timetable periods, lab sessions, and dynamic faculty extra hours.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              <Sparkles size={18} />
            </div>
            <h4 className="font-black text-sm">Ghost Bunk Predictor</h4>
            <p className="text-xs text-slate-400">
              AI what-if simulator that tells you the best day to bunk with zero risk to your 75% target threshold.
            </p>
          </div>
        </div>

        {/* Install Guide Card */}
        <div className="w-full p-5 rounded-3xl bg-black/40 border border-white/10 text-left space-y-3">
          <h4 className="font-black text-sm flex items-center gap-2">
            <Smartphone size={16} className="text-blue-400" />
            <span>How to Install on Android:</span>
          </h4>
          <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside font-medium leading-relaxed">
            <li>Tap the <strong>Download BunkClub APK</strong> button above in Chrome or Brave.</li>
            <li>When Chrome or Brave displays <em>"File might be harmful"</em>, tap <strong>Download anyway</strong> (standard Android notice for direct APK downloads).</li>
            <li>Tap the downloaded file in your browser notifications and tap <strong>Install</strong>.</li>
            <li>Open BunkClub, log in with your college account, and enjoy automated attendance & auto-silent ringer!</li>
          </ol>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl py-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 relative z-10">
        <p>© 2026 BunkClub • Built for MCA & Engineering Students</p>
        <div className="flex items-center gap-4">
          <Link to="/login" className="hover:text-slate-300 transition-colors">Sign In</Link>
          <Link to="/register" className="hover:text-slate-300 transition-colors">Register</Link>
          <a href="/BunkClub.apk" download className="text-blue-400 font-bold hover:underline">Download APK</a>
        </div>
      </footer>
    </div>
  );
}

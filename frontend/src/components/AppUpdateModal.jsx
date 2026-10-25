import { useState, useEffect } from 'react';
import { Download, Sparkles, X, ShieldCheck } from 'lucide-react';
import api from '../lib/api';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Current installed package version in build
export const CURRENT_APP_VERSION = '1.0.0';

export default function AppUpdateModal() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [visible, setVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    checkUpdate();
  }, []);

  const checkUpdate = async () => {
    try {
      const res = await api.get('/notifications/version');
      const data = res.data;
      if (data && data.latestVersion) {
        // Compare versions or check if latest is newer
        const isNewer = data.latestVersion !== CURRENT_APP_VERSION;
        const dismissed = localStorage.getItem('bunkclub_dismissed_update') === data.latestVersion;

        if (isNewer) {
          setUpdateInfo(data);
          if (!dismissed) {
            setVisible(true);

            // Also trigger native / in-app notification
            triggerUpdateNotification(data);
          }
        }
      }
    } catch (err) {
      console.warn('App update check skipped:', err.message);
    }
  };

  const triggerUpdateNotification = async (data) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 8888,
              title: data.title || '🚀 BunkClub Update Available!',
              body: data.message || 'A new update is available. Tap here to download and update your application!',
              channelId: 'bunkclub_alerts',
              schedule: { at: new Date(Date.now() + 1200) },
              smallIcon: 'ic_launcher_round'
            }
          ]
        });
      } catch (e) {
        console.warn('Could not schedule native update notification:', e);
      }
    } else if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(data.title || '🚀 BunkClub Update Available!', {
          body: data.message || 'A new update is ready. Tap to download and install!',
          icon: '/icon-192.png'
        });
      } catch (e) {}
    }
  };

  const handleUpdate = () => {
    setDownloading(true);
    const downloadUrl = updateInfo?.downloadUrl || 'https://bunkwell.onrender.com/BunkClub.apk';
    window.location.href = downloadUrl;
    setTimeout(() => {
      setDownloading(false);
      setVisible(false);
    }, 2500);
  };

  const handleDismiss = () => {
    if (updateInfo?.latestVersion) {
      localStorage.setItem('bunkclub_dismissed_update', updateInfo.latestVersion);
    }
    setVisible(false);
  };

  if (!visible || !updateInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full max-w-md bg-[#0d1017] border border-blue-500/30 rounded-3xl p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={handleDismiss}
          className="absolute top-5 right-5 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
        >
          <X size={17} />
        </button>

        {/* Header Icon */}
        <div className="w-13 h-13 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center mb-4 text-blue-400 shadow-lg shadow-blue-500/25">
          <Sparkles size={26} />
        </div>

        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-blue-500/20 border border-blue-500/30 text-blue-400">
            Update v{updateInfo.latestVersion}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
            <ShieldCheck size={13} /> Play Protect Certified
          </span>
        </div>

        <h3 className="text-xl font-extrabold text-white tracking-tight">
          New Version Available!
        </h3>

        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          {updateInfo.message}
        </p>

        {/* Changelog */}
        {updateInfo.changelog && (
          <div className="my-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">What's New:</p>
            {updateInfo.changelog.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-blue-400 font-bold">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleUpdate}
            disabled={downloading}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download size={15} />
            {downloading ? 'Downloading APK...' : 'Update Application Now'}
          </button>
          <button
            onClick={handleDismiss}
            className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold transition-all border border-white/10"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

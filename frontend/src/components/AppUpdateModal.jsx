import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Sparkles, RefreshCw, Download, X, ChevronRight, CheckCircle2, Zap } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// Current installed package version in build
export const CURRENT_APP_VERSION = '1.3.3';
export const CURRENT_VERSION_CODE = 16;

// Compares semantic versions (e.g., '1.0.0' vs '1.3.2')
export function isVersionOutdated(currentVer, latestVer, currentCode = CURRENT_VERSION_CODE, latestCode = 15) {
  if (latestCode && currentCode && latestCode > currentCode) return true;
  if (!latestVer || !currentVer) return false;

  const currentParts = currentVer.split('.').map(n => parseInt(n, 10) || 0);
  const latestParts = latestVer.split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const c = currentParts[i] || 0;
    const l = latestParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

export default function AppUpdateNotifier() {
  const { isDark } = useTheme();
  const [updateInfo, setUpdateInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [swUpdateReady, setSwUpdateReady] = useState(false);

  const checkAndNotifyUpdate = async () => {
    try {
      const res = await api.get('/notifications/version?t=' + Date.now());
      const data = res.data;
      if (!data || !data.latestVersion) return;

      const needsUpdate = isVersionOutdated(
        CURRENT_APP_VERSION,
        data.latestVersion,
        CURRENT_VERSION_CODE,
        data.versionCode
      );

      if (needsUpdate) {
        setUpdateInfo(data);
        // Send native push notification if in background/Android
        sendNativeNotification(data);
      }
    } catch (err) {
      console.warn('Update check skipped:', err.message);
    }
  };

  const sendNativeNotification = async (data) => {
    const downloadUrl = data.downloadUrl || 'https://bunkwell.onrender.com/BunkClub.apk';
    const title = data.title || '🚀 BunkClub Update Available';
    const body = `Version ${data.latestVersion} is live! Tap to download the update.`;

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 8888,
              title,
              body,
              channelId: 'bunkclub_alerts',
              schedule: { at: new Date(Date.now() + 1000) },
              smallIcon: 'ic_launcher_round',
              extra: { url: downloadUrl }
            }
          ]
        });
      } catch (e) {
        console.warn('Native notification error:', e);
      }
    } else if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon: '/icon-192.png',
          data: { url: downloadUrl }
        });
        notif.onclick = () => {
          window.focus();
          window.dispatchEvent(new CustomEvent('open-daily-wrapup'));
        };
      } catch (e) {}
    }
  };

  useEffect(() => {
    // 1. Initial check
    checkAndNotifyUpdate();

    // 2. Poll every 3 minutes for new updates
    const pollInterval = setInterval(checkAndNotifyUpdate, 3 * 60 * 1000);

    // 3. Re-check whenever user switches back to the tab/app
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAndNotifyUpdate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 4. Service Worker update detection for web app
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setSwUpdateReady(true);
              }
            });
          }
        });
      });
    }

    // 5. Native notification click listener
    let listenerHandle;
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        if (action.notification.extra?.action === 'wrapup' || action.notification.id === 7777) {
          window.dispatchEvent(new CustomEvent('open-daily-wrapup'));
        } else if (action.notification.id === 8888 || action.notification.extra?.url) {
          const downloadUrl = action.notification.extra?.url || 'https://bunkwell.onrender.com/BunkClub.apk';
          window.open(downloadUrl, '_system');
        } else {
          window.dispatchEvent(new CustomEvent('open-daily-wrapup'));
        }
      }).then(handle => {
        listenerHandle = handle;
      });
    }

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (listenerHandle?.remove) listenerHandle.remove();
    };
  }, []);

  const handleApplyUpdate = () => {
    if (Capacitor.isNativePlatform()) {
      const downloadUrl = updateInfo?.downloadUrl || 'https://bunkwell.onrender.com/BunkClub.apk';
      window.open(downloadUrl, '_system');
    } else {
      // Reload web app and bypass cache
      if ('caches' in window) {
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
      }
      window.location.reload(true);
    }
  };

  // If dismissed or no update, render nothing
  if (dismissed || (!updateInfo && !swUpdateReady)) return null;

  const isNative = Capacitor.isNativePlatform();
  const versionLabel = updateInfo?.latestVersion || 'New';

  return (
    <div className="fixed top-3 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-[9999] animate-[slideDown_0.3s_ease-out]">
      <div className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all ${
        isDark
          ? 'bg-[#0f141f]/95 border-blue-500/40 text-white shadow-blue-950/50'
          : 'bg-white/95 border-blue-300 text-slate-900 shadow-slate-300/80'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/30">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm tracking-tight">
                  Update Ready (v{versionLabel})
                </h4>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-500 dark:text-blue-300 border border-blue-500/30">
                  New
                </span>
              </div>
              <p className={`text-xs mt-0.5 leading-snug ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {updateInfo?.message || 'New features, improvements, and fixes are available.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setDismissed(true)}
            className={`p-1 rounded-lg transition-colors ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>

        {/* Changelog preview */}
        {updateInfo?.changelog?.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-blue-500/20">
            <button
              onClick={() => setShowChangelog(prev => !prev)}
              className="text-[11px] font-bold text-blue-500 dark:text-blue-400 flex items-center gap-1 hover:underline"
            >
              <span>{showChangelog ? 'Hide changes' : "See what's new"}</span>
              <ChevronRight size={12} className={`transition-transform ${showChangelog ? 'rotate-90' : ''}`} />
            </button>

            {showChangelog && (
              <ul className="mt-2 space-y-1 text-[11px] max-h-32 overflow-y-auto pr-1">
                {updateInfo.changelog.map((c, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{c}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Quick Link to Lightning Point Reconciliation */}
        <div className="mt-2.5 pt-2.5 border-t border-blue-500/20">
          <button
            onClick={() => {
              setDismissed(true);
              window.dispatchEvent(new CustomEvent('open-daily-wrapup'));
            }}
            type="button"
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-extrabold text-[11px] shadow-sm shadow-blue-500/25 transition-all border border-blue-400/30"
            title="Open Daily Attendance Reconciliation to apply classes attended"
          >
            <Zap size={13} className="fill-white text-amber-300" />
            <span>⚡ Open Lightning Point (Apply Attended Classes)</span>
          </button>
        </div>

        {/* Action Button */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleApplyUpdate}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all"
          >
            {isNative ? (
              <>
                <Download size={14} />
                <span>Download & Install APK</span>
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                <span>Update Now (Refresh)</span>
              </>
            )}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors ${
              isDark ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

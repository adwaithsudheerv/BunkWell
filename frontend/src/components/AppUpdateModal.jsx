import { useEffect } from 'react';
import api from '../lib/api';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Current installed package version in build
export const CURRENT_APP_VERSION = '1.2.8';
export const CURRENT_VERSION_CODE = 11;

// Compares semantic versions (e.g., '1.0.0' vs '1.2.8')
export function isVersionOutdated(currentVer, latestVer, currentCode = CURRENT_VERSION_CODE, latestCode = 11) {
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
  useEffect(() => {
    checkAndNotifyUpdate();

    // Listen for notification clicks to download the update
    let listenerHandle;
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        if (action.notification.id === 8888 || action.notification.extra?.url) {
          const downloadUrl = action.notification.extra?.url || 'https://bunkwell.onrender.com/BunkClub.apk';
          window.open(downloadUrl, '_system');
        }
      }).then(handle => {
        listenerHandle = handle;
      });
    }

    return () => {
      if (listenerHandle?.remove) {
        listenerHandle.remove();
      }
    };
  }, []);

  const checkAndNotifyUpdate = async () => {
    try {
      const res = await api.get('/notifications/version');
      const data = res.data;
      if (!data || !data.latestVersion) return;

      // Only proceed if the current application is actually an older version
      const needsUpdate = isVersionOutdated(
        CURRENT_APP_VERSION,
        data.latestVersion,
        CURRENT_VERSION_CODE,
        data.versionCode
      );

      if (!needsUpdate) {
        // App is up-to-date; do nothing!
        return;
      }

      // Throttle notification: do not spam the user on every app launch
      const notifKey = `bunkclub_notif_sent_${data.latestVersion}`;
      const lastSent = localStorage.getItem(notifKey);
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

      if (lastSent && now - Number(lastSent) < TWENTY_FOUR_HOURS) {
        // Already notified within the last 24 hours
        return;
      }

      // Mark as notified
      localStorage.setItem(notifKey, now.toString());

      // Send update notification to the notification shade (no blocking popup)
      await sendUpdateNotification(data);
    } catch (err) {
      console.warn('Update check skipped:', err.message);
    }
  };

  const sendUpdateNotification = async (data) => {
    const downloadUrl = data.downloadUrl || 'https://bunkwell.onrender.com/BunkClub.apk';
    const title = data.title || '🚀 BunkClub Update Available';
    const body = `Version ${data.latestVersion} is available to download. Tap to install the latest update!`;

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 8888,
              title,
              body,
              channelId: 'bunkclub_alerts',
              schedule: { at: new Date(Date.now() + 1500) },
              smallIcon: 'ic_launcher_round',
              extra: {
                url: downloadUrl
              }
            }
          ]
        });
      } catch (e) {
        console.warn('Could not schedule native update notification:', e);
      }
    } else if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon: '/icon-192.png',
          data: { url: downloadUrl }
        });
        notif.onclick = () => {
          window.open(downloadUrl, '_blank');
        };
      } catch (e) {}
    }
  };

  // Renders no intrusive full-screen blocking popup
  return null;
}

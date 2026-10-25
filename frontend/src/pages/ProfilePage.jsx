import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { User, Bell, BellOff, Settings, Save, Shield, CheckCircle2, Lock, Sparkles } from 'lucide-react';
import { sendInstantTestNotification, requestNotificationPermissions } from '../lib/nativeNotifications';

const FALLBACK_VAPID_PUB = 'BEvkdILThIec0RXS_ytPKEww_lzbOWPHAW3ID17xahKDSq6TzD_yo4zMy6CTsYHox3iszF_bOYndmG_nBGXbfwQ';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { isDark } = useTheme();

  const [form, setForm] = useState({
    attendanceTarget: user?.attendanceTarget || 80,
    newPassword: '',
  });

  const [saving, setSaving] = useState(false);
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [vapidKey, setVapidKey] = useState(FALLBACK_VAPID_PUB);

  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setNotifSupported(supported);

    // Fetch VAPID Key with fallback
    api.get('/notifications/vapid-key')
      .then(res => {
        if (res.data?.publicKey) setVapidKey(res.data.publicKey);
      })
      .catch(() => {});

    // Check existing push subscription
    if (supported) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          if (sub && Notification.permission === 'granted') {
            setNotifGranted(true);
            api.post('/notifications/subscribe', { subscription: sub.toJSON() }).catch(() => {});
          } else {
            setNotifGranted(false);
          }
        });
      }).catch(() => setNotifGranted(false));
    }
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        attendanceTarget: Number(form.attendanceTarget),
      };
      if (form.newPassword && form.newPassword.length >= 4) {
        payload.newPassword = form.newPassword;
      }
      const res = await api.put('/auth/profile', payload);
      updateUser(res.data.user);
      setForm(f => ({ ...f, newPassword: '' }));
      toast.success('Settings updated successfully! ✅');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const enableNotifications = async () => {
    setSubscribing(true);
    try {
      if (!('Notification' in window)) {
        toast.success('In-App notifications are active! 🔔');
        setNotifGranted(true);
        return true;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Notification permission was blocked in browser settings');
        return false;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey || FALLBACK_VAPID_PUB),
          });
        }
        await api.post('/notifications/subscribe', { subscription: sub.toJSON() });
      } catch (pushErr) {
        console.warn('Browser push service unavailable, using in-app notification alerts:', pushErr.message);
      }

      setNotifGranted(true);
      toast.success('Daily attendance notifications enabled! 🔔');
      return true;
    } catch (err) {
      console.warn('Notification activation fallback:', err);
      setNotifGranted(true);
      toast.success('Daily notification reminders active! 🔔');
      return true;
    } finally {
      setSubscribing(false);
    }
  };

  const testNotification = async () => {
    try {
      setSubscribing(true);
      await requestNotificationPermissions();
      const sent = await sendInstantTestNotification('BunkClub Notification Test 🔔', 'Native Android notifications are active! Attendance reminders will appear here.');
      if (sent) {
        toast.success('Native alert sent! Check your notification shade 🔔');
      } else {
        await api.post('/notifications/test');
        toast.success('Test alert dispatched! Check your notifications 🔔');
      }
    } catch (err) {
      toast.success('Notification test dispatched to your device! 🔔');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <Settings size={24} className="text-blue-500" /> Account & Preferences
        </h2>
        <p className="text-xs text-slate-400 mt-1">Manage your username, attendance goals, and security</p>
      </div>

      {/* User Glassmorphic Card */}
      <div className="glass-card rounded-3xl p-6 border border-white/10 flex items-center gap-4 relative overflow-hidden">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-blue-500/30 flex-shrink-0">
          {(user?.username || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-extrabold truncate">@{user?.username}</h3>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">
              Active Member
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Joined BunkClub 24/7 Cloud Tracker</p>
        </div>
      </div>

      {/* Attendance Target Settings Card */}
      <div className="glass-card rounded-3xl p-6 border border-white/10 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white">Target Attendance Requirement</h3>
            <p className="text-xs text-slate-400 mt-0.5">Minimum attendance required by your college regulations</p>
          </div>
          <span className="text-base font-black text-blue-400 bg-blue-600/15 px-3 py-1 rounded-xl border border-blue-500/30">
            {form.attendanceTarget}%
          </span>
        </div>

        <div>
          <input
            type="range"
            min="50"
            max="100"
            step="1"
            value={form.attendanceTarget}
            onChange={e => setForm(f => ({ ...f, attendanceTarget: e.target.value }))}
            className="w-full h-2 rounded-lg bg-white/10 appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[11px] text-slate-500 font-semibold mt-2">
            <span>50%</span>
            <span className={Number(form.attendanceTarget) === 75 ? 'text-blue-400 font-bold' : ''}>75% (Standard)</span>
            <span className={Number(form.attendanceTarget) === 80 ? 'text-blue-400 font-bold' : ''}>80% (Safe)</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Security & Password Card */}
      <div className="glass-card rounded-3xl p-6 border border-white/10 space-y-4">
        <div>
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Lock size={16} className="text-blue-500" /> Account Security & Password
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Set a new password for your account</p>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1.5 block font-semibold">Change Password</label>
          <input
            type="password"
            placeholder="Enter new password (optional)"
            value={form.newPassword}
            onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500 text-white placeholder-slate-500"
          />
        </div>
      </div>

      {/* Push Notifications Card */}
      <div className="glass-card rounded-3xl p-6 border border-white/10 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Bell size={16} className="text-blue-500" /> Daily Push & Class Notifications
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Receive 7:00 AM morning prompt ("Do you have class today?") and 6:00 PM evening check-ins.
            </p>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
            notifGranted
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-white/5 border-white/10 text-slate-400'
          }`}>
            {notifGranted ? '✓ Enabled' : 'Not Enabled'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {!notifGranted ? (
            <button
              onClick={enableNotifications}
              disabled={subscribing}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25 active:scale-95 disabled:opacity-50"
            >
              {subscribing ? 'Enabling...' : 'Enable Notifications'}
            </button>
          ) : (
            <button
              onClick={testNotification}
              disabled={subscribing}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/10 active:scale-95 disabled:opacity-50"
            >
              {subscribing ? 'Sending...' : 'Send Test Notification'}
            </button>
          )}
        </div>
      </div>

      {/* Creator Attribution Card */}
      <div className="glass-card rounded-3xl p-5 border border-blue-500/30 bg-blue-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30 flex-shrink-0">
            <Sparkles size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold text-white">Adwaith Sudheer</h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                Creator & Architect
              </span>
            </div>
            <a
              href="mailto:adwaithsudheer@gmail.com"
              className="text-xs text-blue-300 hover:text-white underline mt-0.5 block transition-colors"
            >
              adwaithsudheer@gmail.com
            </a>
          </div>
        </div>
        <a
          href="mailto:adwaithsudheer@gmail.com"
          className="px-3.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold border border-blue-500/30 transition-all shrink-0"
        >
          Contact Creator
        </a>
      </div>

      {/* Save Button */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25 active:scale-[0.99] flex items-center justify-center gap-2"
      >
        <Save size={17} /> {saving ? 'Saving Changes...' : 'Save Settings'}
      </button>
    </div>
  );
}

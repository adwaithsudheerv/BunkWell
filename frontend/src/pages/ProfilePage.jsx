import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { User, Bell, BellOff, Settings, IdCard, Building, BookOpen, Save, Shield, CheckCircle2 } from 'lucide-react';

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
    name: user?.name || '',
    college: user?.college || '',
    department: user?.department || '',
    semester: user?.semester || 1,
    year: user?.year || 1,
    attendanceTarget: user?.attendanceTarget || 80,
  });

  const [saving, setSaving] = useState(false);
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [vapidKey, setVapidKey] = useState('');

  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setNotifSupported(supported);

    // Fetch VAPID Key
    api.get('/notifications/vapid-key')
      .then(res => setVapidKey(res.data.publicKey))
      .catch(() => {});

    // Check if device is already subscribed
    if (supported) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          if (sub && Notification.permission === 'granted') {
            setNotifGranted(true);
            // Ensure backend has it saved
            api.post('/notifications/subscribe', { subscription: sub.toJSON() }).catch(() => {});
          } else {
            setNotifGranted(false);
          }
        });
      }).catch(() => setNotifGranted(false));
    }
  }, []);

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', form);
      updateUser(res.data.user);
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const enableNotifications = async () => {
    let key = vapidKey;
    if (!key) {
      try {
        const res = await api.get('/notifications/vapid-key');
        key = res.data.publicKey;
        setVapidKey(key);
      } catch (e) {
        toast.error('Push notifications not configured on server');
        return false;
      }
    }

    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Notification permission was not granted in browser settings');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
      }

      await api.post('/notifications/subscribe', { subscription: sub.toJSON() });
      setNotifGranted(true);
      toast.success('Push notifications active on this device! 🔔');
      return true;
    } catch (err) {
      console.error(err);
      toast.error('Failed to enable notifications: ' + err.message);
      return false;
    } finally {
      setSubscribing(false);
    }
  };

  const testNotification = async () => {
    try {
      setSubscribing(true);
      // Auto-subscribe if not active yet
      if (!notifGranted) {
        const success = await enableNotifications();
        if (!success) return;
      }

      await api.post('/notifications/test');
      toast.success('Test notification sent! Check your notification tray 🔔');
    } catch (err) {
      // If server reports no push subscriptions, re-subscribe device then retry
      if (err.response?.data?.message?.includes('No push subscriptions')) {
        const subscribed = await enableNotifications();
        if (subscribed) {
          try {
            await api.post('/notifications/test');
            toast.success('Test notification sent! 🔔');
            return;
          } catch (e) {}
        }
      }
      toast.error(err.response?.data?.message || 'Failed to send notification');
    } finally {
      setSubscribing(false);
    }
  };

  const cardBg = isDark
    ? 'bg-[#101319] border-white/10 text-white'
    : 'bg-white border-slate-200 text-slate-900 shadow-sm';

  const inputBg = isDark
    ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500 focus:border-blue-500'
    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:bg-white';

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-[fadeIn_0.2s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Profile & Settings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage your attendance targets and preferences</p>
        </div>
      </div>

      {/* User Card */}
      <div className={`rounded-2xl p-6 border flex items-center gap-5 ${cardBg}`}>
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-xl font-bold text-white shadow-md shadow-blue-500/25 flex-shrink-0">
          {user?.name?.charAt(0)?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold truncate leading-tight">{user?.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">@{user?.username} • ID: {user?.studentId}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-xs font-semibold border border-blue-500/20">
              {user?.college || 'College not set'}
            </span>
            {user?.department && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                {user.department}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Personal Info Form */}
      <div className={`rounded-2xl p-6 border space-y-5 ${cardBg}`}>
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Settings size={16} className="text-blue-500" /> Academic Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-semibold">Full Legal Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${inputBg}`}
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-semibold">College / University</label>
            <input
              type="text"
              value={form.college}
              onChange={e => update('college', e.target.value)}
              placeholder="e.g. Amrita Vishwa Vidyapeetham"
              className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${inputBg}`}
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-semibold">Department / Course</label>
            <input
              type="text"
              value={form.department}
              onChange={e => update('department', e.target.value)}
              placeholder="e.g. MCA, CSE"
              className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${inputBg}`}
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-semibold">Current Semester</label>
            <select
              value={form.semester}
              onChange={e => update('semester', Number(e.target.value))}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all cursor-pointer ${
                isDark ? 'bg-[#141720] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Attendance Target */}
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400">Attendance Target</label>
            <span className="text-sm font-bold text-blue-500 bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/20">
              {form.attendanceTarget}%
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={form.attendanceTarget}
            onChange={e => update('attendanceTarget', Number(e.target.value))}
            className="w-full accent-blue-600 h-2 bg-slate-700/30 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>50%</span>
            <span>75% (Standard)</span>
            <span>80% (Safe)</span>
            <span>100%</span>
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
        >
          <Save size={15} />
          {saving ? 'Saving Changes…' : 'Save Changes'}
        </button>
      </div>

      {/* Push Notifications Section */}
      <div className={`rounded-2xl p-6 border space-y-4 ${cardBg}`}>
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Bell size={16} className="text-blue-500" /> Push Notifications
        </h3>

        {!notifSupported ? (
          <p className="text-slate-500 text-xs">Push notifications are not supported in this browser.</p>
        ) : (
          <div className="space-y-4">
            <div className={`flex items-center justify-between p-4 rounded-xl border ${
              notifGranted ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-500/20 bg-slate-500/5'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  notifGranted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
                }`}>
                  {notifGranted ? <CheckCircle2 size={18} /> : <BellOff size={18} />}
                </div>
                <div>
                  <p className={`text-xs font-bold ${notifGranted ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {notifGranted ? 'Push Notifications Active ✓' : 'Push Notifications Disabled'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {notifGranted
                      ? 'Morning check (7 AM), period alerts, and daily bunk summary will be delivered.'
                      : 'Enable to receive morning timetable checks and period reminders.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!notifGranted ? (
                <button
                  onClick={enableNotifications}
                  disabled={subscribing}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
                >
                  <Bell size={14} />
                  {subscribing ? 'Connecting…' : 'Enable Push Notifications'}
                </button>
              ) : (
                <button
                  onClick={testNotification}
                  disabled={subscribing}
                  className={`px-5 py-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 ${
                    isDark
                      ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                      : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-900'
                  }`}
                >
                  <Bell size={14} className="text-blue-500" />
                  {subscribing ? 'Sending…' : 'Send Test Notification'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Student ID Badge */}
      <div className={`rounded-2xl p-6 border ${cardBg}`}>
        <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
          <Shield size={16} className="text-blue-500" /> Student Verification
        </h3>
        <div className={`flex items-center justify-between p-4 rounded-xl border ${
          isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50/50 border-blue-200'
        }`}>
          <div className="flex items-center gap-3">
            <IdCard size={28} className="text-blue-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold">{user?.studentId}</p>
              <p className="text-xs text-slate-500">{user?.name} • {user?.college || 'College Verified'}</p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
            ✓ Verified
          </span>
        </div>
      </div>
    </div>
  );
}
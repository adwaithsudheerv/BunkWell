import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { User, Bell, BellOff, Settings, IdCard, Building, BookOpen, Save, Shield } from 'lucide-react';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
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
    setNotifSupported('Notification' in window && 'serviceWorker' in navigator);
    setNotifGranted(Notification.permission === 'granted');
    api.get('/notifications/vapid-key').then(res => setVapidKey(res.data.publicKey)).catch(() => {});
  }, []);

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', form);
      updateUser(res.data.user);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const enableNotifications = async () => {
    if (!vapidKey) { toast.error('Push notifications not configured on server'); return; }
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { toast.error('Notification permission denied'); return; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await api.post('/notifications/subscribe', { subscription: sub.toJSON() });
      setNotifGranted(true);
      toast.success('Push notifications enabled! 🔔');
    } catch (err) {
      toast.error('Failed to enable notifications: ' + err.message);
    } finally {
      setSubscribing(false);
    }
  };

  const testNotification = async () => {
    try {
      await api.post('/notifications/test');
      toast.success('Test notification sent!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
      <div>
        <h2 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
          <User size={24} className="text-amber-500" /> Profile
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Avatar / Info Card */}
      <div className="glass-card rounded-2xl p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center text-2xl font-bold text-white shadow-xl shadow-orange-500/30 flex-shrink-0">
          {user?.name?.charAt(0)?.toUpperCase()}
        </div>
        <div>
          <p className="text-xl font-bold text-white">{user?.name}</p>
          <p className="text-slate-500 text-sm">@{user?.username}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
              <IdCard size={12} /> {user?.studentId}
            </div>
            {user?.department && (
              <div className="px-2 py-0.5 rounded-full bg-white/5 text-slate-400 text-xs">{user.department}</div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <Settings size={16} className="text-amber-500" /> Personal Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">Full Name</label>
            <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#2a2a4a] text-white focus:outline-none focus:border-amber-500 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">College</label>
            <div className="relative">
              <Building size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" value={form.college} onChange={e => update('college', e.target.value)}
                placeholder="College name"
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/5 border border-[#2a2a4a] text-white focus:outline-none focus:border-amber-500 text-sm placeholder-slate-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">Department</label>
            <input type="text" value={form.department} onChange={e => update('department', e.target.value)}
              placeholder="e.g. Computer Science"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#2a2a4a] text-white focus:outline-none focus:border-amber-500 text-sm placeholder-slate-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">Current Semester</label>
            <select value={form.semester} onChange={e => update('semester', Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#2a2a4a] text-white focus:outline-none focus:border-amber-500 text-sm">
              {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
        </div>

        {/* Attendance target */}
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block font-medium">
            Attendance Target: <span className="text-[#6366f1] font-bold">{form.attendanceTarget}%</span>
          </label>
          <input type="range" min={50} max={100} step={5} value={form.attendanceTarget}
            onChange={e => update('attendanceTarget', Number(e.target.value))}
            className="w-full accent-amber-500" />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>50%</span><span>75%</span><span>100%</span>
          </div>
        </div>

        <button onClick={save} disabled={saving}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Notifications */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <Bell size={16} className="text-[#6366f1]" /> Push Notifications
        </h3>

        {!notifSupported ? (
          <p className="text-slate-500 text-sm">Push notifications are not supported in this browser.</p>
        ) : (
          <div className="space-y-3">
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${notifGranted ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
              {notifGranted ? <Bell size={18} className="text-emerald-400" /> : <BellOff size={18} className="text-amber-400" />}
              <div>
                <p className={`text-sm font-medium ${notifGranted ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {notifGranted ? 'Notifications Enabled ✓' : 'Notifications Not Enabled'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {notifGranted ? 'You\'ll receive morning check, period end, and evening summary notifications.' : 'Enable to get attendance reminders.'}
                </p>
              </div>
            </div>

            {!notifGranted && (
              <button onClick={enableNotifications} disabled={subscribing}
                className="w-full py-3 rounded-xl border border-[#6366f1] text-[#6366f1] text-sm font-medium hover:bg-[#6366f1]/10 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                <Bell size={16} />
                {subscribing ? 'Enabling...' : 'Enable Push Notifications'}
              </button>
            )}

            {notifGranted && (
              <button onClick={testNotification}
                className="w-full py-3 rounded-xl bg-white/5 border border-[#2a2a4a] text-slate-400 text-sm hover:text-white hover:border-[#6366f1] transition-colors flex items-center justify-center gap-2">
                <Bell size={16} /> Send Test Notification
              </button>
            )}

            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">🌅 <span><b className="text-slate-400">7:00 AM</b> — Morning check (Do you have classes?)</span></div>
              <div className="flex items-center gap-2">⏰ <span>End of each period — Mark attendance prompt</span></div>
              <div className="flex items-center gap-2">🌆 <span><b className="text-slate-400">6:00 PM</b> — Evening summary with bunk suggestions</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Student ID badge */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm mb-4">
          <Shield size={16} className="text-[#6366f1]" /> Student ID Verification
        </h3>
        <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-[#6366f1]/10 to-[#8b5cf6]/10 border border-[#6366f1]/20">
          <IdCard size={32} className="text-[#6366f1] flex-shrink-0" />
          <div>
            <p className="text-white font-semibold">{user?.studentId}</p>
            <p className="text-xs text-slate-500 mt-0.5">Verified Student ID • {user?.college || 'College not set'}</p>
          </div>
          <div className="ml-auto">
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30">✓ Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

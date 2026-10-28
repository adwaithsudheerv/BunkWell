import { Capacitor, registerPlugin } from '@capacitor/core';
import api from './api';

const BunkClubBackground = registerPlugin('BunkClubBackground');

class BackgroundSentinelService {
  constructor() {
    this.isMuted = false;
    this.currentPeriod = null;
    this.timer = null;
    this.todaySchedule = null;
    this.todayExtraPeriods = [];
  }

  init() {
    this.sync();
    // Continuous monitoring loop (every 15 seconds in foreground)
    this.timer = setInterval(() => this.evaluate(), 15 * 1000);
    this.evaluate();

    window.addEventListener('timetable-updated', () => this.sync());
    window.addEventListener('attendance-updated', () => this.sync());
    window.addEventListener('extra-class-added', () => this.sync());
  }

  async sync() {
    try {
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0];

      const [ttRes, attRes] = await Promise.all([
        api.get('/timetable').catch(() => ({ data: null })),
        api.get(`/attendance?date=${dateKey}`).catch(() => ({ data: null }))
      ]);

      this.todaySchedule = ttRes.data?.timetable || null;

      const recs = attRes.data?.records || [];
      this.todayExtraPeriods = recs.filter(r => r.isExtra === true).map(r => ({
        periodNumber: r.periodNumber,
        subjectName: r.subjectId?.name || 'Extra Class',
        startTime: r.startTime || '16:00',
        endTime: r.endTime || '17:00',
        status: r.status,
        isExtra: true
      }));

      // Send full period list to Android Background Foreground Service
      if (Capacitor.isNativePlatform()) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[now.getDay()];
        const dayData = this.todaySchedule?.days?.find(d => d.day === currentDay);
        const scheduled = (dayData?.periods || []).filter(p => p.subjectName && p.startTime && p.endTime);
        const all = [...scheduled, ...this.todayExtraPeriods].map(p => ({
          periodNumber: p.periodNumber,
          startTime: p.startTime,
          endTime: p.endTime,
          subjectName: p.subjectName
        }));

        if (all.length > 0) {
          await BunkClubBackground.startBackgroundMonitoring({ periods: all });
        }
      }

      this.evaluate();
    } catch (e) {
      console.warn('Background sentinel sync error:', e);
    }
  }

  // Mark a period as bunked: IMMEDIATELY UNMUTES PHONE!
  async markBunk(periodNumber, dateKey) {
    const today = dateKey || new Date().toISOString().split('T')[0];
    localStorage.setItem(`bunked_${today}_P${periodNumber}`, 'true');

    if (Capacitor.isNativePlatform()) {
      try {
        await BunkClubBackground.markBunk({ periodNumber, date: today });
      } catch (e) {}
    }

    this.isMuted = false;
    this.currentPeriod = null;

    window.dispatchEvent(new CustomEvent('sentinel-status', {
      detail: {
        isMuted: false,
        text: `🔔 Bunked P${periodNumber} • Phone Unmuted (Active Mode)`
      }
    }));
  }

  // Evaluate current lecture period and strictly apply mute/unmute
  async evaluate() {
    try {
      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[now.getDay()];
      const dateKey = now.toISOString().split('T')[0];

      // Sunday or marked holiday: Unmute phone!
      const isMarkedHoliday = localStorage.getItem('holiday_' + dateKey) === 'true';
      if (currentDay === 'Sunday' || isMarkedHoliday) {
        await this.unmute(`Holiday / Weekend`);
        return;
      }

      const dayData = this.todaySchedule?.days?.find(d => d.day === currentDay);
      const scheduled = (dayData?.periods || []).filter(p => p.subjectName && p.startTime && p.endTime);
      const all = [...scheduled, ...this.todayExtraPeriods];

      if (all.length === 0) {
        await this.unmute('No sessions scheduled today');
        return;
      }

      const nowMin = now.getHours() * 60 + now.getMinutes();
      let currentPeriod = null;
      let nextPeriod = null;

      for (const p of all) {
        const [sh, sm] = p.startTime.split(':').map(Number);
        const [eh, em] = p.endTime.split(':').map(Number);
        const sMin = sh * 60 + sm;
        const eMin = eh * 60 + em;

        if (nowMin >= sMin && nowMin < eMin) {
          currentPeriod = p;
          break;
        } else if (nowMin < sMin && !nextPeriod) {
          nextPeriod = p;
        }
      }

      if (currentPeriod) {
        // Check if student marked this class as bunked
        const isBunked = localStorage.getItem(`bunked_${dateKey}_P${currentPeriod.periodNumber}`) === 'true' ||
                         currentPeriod.status === 'absent' ||
                         currentPeriod.status === 'cancelled';

        if (isBunked) {
          // Bunked: student is outside class -> MUST UNMUTE!
          await this.unmute(`Bunked P${currentPeriod.periodNumber} (${currentPeriod.subjectName})`);
        } else {
          // Attending: in class session -> MUST MUTE!
          await this.mute(currentPeriod);
        }
      } else {
        // Free Hour / Break / Classes over for the day: MUST UNMUTE!
        await this.unmute(nextPeriod ? `Break until ${nextPeriod.startTime}` : 'All classes finished for today');
      }
    } catch (err) {
      console.warn('Sentinel evaluation error:', err);
    }
  }

  async mute(session) {
    this.isMuted = true;
    this.currentPeriod = session;

    if (Capacitor.isNativePlatform()) {
      try {
        await BunkClubBackground.muteNow();
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('sentinel-status', {
      detail: {
        isMuted: true,
        session,
        text: `🔕 Period ${session.periodNumber}: ${session.subjectName} in Session • Auto-Muted`
      }
    }));
  }

  async unmute(reason) {
    this.isMuted = false;
    this.currentPeriod = null;

    if (Capacitor.isNativePlatform()) {
      try {
        await BunkClubBackground.unmuteNow();
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('sentinel-status', {
      detail: {
        isMuted: false,
        reason,
        text: `🔔 Active Ringer • ${reason || 'Free Hour'}`
      }
    }));
  }

  async requestPermissions() {
    if (Capacitor.isNativePlatform()) {
      try {
        await BunkClubBackground.requestPermissions();
      } catch (e) {}
    }
  }
}

export const backgroundSentinel = new BackgroundSentinelService();

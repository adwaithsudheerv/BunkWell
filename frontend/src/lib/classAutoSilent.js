import { Capacitor, registerPlugin } from '@capacitor/core';
import api from './api';

// Native plugin bridge (fallback to dummy on web)
const ClassSilentMode = registerPlugin('ClassSilentMode');

class ClassAutoSilentService {
  constructor() {
    this.isEnabled = localStorage.getItem('auto_silent_enabled') !== 'false';
    this.currentMode = 'normal'; // 'silent' | 'normal'
    this.timer = null;
    this.todaySchedule = null;
    this.currentSession = null;
  }

  // Initialize service
  init() {
    this.syncSchedule();
    // Check every 20 seconds
    this.timer = setInterval(() => this.evaluate(), 20 * 1000);
    this.evaluate();

    window.addEventListener('timetable-updated', () => this.syncSchedule());
    window.addEventListener('holiday-toggled', () => this.evaluate());
    window.addEventListener('attendance-updated', () => this.evaluate());
  }

  async syncSchedule() {
    try {
      const res = await api.get('/timetable');
      this.todaySchedule = res.data?.timetable || null;
      this.evaluate();
      this.syncNativeAlarms();
    } catch (e) {}
  }

  // Pass today's periods to Android native AlarmManager for guaranteed background execution
  async syncNativeAlarms() {
    if (!Capacitor.isNativePlatform() || !this.isEnabled || !this.todaySchedule) return;
    try {
      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[now.getDay()];
      const dayData = this.todaySchedule?.days?.find(d => d.day === currentDay);
      if (!dayData || !dayData.periods) return;

      const activePeriods = dayData.periods
        .filter(p => p.subjectName && p.startTime && p.endTime)
        .map(p => ({
          periodNumber: p.periodNumber,
          startTime: p.startTime,
          endTime: p.endTime,
          subjectName: p.subjectName
        }));

      if (activePeriods.length > 0) {
        await ClassSilentMode.scheduleLectureAlarms({ periods: activePeriods });
      }
    } catch (err) {
      console.warn('Native alarm sync error:', err);
    }
  }

  toggle(enabled) {
    this.isEnabled = enabled;
    localStorage.setItem('auto_silent_enabled', enabled ? 'true' : 'false');
    if (!enabled) {
      this.setNormalMode({ reason: 'Auto-Silent Disabled' });
    } else {
      this.evaluate();
    }
  }

  // User explicitly marked a class as bunked/absent or cancelled
  async markPeriodBunked(periodNumber, dateKey) {
    const today = dateKey || new Date().toISOString().split('T')[0];
    localStorage.setItem(`bunked_${today}_P${periodNumber}`, 'true');

    if (Capacitor.isNativePlatform()) {
      try {
        await ClassSilentMode.markBunk({ periodNumber, date: today });
      } catch (e) {}
    }

    // Since student is outside class, IMMEDIATELY RESTORE ACTIVE RINGER MODE!
    await this.setNormalMode({
      reason: `Bunked Period ${periodNumber} • Outside Class (Active Mode)`
    });
  }

  // Evaluate current time against today's lecture schedule and bunks
  async evaluate() {
    if (!this.isEnabled) return;

    try {
      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[now.getDay()];
      const dateKey = now.toISOString().split('T')[0];

      // 1. Holiday / Weekend check
      const isMarkedHoliday = localStorage.getItem('holiday_' + dateKey) === 'true';
      if (currentDay === 'Sunday' || isMarkedHoliday) {
        this.setNormalMode({ reason: 'Holiday / No classes today' });
        return;
      }

      // 2. Fetch today's day schedule from timetable
      const dayData = this.todaySchedule?.days?.find(d => d.day === currentDay);
      if (!dayData || !dayData.periods || dayData.periods.length === 0) {
        this.setNormalMode({ reason: 'No lectures scheduled today' });
        return;
      }

      const activePeriods = dayData.periods.filter(p => p.subjectName && p.startTime && p.endTime);
      if (activePeriods.length === 0) {
        this.setNormalMode({ reason: 'Free day' });
        return;
      }

      // Current time in minutes from midnight
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      // Check if current time is inside an active class period
      let currentClassPeriod = null;
      let nextUpcomingPeriod = null;

      for (const p of activePeriods) {
        const [sh, sm] = p.startTime.split(':').map(Number);
        const [eh, em] = p.endTime.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;

        if (nowMinutes >= startMin && nowMinutes < endMin) {
          currentClassPeriod = p;
          break;
        } else if (nowMinutes < startMin && !nextUpcomingPeriod) {
          nextUpcomingPeriod = p;
        }
      }

      if (currentClassPeriod) {
        // CHECK IF STUDENT BUNKED OR CANCELLED THIS PERIOD:
        const isBunked = localStorage.getItem(`bunked_${dateKey}_P${currentClassPeriod.periodNumber}`) === 'true';
        if (isBunked) {
          // Student is OUTSIDE the class: RESTORE ACTIVE RINGER MODE!
          this.setNormalMode({
            reason: `Bunked P${currentClassPeriod.periodNumber} (${currentClassPeriod.subjectName}) • Active Mode Restored`
          });
          return;
        }

        // Class is in session and student is attending: Auto-Silence the phone
        this.setSilentMode({
          periodNumber: currentClassPeriod.periodNumber,
          subjectName: currentClassPeriod.subjectName,
          endTime: currentClassPeriod.endTime
        });
      } else {
        // Free Hour, Lunch/Break, or Classes finished for the day! Auto-Restore active ringer
        this.setNormalMode({
          reason: nextUpcomingPeriod
            ? `Break / Free Hour until ${nextUpcomingPeriod.startTime} (Period ${nextUpcomingPeriod.periodNumber})`
            : 'Classes completed for today'
        });
      }
    } catch (e) {
      console.warn('Auto-silent evaluation error:', e);
    }
  }

  async setSilentMode(sessionInfo) {
    if (this.currentMode === 'silent' && this.currentSession?.periodNumber === sessionInfo.periodNumber) {
      return;
    }

    this.currentMode = 'silent';
    this.currentSession = sessionInfo;

    // Trigger Android Native Audio Service to vibrate/silent
    if (Capacitor.isNativePlatform()) {
      try {
        await ClassSilentMode.setSilent();
      } catch (e) {}
    }

    // Broadcast status to Dynamic Heads-Up Island
    window.dispatchEvent(new CustomEvent('class-silent-status', {
      detail: {
        isSilent: true,
        session: sessionInfo,
        text: `🔕 Auto-Silent Active • P${sessionInfo.periodNumber}: ${sessionInfo.subjectName} (until ${sessionInfo.endTime})`
      }
    }));
  }

  async setNormalMode(info = {}) {
    if (this.currentMode === 'normal' && !this.currentSession) {
      return;
    }

    this.currentMode = 'normal';
    this.currentSession = null;

    // Trigger Android Native Audio Service to restore normal audible ringer
    if (Capacitor.isNativePlatform()) {
      try {
        await ClassSilentMode.setNormal();
      } catch (e) {}
    }

    // Broadcast status to Dynamic Heads-Up Island
    window.dispatchEvent(new CustomEvent('class-silent-status', {
      detail: {
        isSilent: false,
        reason: info.reason || 'Active Audible Mode',
        text: `🔔 Active Mode • ${info.reason || 'Normal Ringer'}`
      }
    }));
  }
}

export const autoSilentService = new ClassAutoSilentService();

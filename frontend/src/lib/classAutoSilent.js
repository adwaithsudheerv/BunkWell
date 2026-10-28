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
    this.todayExtraPeriods = [];
    this.currentSession = null;
  }

  // Initialize service
  init() {
    this.syncSchedule();
    // Strictly verify every 10 seconds whether current class state matches ringer mode
    this.timer = setInterval(() => this.evaluate(), 10 * 1000);
    this.evaluate();

    window.addEventListener('timetable-updated', () => this.syncSchedule());
    window.addEventListener('holiday-toggled', () => this.evaluate());
    window.addEventListener('attendance-updated', () => this.syncSchedule());
    window.addEventListener('extra-class-added', () => this.syncSchedule());
  }

  async syncSchedule() {
    try {
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0];

      const [ttRes, attRes] = await Promise.all([
        api.get('/timetable').catch(() => ({ data: null })),
        api.get(`/attendance?date=${dateKey}`).catch(() => ({ data: null }))
      ]);

      this.todaySchedule = ttRes.data?.timetable || null;

      // Extract extra classes logged today
      const recs = attRes.data?.records || [];
      const extras = recs.filter(r => r.isExtra === true).map(r => ({
        periodNumber: r.periodNumber,
        subjectName: r.subjectId?.name || 'Extra Class',
        startTime: r.startTime || '16:00',
        endTime: r.endTime || '17:00',
        status: r.status,
        isExtra: true
      }));

      // Merge with locally recorded extra classes
      const localExtras = JSON.parse(localStorage.getItem(`today_extra_classes_${dateKey}`) || '[]');
      const combinedExtras = [...extras];
      localExtras.forEach(le => {
        if (!combinedExtras.some(ce => ce.periodNumber === le.periodNumber)) {
          combinedExtras.push(le);
        }
      });

      this.todayExtraPeriods = combinedExtras;
      this.evaluate();
      this.syncNativeAlarms();
    } catch (e) {
      console.warn('Sync schedule error:', e);
    }
  }

  // Pass all periods (scheduled + extra classes) to Android native AlarmManager
  async syncNativeAlarms() {
    if (!Capacitor.isNativePlatform() || !this.isEnabled) return;
    try {
      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[now.getDay()];
      const dayData = this.todaySchedule?.days?.find(d => d.day === currentDay);

      const scheduled = (dayData?.periods || [])
        .filter(p => p.subjectName && p.startTime && p.endTime)
        .map(p => ({
          periodNumber: p.periodNumber,
          startTime: p.startTime,
          endTime: p.endTime,
          subjectName: p.subjectName
        }));

      const extras = (this.todayExtraPeriods || [])
        .filter(e => e.startTime && e.endTime && e.status !== 'absent' && e.status !== 'cancelled')
        .map(e => ({
          periodNumber: e.periodNumber,
          startTime: e.startTime,
          endTime: e.endTime,
          subjectName: `(Extra) ${e.subjectName}`
        }));

      const allActive = [...scheduled, ...extras];
      if (allActive.length > 0) {
        await ClassSilentMode.scheduleLectureAlarms({ periods: allActive });
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

  // Register and immediately trigger auto-silent for an extra class
  async registerExtraClass({ periodNumber, subjectName, startTime, endTime, status }) {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];

    const extraObj = {
      periodNumber,
      subjectName,
      startTime: startTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      endTime: endTime || `${String((now.getHours() + 1) % 24).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      status: status || 'present',
      isExtra: true
    };

    // Store in localStorage
    const existing = JSON.parse(localStorage.getItem(`today_extra_classes_${dateKey}`) || '[]');
    const filtered = existing.filter(e => e.periodNumber !== periodNumber);
    filtered.push(extraObj);
    localStorage.setItem(`today_extra_classes_${dateKey}`, JSON.stringify(filtered));

    this.todayExtraPeriods = filtered;

    // Call native Android plugin to register extra class alarm & trigger silent if right now
    if (Capacitor.isNativePlatform()) {
      try {
        await ClassSilentMode.registerExtraClass(extraObj);
      } catch (e) {}
    }

    if (extraObj.status === 'present') {
      await this.setSilentMode({
        periodNumber: extraObj.periodNumber,
        subjectName: extraObj.subjectName,
        endTime: extraObj.endTime,
        isExtra: true
      });
    } else {
      await this.markPeriodBunked(periodNumber, dateKey);
    }

    this.evaluate();
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

    // Since student is outside class, IMMEDIATELY RESTORE ACTIVE AUDIBLE RINGER!
    await this.setNormalMode({
      reason: `Bunked Period ${periodNumber} • Outside Class (Active Mode)`
    });
  }

  // Evaluate current time against today's lecture schedule, extra classes, and bunks
  async evaluate() {
    if (!this.isEnabled) return;

    try {
      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[now.getDay()];
      const dateKey = now.toISOString().split('T')[0];

      // 1. Holiday / Weekend check (Unless an extra class was explicitly added for today)
      const isMarkedHoliday = localStorage.getItem('holiday_' + dateKey) === 'true';
      const hasActiveExtraToday = (this.todayExtraPeriods || []).some(e => e.status === 'present');

      if ((currentDay === 'Sunday' || isMarkedHoliday) && !hasActiveExtraToday) {
        this.setNormalMode({ reason: 'Holiday / No classes today' });
        return;
      }

      // 2. Fetch scheduled periods + extra periods
      const dayData = this.todaySchedule?.days?.find(d => d.day === currentDay);
      const scheduledPeriods = (dayData?.periods || []).filter(p => p.subjectName && p.startTime && p.endTime);
      const extraPeriods = (this.todayExtraPeriods || []).filter(e => e.subjectName && e.startTime && e.endTime);

      const allPeriods = [...scheduledPeriods, ...extraPeriods];

      if (allPeriods.length === 0) {
        this.setNormalMode({ reason: 'No lectures scheduled' });
        return;
      }

      // Current time in minutes from midnight
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      // Check if current time is inside an active class period (scheduled or extra)
      let currentClassPeriod = null;
      let nextUpcomingPeriod = null;

      for (const p of allPeriods) {
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
        const isBunked = localStorage.getItem(`bunked_${dateKey}_P${currentClassPeriod.periodNumber}`) === 'true' ||
                         currentClassPeriod.status === 'absent' ||
                         currentClassPeriod.status === 'cancelled';

        if (isBunked) {
          // Student is OUTSIDE the class: STRICTLY ENFORCE ACTIVE RINGER!
          this.setNormalMode({
            reason: `Bunked P${currentClassPeriod.periodNumber} (${currentClassPeriod.subjectName}) • Active Mode Restored`
          });
          return;
        }

        // Class is in session (scheduled or extra) and student is attending: STRICTLY ENFORCE SILENT!
        this.setSilentMode({
          periodNumber: currentClassPeriod.periodNumber,
          subjectName: currentClassPeriod.subjectName,
          endTime: currentClassPeriod.endTime,
          isExtra: Boolean(currentClassPeriod.isExtra)
        });
      } else {
        // Free Hour, Lunch/Break, or Classes finished for the day! STRICTLY ENFORCE ACTIVE RINGER!
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
    this.currentMode = 'silent';
    this.currentSession = sessionInfo;

    // Strictly trigger Android Native Audio Service on every cycle
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
        text: `🔕 Auto-Silent Active • ${sessionInfo.isExtra ? '(Extra) ' : ''}P${sessionInfo.periodNumber}: ${sessionInfo.subjectName} (until ${sessionInfo.endTime})`
      }
    }));
  }

  async setNormalMode(info = {}) {
    this.currentMode = 'normal';
    this.currentSession = null;

    // Strictly trigger Android Native Audio Service on every cycle
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

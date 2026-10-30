import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export async function autoInitializeNotifications() {
  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Create channel unconditionally
      await LocalNotifications.createChannel({
        id: 'bunkclub_alerts',
        name: 'BunkClub Attendance & Class Alerts',
        description: 'Daily morning schedules, period check-ins and bunk alerts',
        importance: 5,
        visibility: 1,
        vibration: true
      });

      // 2. Register Direct Action Types for period attendance (Present, Absent, Cancelled, Replaced)
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: 'PERIOD_ATTENDANCE_ACTIONS',
            actions: [
              {
                id: 'ACTION_PRESENT',
                title: '✅ Present',
                foreground: false
              },
              {
                id: 'ACTION_ABSENT',
                title: '❌ Absent',
                foreground: false,
                destructive: true
              },
              {
                id: 'ACTION_CANCELLED',
                title: '🚫 Cancelled',
                foreground: false
              },
              {
                id: 'ACTION_REPLACED',
                title: '🔄 Replaced',
                foreground: false
              }
            ]
          }
        ]
      });

      // 3. Request / verify permission automatically on install/launch
      const check = await LocalNotifications.checkPermissions();
      if (check.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
      return true;
    } catch (e) {
      console.warn('Native auto-notif initialization error:', e);
    }
  } else if ('Notification' in window) {
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {}
    }
  }
  return false;
}

export async function requestNotificationPermissions() {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.requestPermissions();
      if (status.display === 'granted') {
        // Create high-priority notification channel for Android
        await LocalNotifications.createChannel({
          id: 'bunkclub_alerts',
          name: 'BunkClub Attendance & Class Alerts',
          description: 'Daily morning schedules, period check-ins and bunk alerts',
          importance: 5,
          visibility: 1,
          vibration: true
        });
        return true;
      }
    } catch (e) {
      console.warn('Native notification permission error:', e);
    }
  } else if ('Notification' in window) {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
}

export async function sendInstantTestNotification(title = 'BunkClub Live Alert 🔔', body = 'Your attendance tracking is active and running 24/7!') {
  if (Capacitor.isNativePlatform()) {
    try {
      await requestNotificationPermissions();
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Math.floor(Math.random() * 100000),
            schedule: { at: new Date(Date.now() + 1000) },
            channelId: 'bunkclub_alerts',
            smallIcon: 'ic_launcher_round',
            sound: undefined
          }
        ]
      });
      return true;
    } catch (e) {
      console.error('Failed to trigger native notification:', e);
    }
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon-192.png' });
    return true;
  }
  return false;
}

export async function scheduleScheduleReminders(timetable) {
  if (!Capacitor.isNativePlatform() || !timetable || !timetable.days) return;

  try {
    await requestNotificationPermissions();

    // Cancel previously scheduled local notifications
    const pending = await LocalNotifications.getPending();
    if (pending.notifications?.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    const notificationsToSchedule = [];
    const daysMap = {
      Sunday: 1,
      Monday: 2,
      Tuesday: 3,
      Wednesday: 4,
      Thursday: 5,
      Friday: 6,
      Saturday: 7
    };

    let notifId = 100;

    for (const d of timetable.days) {
      const dayNum = daysMap[d.day];
      if (!dayNum) continue;

      const activePeriods = (d.periods || []).filter(p => p.subjectName);
      const hasClasses = activePeriods.length > 0;

      // 1. Morning 08:00 AM notification on this day of week
      if (hasClasses) {
        const subjectNames = activePeriods.map(p => p.subjectName).filter(Boolean).slice(0, 3).join(', ');
        notificationsToSchedule.push({
          id: notifId++,
          title: `🌅 Today's Classes (${d.day})`,
          body: `You have ${activePeriods.length} class(es) today: ${subjectNames}. Tap to check your safe bunks!`,
          schedule: {
            on: {
              weekday: dayNum,
              hour: 8,
              minute: 0
            },
            allowWhileIdle: true
          },
          channelId: 'bunkclub_alerts'
        });

        // 2. Evening 06:00 PM (18:00) 1-Tap Reconciliation notification
        notificationsToSchedule.push({
          id: notifId++,
          title: `⚡ Daily Wrap-Up: Were classes taken today?`,
          body: `1-Tap reconcile: Mark today's ${activePeriods.length} period(s) attended, cancelled, or swapped.`,
          schedule: {
            on: {
              weekday: dayNum,
              hour: 18,
              minute: 0
            },
            allowWhileIdle: true
          },
          channelId: 'bunkclub_alerts'
        });

        // 3. Schedule reminders 10 minutes before classes
        for (const p of activePeriods) {
          if (!p.startTime) continue;
          const [h, m] = p.startTime.split(':').map(Number);
          if (isNaN(h) || isNaN(m)) continue;

          let alertHour = h;
          let alertMin = m - 10;
          if (alertMin < 0) {
            alertHour = Math.max(0, h - 1);
            alertMin = 50;
          }

          notificationsToSchedule.push({
            id: notifId++,
            title: `⏰ Period ${p.periodNumber}: ${p.subjectName || 'Class'} (${p.startTime})`,
            body: `Did you attend Period ${p.periodNumber}? Tap directly to mark your attendance.`,
            actionTypeId: 'PERIOD_ATTENDANCE_ACTIONS',
            extra: {
              action: 'period_check',
              periodNumber: p.periodNumber,
              subjectName: p.subjectName,
              subjectId: p.subjectId?._id || p.subjectId
            },
            schedule: {
              on: {
                weekday: dayNum,
                hour: alertHour,
                minute: alertMin
              },
              allowWhileIdle: true
            },
            channelId: 'bunkclub_alerts'
          });
        }
      } else {
        // Free day morning alert
        notificationsToSchedule.push({
          id: notifId++,
          title: `🎉 No Classes Today! (${d.day})`,
          body: `No classes scheduled for today. Enjoy your day off!`,
          schedule: {
            on: {
              weekday: dayNum,
              hour: 8,
              minute: 0
            },
            allowWhileIdle: true
          },
          channelId: 'bunkclub_alerts'
        });
      }
    }

    if (notificationsToSchedule.length > 0) {
      // Schedule first 30 notifications (Android limit is 50-64 alarms)
      await LocalNotifications.schedule({
        notifications: notificationsToSchedule.slice(0, 30)
      });
      console.log(`[LocalNotif] Successfully scheduled ${Math.min(30, notificationsToSchedule.length)} native alarms`);
    }

  } catch (err) {
    console.warn('Failed to schedule local notifications:', err);
  }
}

// Sent notification whenever Active Mode or Silent Mode is toggled
let lastNotificationMode = null;
export async function notifyRingerModeChange(mode, subjectName) {
  try {
    const isMuted = mode === 'silent' || mode === 'muted';
    const modeKey = `${isMuted ? 'silent' : 'active'}_${subjectName || 'general'}`;
    if (lastNotificationMode === modeKey) return;
    lastNotificationMode = modeKey;

    const title = isMuted ? '🔕 Silent Mode Active' : '🔔 Active Mode Active';
    const body = isMuted
      ? `Lecture in session: ${subjectName || 'Class'}. Phone auto-muted.`
      : `Lecture finished or bunked: ${subjectName || 'Class'}. Ringer is audible.`;

    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 9911,
            title,
            body,
            channelId: 'bunkclub_alerts',
            schedule: { at: new Date(Date.now() + 100) },
          }
        ]
      });
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon-192.png' });
    }
  } catch (e) {
    console.warn('Ringer notification error:', e);
  }
}


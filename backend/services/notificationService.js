const webpush = require('web-push');
const User = require('../models/User');
const Subject = require('../models/Subject');
const AttendanceRecord = require('../models/AttendanceRecord');
const Timetable = require('../models/Timetable');

async function sendPushToUser(user, payload) {
  if (!user.pushSubscriptions || !user.pushSubscriptions.length) return;
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const sub of user.pushSubscriptions) {
    try {
      await webpush.sendNotification(sub, payloadStr);
    } catch (err) {
      console.log('Stale subscription removed for', user.username);
      // Remove stale subscription
      user.pushSubscriptions = user.pushSubscriptions.filter(s => s.endpoint !== sub.endpoint);
      await user.save();
    }
  }
}

async function sendMorningNotifications() {
  try {
    const now = new Date();
    const kolkataDay = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(now);
    const users = await User.find({ notificationsEnabled: true });

    for (const user of users) {
      const timetable = await Timetable.findOne({ userId: user._id, isActive: true });
      const daySchedule = timetable ? timetable.days.find(d => d.day.toLowerCase() === kolkataDay.toLowerCase()) : null;
      const periods = daySchedule && daySchedule.periods ? daySchedule.periods.filter(p => p.subjectName) : [];
      const hasPeriods = periods.length > 0;

      let body = '';
      if (hasPeriods) {
        const periodSummary = periods
          .map(p => `${p.subjectName}${p.startTime ? ` (${p.startTime})` : ''}`)
          .slice(0, 4)
          .join(', ');
        body = `You have ${periods.length} class(es) today: ${periodSummary}${periods.length > 4 ? '...' : ''}. Tap to view schedule.`;
      } else {
        body = `No classes scheduled for today (${kolkataDay}). Enjoy your day off! 🎉`;
      }

      await sendPushToUser(user, {
        title: hasPeriods ? `🌅 Today's Classes (${kolkataDay})` : `🎉 No Classes Today!`,
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { type: 'morning_schedule', url: '/attendance/today' },
        actions: hasPeriods ? [
          { action: 'view_today', title: '📅 View Schedule' }
        ] : [],
      });
    }
    console.log(`[CRON] Morning 8:00 AM notifications sent to ${users.length} users`);
  } catch (err) {
    console.error('[CRON] Morning notification error:', err);
  }
}

async function sendPeriodEndNotifications(userId, periodNumber) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.notificationsEnabled) return;
    await sendPushToUser(user, {
      title: `⏰ Period ${periodNumber} just ended!`,
      body: `Was Period ${periodNumber} taken? Mark your attendance now.`,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: { type: 'period_end', periodNumber, url: '/attendance/today' },
    });
  } catch (err) {
    console.error('[NOTIFICATION] Period end error:', err);
  }
}

async function sendEveningNotifications() {
  try {
    const users = await User.find({ notificationsEnabled: true });
    const now = new Date();
    const kolkataDay = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(now);

    for (const user of users) {
      const timetable = await Timetable.findOne({ userId: user._id, isActive: true });
      const daySchedule = timetable ? timetable.days.find(d => d.day.toLowerCase() === kolkataDay.toLowerCase()) : null;
      const count = (daySchedule && daySchedule.periods) ? daySchedule.periods.filter(p => p.subjectName).length : 0;

      await sendPushToUser(user, {
        title: `⚡ Daily Wrap-Up: Were today's classes taken?`,
        body: count > 0
          ? `Reconcile today's ${count} class(es) in 1 tap: mark attended, cancelled, or swapped with other subjects.`
          : `Did you have any extra or substitute classes today? Tap to record your attendance.`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { type: 'evening_reconciliation', openWrapUp: true, url: '/attendance/today' },
        actions: [
          { action: 'open_wrapup', title: '⚡ 1-Tap Reconcile' }
        ],
      });
    }
    console.log(`[CRON] Evening 6:00 PM reconciliation notifications sent to ${users.length} users`);
  } catch (err) {
    console.error('[CRON] Evening notification error:', err);
  }
}

module.exports = { sendMorningNotifications, sendEveningNotifications, sendPeriodEndNotifications };

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
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    const users = await User.find({ notificationsEnabled: true });

    for (const user of users) {
      const timetable = await Timetable.findOne({ userId: user._id, isActive: true });
      if (!timetable) continue;
      const daySchedule = timetable.days.find(d => d.day === today);
      const hasPeriods = daySchedule && daySchedule.periods && daySchedule.periods.length > 0;

      await sendPushToUser(user, {
        title: `🌅 Good Morning, ${user.name.split(' ')[0]}!`,
        body: hasPeriods
          ? `You have ${daySchedule.periods.length} period(s) today. Do you have classes? Tap to mark.`
          : `No classes scheduled for ${today}. Enjoy your day! 🎉`,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        data: { type: 'morning_check', url: '/attendance/today' },
        actions: hasPeriods ? [
          { action: 'yes', title: '✅ Yes, I have classes' },
          { action: 'no', title: '❌ No classes today' }
        ] : [],
      });
    }
    console.log(`[CRON] Morning notifications sent to ${users.length} users`);
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
    const target = 80;

    for (const user of users) {
      const subjects = await Subject.find({ userId: user._id, isActive: true });
      const canBunkList = [];
      const dangerList = [];

      for (const s of subjects) {
        const eligible = s.totalClasses - s.cancelledClasses;
        const percentage = eligible > 0 ? (s.attendedClasses / eligible) * 100 : 100;
        const userTarget = user.attendanceTarget || target;

        if (percentage < userTarget) {
          dangerList.push(`${s.name} (${percentage.toFixed(0)}%)`);
        } else {
          // Can they bunk next class?
          const nextEligible = eligible + 1;
          const ifAbsent = (s.attendedClasses / nextEligible) * 100;
          if (ifAbsent >= userTarget) canBunkList.push(s.name);
        }
      }

      let body = '';
      if (canBunkList.length) body += `✅ Can bunk: ${canBunkList.slice(0, 3).join(', ')}. `;
      if (dangerList.length) body += `⚠️ Low attendance: ${dangerList.slice(0, 3).join(', ')}.`;
      if (!body) body = 'All subjects are on track! Keep it up! 🎓';

      await sendPushToUser(user, {
        title: `📊 Today's Bunkwell Summary`,
        body,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        data: { type: 'evening_summary', url: '/analytics' },
      });
    }
    console.log(`[CRON] Evening summaries sent to ${users.length} users`);
  } catch (err) {
    console.error('[CRON] Evening notification error:', err);
  }
}

module.exports = { sendMorningNotifications, sendEveningNotifications, sendPeriodEndNotifications };

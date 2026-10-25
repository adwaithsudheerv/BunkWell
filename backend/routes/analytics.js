const express = require('express');
const auth = require('../middleware/auth');
const Subject = require('../models/Subject');
const AttendanceRecord = require('../models/AttendanceRecord');
const router = express.Router();

// Get overall analytics
router.get('/overview', auth, async (req, res) => {
  try {
    const subjects = await Subject.find({ userId: req.user._id, isActive: true });
    const target = req.user.attendanceTarget || 80;

    // Fetch all recorded bunks for this user (sorted newest first)
    const bunkRecords = await AttendanceRecord.find({
      userId: req.user._id,
      status: 'absent'
    }).sort({ date: -1, periodNumber: -1 });

    const overview = subjects.map(s => {
      const eligible = s.totalClasses - (s.cancelledClasses || 0);
      const percentage = eligible > 0 ? parseFloat(((s.attendedClasses / eligible) * 100).toFixed(2)) : 100;

      // Classes can be bunked while staying at target
      const minNeeded = Math.ceil(eligible * target / 100);
      const canBunk = Math.max(0, s.attendedClasses - minNeeded);

      // To reach target from below, need this many more
      const needMore = percentage < target
        ? Math.ceil((target / 100 * eligible - s.attendedClasses) / (1 - target / 100))
        : 0;

      const subjectBunks = bunkRecords
        .filter(r => String(r.subjectId) === String(s._id))
        .map(r => ({
          date: r.date,
          periodNumber: r.periodNumber,
          dayOfWeek: r.dayOfWeek,
        }));

      return {
        _id: s._id,
        name: s.name,
        color: s.color,
        type: s.type,
        totalClasses: s.totalClasses,
        attendedClasses: s.attendedClasses,
        bunkedClasses: Math.max(0, s.totalClasses - s.attendedClasses),
        cancelledClasses: s.cancelledClasses || 0,
        eligibleClasses: eligible,
        percentage,
        canBunk,
        needMore,
        status: percentage >= target ? 'safe' : percentage >= target - 10 ? 'warning' : 'danger',
        bunkHistory: subjectBunks,
      };
    });

    const totalEligible = overview.reduce((a, s) => a + s.eligibleClasses, 0);
    const totalAttended = overview.reduce((a, s) => a + s.attendedClasses, 0);
    const totalCompleted = overview.reduce((a, s) => a + s.totalClasses, 0);
    const totalBunked = Math.max(0, totalCompleted - totalAttended);
    const overallPercentage = totalEligible > 0 ? parseFloat(((totalAttended / totalEligible) * 100).toFixed(2)) : 100;

    res.json({
      subjects: overview,
      totalCompleted,
      totalAttended,
      totalBunked,
      overallPercentage,
      target
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get bunk suggestions for today
router.get('/bunk-suggestions', auth, async (req, res) => {
  try {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    const target = req.user.attendanceTarget || 80;

    const subjects = await Subject.find({ userId: req.user._id, isActive: true });
    const suggestions = [];

    for (const s of subjects) {
      const eligible = s.totalClasses - s.cancelledClasses;
      const currentPercentage = eligible > 0 ? (s.attendedClasses / eligible) * 100 : 100;

      // If attended + 0 extra >= target: can bunk
      // attended / (eligible + 1) >= target/100  => would still pass if attend
      // attended / (eligible + 1) < target/100 but attended+1/(eligible+1) >= target/100 => must attend

      // Can they bunk today's class and stay above target?
      const newEligible = eligible + 1;
      const percentageIfAbsent = (s.attendedClasses / newEligible) * 100;
      const percentageIfPresent = ((s.attendedClasses + 1) / newEligible) * 100;

      suggestions.push({
        subjectId: s._id,
        name: s.name,
        code: s.code,
        color: s.color,
        currentPercentage: parseFloat(currentPercentage.toFixed(2)),
        percentageIfAbsent: parseFloat(percentageIfAbsent.toFixed(2)),
        percentageIfPresent: parseFloat(percentageIfPresent.toFixed(2)),
        canBunk: percentageIfAbsent >= target,
        mustAttend: percentageIfAbsent < target,
      });
    }

    const canBunkSubjects = suggestions.filter(s => s.canBunk);
    const mustAttendSubjects = suggestions.filter(s => s.mustAttend);

    res.json({ suggestions, canBunkSubjects, mustAttendSubjects, today, target });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Dynamic Ways to Bunk: Full Day Bunks, Morning Sleep-ins, Subject Bunk Cushions & Scenarios
router.get('/bunk-ways', auth, async (req, res) => {
  try {
    const Timetable = require('../models/Timetable');
    const target = req.user.attendanceTarget || 80;
    const subjects = await Subject.find({ userId: req.user._id, isActive: true });
    const timetable = await Timetable.findOne({ userId: req.user._id, isActive: true })
      .populate('days.periods.subjectId');

    const subjectMap = {};
    const subjectCushions = [];

    subjects.forEach(s => {
      const eligible = Math.max(0, s.totalClasses - (s.cancelledClasses || 0));
      const attended = s.attendedClasses || 0;
      const pct = eligible > 0 ? (attended / eligible) * 100 : 100;
      const minNeeded = Math.ceil(eligible * (target / 100));
      const safeBunks = Math.max(0, attended - minNeeded);
      const needMore = pct < target
        ? Math.ceil(((target / 100) * eligible - attended) / (1 - (target / 100)))
        : 0;

      const obj = {
        _id: s._id,
        name: s.name,
        color: s.color || '#0047FF',
        type: s.type || 'theory',
        total: s.totalClasses,
        attended: s.attendedClasses,
        pct: parseFloat(pct.toFixed(1)),
        safeBunks,
        needMore,
        status: pct >= target ? 'safe' : pct >= target - 10 ? 'warning' : 'danger'
      };
      subjectMap[String(s._id)] = obj;
      subjectCushions.push(obj);
    });

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayScenarios = [];
    const morningScenarios = [];

    if (timetable && timetable.days) {
      DAYS.forEach(dayName => {
        const daySchedule = timetable.days.find(d => d.day === dayName);
        const periods = (daySchedule?.periods || []).filter(p => p.subjectName || p.subjectId);

        if (!periods.length) {
          dayScenarios.push({
            day: dayName,
            totalClasses: 0,
            isHoliday: true,
            status: 'safe',
            label: 'No Classes',
            impacts: []
          });
          return;
        }

        // Count occurrences of each subject on this day
        const daySubCounts = {};
        periods.forEach(p => {
          const sId = p.subjectId?._id ? String(p.subjectId._id) : null;
          const sName = p.subjectName || p.subjectId?.name || 'Class';
          const key = sId || sName;
          if (!daySubCounts[key]) daySubCounts[key] = { id: sId, name: sName, count: 0 };
          daySubCounts[key].count++;
        });

        const impacts = [];
        let allSafe = true;

        Object.values(daySubCounts).forEach(item => {
          const sub = (item.id && subjectMap[item.id])
            ? subjectMap[item.id]
            : subjectCushions.find(s => s.name.toLowerCase() === item.name.toLowerCase());

          if (sub) {
            const currentTotal = sub.total;
            const currentAttended = sub.attended;
            const newTotal = currentTotal + item.count;
            const projPct = newTotal > 0 ? (currentAttended / newTotal) * 100 : 100;
            const isSafe = projPct >= target;
            if (!isSafe) allSafe = false;

            impacts.push({
              name: sub.name,
              color: sub.color,
              classesCount: item.count,
              currentPct: sub.pct,
              projectedPct: parseFloat(projPct.toFixed(1)),
              drop: parseFloat((sub.pct - projPct).toFixed(1)),
              isSafe
            });
          }
        });

        dayScenarios.push({
          day: dayName,
          totalClasses: periods.length,
          isHoliday: false,
          isSafe: allSafe,
          status: allSafe ? 'safe' : 'risk',
          label: allSafe ? 'Safe to Take Off 🎉' : 'Risky Bunk ⚠️',
          impacts
        });

        // Morning sleep-in (Period 1)
        const p1 = periods.find(p => p.periodNumber === 1);
        if (p1) {
          const sId = p1.subjectId?._id ? String(p1.subjectId._id) : null;
          const sName = p1.subjectName || p1.subjectId?.name || 'Period 1';
          const sub = (sId && subjectMap[sId])
            ? subjectMap[sId]
            : subjectCushions.find(s => s.name.toLowerCase() === sName.toLowerCase());

          if (sub) {
            const newTotal = sub.total + 1;
            const projPct = newTotal > 0 ? (sub.attended / newTotal) * 100 : 100;
            morningScenarios.push({
              day: dayName,
              subjectName: sub.name,
              color: sub.color,
              time: p1.startTime || '8:00 AM',
              currentPct: sub.pct,
              projectedPct: parseFloat(projPct.toFixed(1)),
              isSafe: projPct >= target
            });
          }
        }
      });
    }

    res.json({
      target,
      subjectCushions,
      dayScenarios,
      morningScenarios,
      totalSafeBunksAcrossAll: subjectCushions.reduce((acc, s) => acc + s.safeBunks, 0)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Weekly attendance trend
router.get('/weekly', auth, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const records = await AttendanceRecord.find({
      userId: req.user._id,
      date: { $gte: sevenDaysAgo },
      status: { $ne: 'not_marked' }
    }).populate('subjectId');

    const byDay = {};
    records.forEach(r => {
      const d = new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
      if (!byDay[d]) byDay[d] = { date: d, present: 0, absent: 0, cancelled: 0 };
      if (['present', 'substitute', 'lab'].includes(r.status)) byDay[d].present++;
      else if (r.status === 'absent') byDay[d].absent++;
      else if (r.status === 'cancelled') byDay[d].cancelled++;
    });

    res.json({ weekly: Object.values(byDay) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Seed demo data for testing / presentation
router.post('/seed-demo', auth, async (req, res) => {
  try {
    const Timetable = require('../models/Timetable');
    const userId = req.user._id;

    // Check existing subjects
    let subjects = await Subject.find({ userId, isActive: true });
    if (subjects.length === 0) {
      const demoSubjects = [
        { userId, name: 'Data Structures & Algorithms', color: '#0047FF', type: 'theory', totalClasses: 32, attendedClasses: 28, cancelledClasses: 2, totalPlannedClasses: 45 },
        { userId, name: 'Operating Systems', color: '#10b981', type: 'theory', totalClasses: 28, attendedClasses: 24, cancelledClasses: 1, totalPlannedClasses: 45 },
        { userId, name: 'Database Management Systems', color: '#ef4444', type: 'theory', totalClasses: 30, attendedClasses: 22, cancelledClasses: 0, totalPlannedClasses: 45 },
        { userId, name: 'Computer Networks', color: '#3b82f6', type: 'theory', totalClasses: 26, attendedClasses: 22, cancelledClasses: 1, totalPlannedClasses: 45 },
        { userId, name: 'AI & ML Laboratory', color: '#8b5cf6', type: 'lab', totalClasses: 14, attendedClasses: 14, cancelledClasses: 0, totalPlannedClasses: 20 },
      ];
      subjects = await Subject.insertMany(demoSubjects);
    }

    // Create Mon-Sat timetable if none exists
    let timetable = await Timetable.findOne({ userId, isActive: true });
    if (!timetable && subjects.length > 0) {
      const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const defaultTimes = [
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '10:00', endTime: '11:00' },
        { startTime: '11:15', endTime: '12:15' },
        { startTime: '13:00', endTime: '14:00' },
        { startTime: '14:00', endTime: '15:00' },
      ];

      const days = DAYS.map((day, dayIdx) => ({
        day,
        periods: defaultTimes.map((t, pIdx) => {
          const sub = subjects[(dayIdx + pIdx) % subjects.length];
          return {
            periodNumber: pIdx + 1,
            subjectId: sub._id,
            subjectName: sub.name,
            startTime: t.startTime,
            endTime: t.endTime,
          };
        }),
      }));

      timetable = new Timetable({
        userId,
        semesterName: 'Semester 5 (2026)',
        days,
        isActive: true,
      });
      await timetable.save();
    }

    // Seed recent attendance records for the past 5 days
    const recentCount = await AttendanceRecord.countDocuments({ userId });
    if (recentCount === 0 && subjects.length > 0) {
      const statuses = ['present', 'present', 'present', 'absent', 'substitute'];
      const recordsToInsert = [];
      for (let i = 1; i <= 5; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        subjects.forEach((sub, sIdx) => {
          recordsToInsert.push({
            userId,
            subjectId: sub._id,
            date: d,
            periodNumber: sIdx + 1,
            status: statuses[(i + sIdx) % statuses.length],
            substituteFaculty: sIdx === 4 ? 'Prof. A. Kumar' : '',
            markedAt: d,
          });
        });
      }
      await AttendanceRecord.insertMany(recordsToInsert);
    }

    res.json({ message: 'Demo data loaded successfully! Refresh to see analytics.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

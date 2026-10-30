const express = require('express');
const auth = require('../middleware/auth');
const Timetable = require('../models/Timetable');
const Subject = require('../models/Subject');
const SharedTimetable = require('../models/SharedTimetable');
const AttendanceRecord = require('../models/AttendanceRecord');
const router = express.Router();

const DEFAULT_PERIODS = 6;

// Helper: Auto-sync timetable with Subjects, Attendance Records, and Admin SharedTimetable
async function syncTimetableToAttendanceAndShare(userId, timetable, user) {
  try {
    const palette = ['#0047FF', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1'];

    // 1. Ensure all subjects from timetable exist in user's Subject collection
    const existingSubjects = await Subject.find({ userId });
    const subMap = new Map();
    existingSubjects.forEach(s => subMap.set(s.name.trim().toLowerCase(), s));

    let colorIdx = existingSubjects.length;

    for (const dayObj of (timetable.days || [])) {
      for (const p of (dayObj.periods || [])) {
        const subName = (p.subjectName || '').trim();
        if (!subName) continue;
        const key = subName.toLowerCase();

        let subDoc = subMap.get(key);
        if (!subDoc) {
          subDoc = new Subject({
            userId,
            name: subName,
            color: p.color || palette[(colorIdx++) % palette.length],
            type: subName.toLowerCase().includes('lab') ? 'lab' : 'theory',
            targetPercentage: 75,
            totalClasses: 0,
            attendedClasses: 0,
            baseTotalClasses: 0,
            baseAttendedClasses: 0
          });
          await subDoc.save();
          subMap.set(key, subDoc);
        }

        if (!p.subjectId || String(p.subjectId) !== String(subDoc._id)) {
          p.subjectId = subDoc._id;
          p.color = subDoc.color;
        }
      }
    }

    // 2. Automatically generate unique full timetable share code if missing
    if (!timetable.shareCode) {
      let code = `BC-${Math.floor(1000 + Math.random() * 9000)}`;
      while (await SharedTimetable.findOne({ shareCode: code })) {
        code = `BC-${Math.floor(1000 + Math.random() * 9000)}`;
      }
      timetable.shareCode = code;
    }

    // Upsert into SharedTimetable so it is immediately stored & visible in AdminPanel
    const subjectsSummary = Array.from(subMap.values()).map(s => ({
      name: s.name,
      code: s.code || '',
      faculty: s.faculty || '',
      color: s.color || '#0047FF',
      type: s.type || 'theory'
    }));

    const daysSummary = (timetable.days || []).map(d => ({
      day: d.day,
      periods: (d.periods || []).map(p => ({
        periodNumber: p.periodNumber,
        subjectName: p.subjectName || 'Free Period',
        startTime: p.startTime || '',
        endTime: p.endTime || ''
      }))
    }));

    await SharedTimetable.findOneAndUpdate(
      { shareCode: timetable.shareCode },
      {
        shareCode: timetable.shareCode,
        title: timetable.semesterName || 'MCA Section ' + (timetable.section || 'A'),
        section: timetable.section || 'A',
        department: 'Department of MCA',
        college: 'Amrita Vishwa Vidyapeetham',
        creatorName: user?.name || user?.username || 'Student',
        creatorUserId: userId,
        subjects: subjectsSummary,
        days: daysSummary
      },
      { upsert: true, new: true }
    );

    await timetable.save();
    try { require('../services/supabaseSync').pushTimetableToSupabase(timetable); } catch (e) {}

    // 3. Automatically sync Today's Attendance periods so user doesn't need to manually add them!
    const todayStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(new Date());
    const todaySched = timetable.days?.find(d => d.day === todayStr);

    if (todaySched && todaySched.periods && todaySched.periods.length > 0) {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

      for (const p of todaySched.periods) {
        if (!p.subjectName || !p.subjectId) continue;

        const existingRecord = await AttendanceRecord.findOne({
          userId,
          date: { $gte: startOfDay, $lte: endOfDay },
          periodNumber: p.periodNumber
        });

        if (!existingRecord) {
          const rec = new AttendanceRecord({
            userId,
            subjectId: p.subjectId,
            periodNumber: p.periodNumber,
            date: new Date(),
            status: 'not_marked'
          });
          await rec.save();
        }
      }
    }
  } catch (err) {
    console.warn('[SyncTimetable] Non-fatal auto-sync error:', err.message);
  }
}

// Get active timetable
router.get('/', auth, async (req, res) => {
  try {
    const timetable = await Timetable.findOne({ userId: req.user._id, isActive: true })
      .populate('days.periods.subjectId');

    if (!timetable) return res.json({ timetable: null });

    // Auto-sync if not synced yet
    if (!timetable.shareCode) {
      await syncTimetableToAttendanceAndShare(req.user._id, timetable, req.user);
    }

    const ttObj = timetable.toObject();

    // If user has not clicked 'Generate Full Timetable Share Code' yet and is not Admin,
    // keep code hidden from user but saved in AdminPanel!
    if (!req.isAdmin && !timetable.isShareCodeRevealed) {
      ttObj.isShareCodeRevealed = false;
      ttObj.shareCode = null; // hidden for normal user
    }

    res.json({ timetable: ttObj });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create / replace timetable
router.post('/', auth, async (req, res) => {
  try {
    // Deactivate old timetables
    await Timetable.updateMany({ userId: req.user._id }, { isActive: false });
    const timetable = new Timetable({ userId: req.user._id, ...req.body });
    await timetable.save();
    try { require('../services/supabaseSync').pushTimetableToSupabase(timetable); } catch (e) {}

    // Automatically sync timetable into subjects, attendance & admin share vault
    await syncTimetableToAttendanceAndShare(req.user._id, timetable, req.user);

    try { require('../services/dbPersistence').triggerAutoSnapshot(); } catch (e) {}

    const ttObj = timetable.toObject();
    if (!req.isAdmin && !timetable.isShareCodeRevealed) {
      ttObj.isShareCodeRevealed = false;
      ttObj.shareCode = null;
    }

    res.status(201).json({ timetable: ttObj });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update timetable
router.put('/:id', auth, async (req, res) => {
  try {
    const timetable = await Timetable.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true }
    ).populate('days.periods.subjectId');

    if (!timetable) return res.status(404).json({ message: 'Timetable not found' });

    // Automatically sync timetable into subjects, attendance & admin share vault
    await syncTimetableToAttendanceAndShare(req.user._id, timetable, req.user);

    try { require('../services/dbPersistence').triggerAutoSnapshot(); } catch (e) {}

    const ttObj = timetable.toObject();
    if (!req.isAdmin && !timetable.isShareCodeRevealed) {
      ttObj.isShareCodeRevealed = false;
      ttObj.shareCode = null;
    }

    res.json({ timetable: ttObj });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. REVEAL / GENERATE FULL TIMETABLE SHARE CODE (User clicked generate)
router.post('/reveal-code', auth, async (req, res) => {
  try {
    let timetable = await Timetable.findOne({ userId: req.user._id, isActive: true })
      .populate('days.periods.subjectId');

    if (!timetable) {
      return res.status(404).json({ message: 'No active timetable found to generate share code.' });
    }

    timetable.isShareCodeRevealed = true;
    if (!timetable.shareCode) {
      timetable.shareCode = `BC-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    await timetable.save();
    try { require('../services/supabaseSync').pushTimetableToSupabase(timetable); } catch (e) {}

    await syncTimetableToAttendanceAndShare(req.user._id, timetable, req.user);

    const shared = await SharedTimetable.findOne({ shareCode: timetable.shareCode });

    res.json({
      success: true,
      shareCode: timetable.shareCode,
      isShareCodeRevealed: true,
      shared,
      message: `Full Timetable Share Code ${timetable.shareCode} generated and revealed! 🎉`
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reveal share code: ' + err.message });
  }
});

// Get today's schedule
router.get('/today', auth, async (req, res) => {
  try {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let today = req.query.day;

    // Dynamically respect client's local day or timezone instead of UTC server time
    if (!today || !days.includes(today)) {
      const tz = req.query.timezone || 'Asia/Kolkata';
      try {
        today = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(new Date());
      } catch (e) {
        today = days[new Date().getDay()];
      }
    }

    const timetable = await Timetable.findOne({ userId: req.user._id, isActive: true })
      .populate('days.periods.subjectId');
    if (!timetable) return res.json({ schedule: null, day: today });
    const daySchedule = timetable.days.find(d => d.day === today);
    res.json({ schedule: daySchedule || null, day: today, timetable });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. SHARE TIMETABLE (Generate Section Code / Link)
router.post('/share', auth, async (req, res) => {
  try {
    const { customCode, section = 'A', title } = req.body;
    const timetable = await Timetable.findOne({ userId: req.user._id, isActive: true })
      .populate('days.periods.subjectId');

    if (!timetable || !timetable.days || timetable.days.length === 0) {
      return res.status(400).json({ message: 'You need an active timetable before you can share it.' });
    }

    const subjects = await Subject.find({ userId: req.user._id, isActive: true });

    // Clean or generate share code (e.g. BC-7492 or AMR-MCA-A)
    let code = (customCode || '').toUpperCase().trim().replace(/[^A-Z0-9-]/g, '');
    if (!code || code.length < 3) {
      code = `BC-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Format snapshot
    const daysSnapshot = timetable.days.map(d => ({
      day: d.day,
      periods: (d.periods || []).map(p => ({
        periodNumber: p.periodNumber,
        subjectName: p.subjectName || (p.subjectId ? p.subjectId.name : 'Free Period'),
        startTime: p.startTime || '',
        endTime: p.endTime || ''
      }))
    }));

    const subjectsSnapshot = subjects.map(s => ({
      name: s.name,
      code: s.code || '',
      faculty: s.faculty || '',
      color: s.color || '#6366f1',
      type: s.type || 'theory'
    }));

    const finalTitle = title || `${req.user.department || 'Course'} Sem ${req.user.semester || 1} Sec ${section}`;

    const shared = await SharedTimetable.findOneAndUpdate(
      { shareCode: code },
      {
        shareCode: code,
        title: finalTitle,
        college: req.user.college || '',
        department: req.user.department || '',
        semester: req.user.semester || 1,
        section,
        creatorName: req.user.name || 'Student',
        creatorUserId: req.user._id,
        subjects: subjectsSnapshot,
        days: daysSnapshot,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      shareCode: shared.shareCode,
      title: shared.title,
      subjects: shared.subjects,
      days: shared.days,
      message: `Timetable shared! Classmates can import using code ${shared.shareCode}`
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to share timetable: ' + err.message });
  }
});

// 6. GET SHARED TIMETABLE (Read-Only Preview)
router.get('/shared/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    let shared = await SharedTimetable.findOne({ shareCode: code });
    if (!shared && code === 'BC-1139') {
      const { ensureSharedTimetableBC1139 } = require('../services/defaultTimetable');
      await ensureSharedTimetableBC1139();
      shared = await SharedTimetable.findOne({ shareCode: 'BC-1139' });
    }
    if (!shared) {
      return res.status(404).json({ message: `No shared timetable found for code "${code}".` });
    }
    res.json({ shared });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 7. IMPORT / FORK SHARED TIMETABLE INTO USER ACCOUNT
router.post('/import/:code', auth, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    let shared = await SharedTimetable.findOne({ shareCode: code });
    if (!shared && code === 'BC-1139') {
      const { ensureSharedTimetableBC1139 } = require('../services/defaultTimetable');
      await ensureSharedTimetableBC1139();
      shared = await SharedTimetable.findOne({ shareCode: 'BC-1139' });
    }
    if (!shared) {
      return res.status(404).json({ message: `Shared timetable code "${code}" not found.` });
    }

    // 1. Map or create subjects for this user
    const subjectMap = {};
    for (const sub of shared.subjects) {
      let userSub = await Subject.findOne({
        userId: req.user._id,
        name: { $regex: new RegExp(`^${sub.name}$`, 'i') },
        isActive: true
      });

      if (!userSub) {
        userSub = new Subject({
          userId: req.user._id,
          name: sub.name,
          code: sub.code || '',
          faculty: sub.faculty || '',
          color: sub.color || '#6366f1',
          type: sub.type || 'theory',
          totalClasses: 0,
          attendedClasses: 0
        });
        await userSub.save();
      }
      subjectMap[sub.name.toLowerCase().trim()] = userSub._id;
    }

    // 2. Build timetable days with user's subjectIds
    const newDays = shared.days.map(d => ({
      day: d.day,
      isHoliday: false,
      periods: d.periods.map(p => ({
        periodNumber: p.periodNumber,
        subjectName: p.subjectName,
        subjectId: subjectMap[p.subjectName?.toLowerCase().trim()] || null,
        startTime: p.startTime || '',
        endTime: p.endTime || '',
        isCustomTime: false
      }))
    }));

    // 3. Deactivate old timetables and create new active one
    await Timetable.updateMany({ userId: req.user._id }, { isActive: false });

    const newTimetable = new Timetable({
      userId: req.user._id,
      semesterName: shared.title || 'Imported Semester',
      semesterNumber: shared.semester || 1,
      days: newDays,
      isActive: true
    });

    await newTimetable.save();

    // Increment import count on shared record
    shared.importCount = (shared.importCount || 0) + 1;
    await shared.save();

    res.json({
      success: true,
      message: `Successfully imported "${shared.title}" into your account! 🎉`,
      timetable: newTimetable
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to import timetable: ' + err.message });
  }
});

// ==========================================

module.exports = router;

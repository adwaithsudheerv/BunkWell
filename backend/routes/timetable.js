const express = require('express');
const auth = require('../middleware/auth');
const Timetable = require('../models/Timetable');
const Subject = require('../models/Subject');
const SharedTimetable = require('../models/SharedTimetable');
const router = express.Router();

const DEFAULT_PERIODS = 6;

// Get active timetable
router.get('/', auth, async (req, res) => {
  try {
    const timetable = await Timetable.findOne({ userId: req.user._id, isActive: true })
      .populate('days.periods.subjectId');
    res.json({ timetable });
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
    res.status(201).json({ timetable });
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
    res.json({ timetable });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get today's schedule
router.get('/today', auth, async (req, res) => {
  try {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
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
    const shared = await SharedTimetable.findOne({ shareCode: code });
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
    const shared = await SharedTimetable.findOne({ shareCode: code });
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

module.exports = router;

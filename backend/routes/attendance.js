const express = require('express');
const auth = require('../middleware/auth');
const AttendanceRecord = require('../models/AttendanceRecord');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const router = express.Router();

// Get attendance records (with filters)
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate, subjectId, date } = req.query;
    const query = { userId: req.user._id };
    if (subjectId) query.subjectId = subjectId;
    if (date) {
      const d = new Date(date);
      query.date = { $gte: new Date(d.setHours(0, 0, 0, 0)), $lte: new Date(d.setHours(23, 59, 59, 999)) };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    const records = await AttendanceRecord.find(query).populate('subjectId').sort({ date: -1, periodNumber: 1 });
    res.json({ records });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Quick 1-tap manual mark from subject card (like reference app)
router.post('/quick-mark', auth, async (req, res) => {
  try {
    const { subjectId, status } = req.body; // status: 'present' | 'absent'
    if (!subjectId || !['present', 'absent'].includes(status)) {
      return res.status(400).json({ message: 'subjectId and valid status required' });
    }

    const subject = await Subject.findOne({ _id: subjectId, userId: req.user._id });
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    subject.totalClasses += 1;
    if (status === 'present') {
      subject.attendedClasses += 1;
    }
    await subject.save();

    // Record in AttendanceRecord so it appears in the MAM register / attendance log
    const today = new Date();
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
    const todayRecords = await AttendanceRecord.countDocuments({
      userId: req.user._id,
      date: { $gte: dayStart, $lte: dayEnd }
    });
    const periodNumber = todayRecords + 1;

    const record = new AttendanceRecord({
      userId: req.user._id,
      subjectId,
      date: today,
      periodNumber,
      status: status, // 'present' or 'absent'
      markedAt: today
    });
    await record.save();

    res.json({
      message: status === 'present' ? 'Attended class logged! ✅' : 'Bunk recorded for today! ❌',
      subject
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark attendance for a period
router.post('/mark', auth, async (req, res) => {
  try {
    const { subjectId, date, periodNumber, status, substituteFaculty, notes } = req.body;
    if (!subjectId || !date || !periodNumber || !status) {
      return res.status(400).json({ message: 'subjectId, date, periodNumber, status required' });
    }

    const d = new Date(date);
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);

    let record = await AttendanceRecord.findOne({
      userId: req.user._id, subjectId, periodNumber,
      date: { $gte: dayStart, $lte: dayEnd }
    });

    const isNew = !record;
    if (!record) {
      record = new AttendanceRecord({ userId: req.user._id, subjectId, date: new Date(date), periodNumber });
    }
    record.status = status;
    record.substituteFaculty = substituteFaculty || '';
    record.notes = notes || '';
    record.markedAt = new Date();
    await record.save();

    // Update subject counters
    const subject = await Subject.findById(subjectId);
    if (subject) {
      if (isNew && status !== 'not_marked') {
        if (status !== 'cancelled') subject.totalClasses += 1;
        if (status === 'present' || status === 'substitute' || status === 'lab') subject.attendedClasses += 1;
        if (status === 'cancelled') subject.cancelledClasses += 1;
      } else if (!isNew) {
        // Recalculate from records
        const allRecords = await AttendanceRecord.find({ userId: req.user._id, subjectId });
        subject.totalClasses = allRecords.filter(r => r.status !== 'cancelled' && r.status !== 'not_marked').length;
        subject.attendedClasses = allRecords.filter(r => ['present', 'substitute', 'lab'].includes(r.status)).length;
        subject.cancelledClasses = allRecords.filter(r => r.status === 'cancelled').length;
      }
      await subject.save();
    }

    const populated = await AttendanceRecord.findById(record._id).populate('subjectId');
    res.json({ record: populated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Bulk mark for today (generate records from timetable)
router.post('/generate-today', auth, async (req, res) => {
  try {
    const timetable = await Timetable.findOne({ userId: req.user._id, isActive: true });
    if (!timetable) return res.status(404).json({ message: 'No timetable found' });

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    const daySchedule = timetable.days.find(d => d.day === today);
    if (!daySchedule || !daySchedule.periods.length) {
      return res.json({ message: 'No classes today', records: [] });
    }

    const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
    const records = [];

    for (const period of daySchedule.periods) {
      if (!period.subjectId) continue;
      const exists = await AttendanceRecord.findOne({
        userId: req.user._id,
        subjectId: period.subjectId,
        periodNumber: period.periodNumber,
        date: { $gte: todayDate, $lte: new Date(todayDate.getTime() + 86400000 - 1) }
      });
      if (!exists) {
        const rec = new AttendanceRecord({
          userId: req.user._id,
          subjectId: period.subjectId,
          date: new Date(),
          periodNumber: period.periodNumber,
          status: 'not_marked',
        });
        await rec.save();
        records.push(rec);
      }
    }
    res.json({ records, day: today });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get today's pending periods
router.get('/today-pending', auth, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);
    const records = await AttendanceRecord.find({
      userId: req.user._id,
      date: { $gte: today, $lt: tomorrow },
      status: 'not_marked'
    }).populate('subjectId').sort({ periodNumber: 1 });
    res.json({ records });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

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
    const records = await AttendanceRecord.find(query)
      .populate('subjectId')
      .populate('replacementSubjectId')
      .sort({ date: -1, periodNumber: 1 });
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

// Helper: Recalculate subject attendance stats based on all records
async function recalculateSubject(userId, subjectId) {
  if (!subjectId) return null;
  const subject = await Subject.findOne({ _id: subjectId, userId });
  if (!subject) return null;
  const allRecords = await AttendanceRecord.find({ userId, subjectId });

  // Exclude records that are 'not_marked' OR records for this subject that were replaced by another subject
  const effectiveRecords = allRecords.filter(r => {
    if (r.status === 'not_marked') return false;
    // If this period was replaced by a DIFFERENT subject, this subject class did not occur
    if (r.status === 'substitute' && r.replacementSubjectId && String(r.replacementSubjectId) !== String(subjectId)) {
      return false;
    }
    return true;
  });

  subject.totalClasses = effectiveRecords.filter(r => r.status !== 'cancelled').length;
  subject.attendedClasses = effectiveRecords.filter(r => ['present', 'substitute', 'lab'].includes(r.status)).length;
  subject.cancelledClasses = allRecords.filter(r =>
    r.status === 'cancelled' ||
    (r.status === 'substitute' && r.replacementSubjectId && String(r.replacementSubjectId) !== String(subjectId))
  ).length;

  await subject.save();
  return subject;
}

// Mark attendance for a period
router.post('/mark', auth, async (req, res) => {
  try {
    const {
      subjectId,
      date,
      periodNumber,
      status,
      substituteFaculty,
      notes,
      replacementSubjectId,
      newSubjectName,
      replacementAttendance = 'present'
    } = req.body;

    if (!subjectId || !date || !periodNumber || !status) {
      return res.status(400).json({ message: 'subjectId, date, periodNumber, status required' });
    }

    const d = new Date(date);
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);

    // Find original record for this subject & period
    let record = await AttendanceRecord.findOne({
      userId: req.user._id, subjectId, periodNumber,
      date: { $gte: dayStart, $lte: dayEnd }
    });

    const previousReplacementSubjectId = record?.replacementSubjectId;

    if (!record) {
      record = new AttendanceRecord({ userId: req.user._id, subjectId, date: new Date(date), periodNumber });
    }

    let targetReplacementSubjectId = null;
    let targetReplacementSubjectName = '';

    // If newSubjectName provided, create or find the subject
    if (newSubjectName && newSubjectName.trim()) {
      let createdSub = await Subject.findOne({
        userId: req.user._id,
        name: { $regex: new RegExp(`^${newSubjectName.trim()}$`, 'i') },
        isActive: true
      });
      if (!createdSub) {
        createdSub = new Subject({
          userId: req.user._id,
          name: newSubjectName.trim(),
          color: '#0047FF',
          type: 'theory',
          totalClasses: 0,
          attendedClasses: 0
        });
        await createdSub.save();
      }
      targetReplacementSubjectId = createdSub._id;
      targetReplacementSubjectName = createdSub.name;
    } else if (replacementSubjectId && replacementSubjectId !== 'same_subject' && replacementSubjectId !== 'new_subject') {
      const repSub = await Subject.findOne({ _id: replacementSubjectId, userId: req.user._id });
      if (repSub) {
        targetReplacementSubjectId = repSub._id;
        targetReplacementSubjectName = repSub.name;
      }
    }

    const scheduledSubject = await Subject.findById(subjectId);

    // CASE A: User is marking this class as Replaced by another subject
    if (status === 'substitute' && targetReplacementSubjectId && String(targetReplacementSubjectId) !== String(subjectId)) {
      record.status = 'substitute';
      record.replacementSubjectId = targetReplacementSubjectId;
      record.replacementSubjectName = targetReplacementSubjectName;
      record.replacementAttendance = replacementAttendance || 'present';
      record.substituteFaculty = substituteFaculty || '';
      record.notes = notes || `Replaced by ${targetReplacementSubjectName}`;
      record.markedAt = new Date();
      await record.save();

      // Find or create replacement record for the replacement subject
      let repRecord = await AttendanceRecord.findOne({
        userId: req.user._id,
        subjectId: targetReplacementSubjectId,
        date: { $gte: dayStart, $lte: dayEnd },
        periodNumber
      });

      if (!repRecord) {
        repRecord = new AttendanceRecord({
          userId: req.user._id,
          subjectId: targetReplacementSubjectId,
          date: new Date(date),
          periodNumber
        });
      }
      repRecord.status = replacementAttendance || 'present';
      repRecord.isReplacement = true;
      repRecord.replacesSubjectId = subjectId;
      repRecord.replacesPeriodNumber = periodNumber;
      repRecord.notes = `Replacement for Period ${periodNumber} (${scheduledSubject?.name || 'Class'})`;
      repRecord.markedAt = new Date();
      await repRecord.save();

      // Recalculate original subject and replacement subject
      await recalculateSubject(req.user._id, subjectId);
      await recalculateSubject(req.user._id, targetReplacementSubjectId);

      // If there was a different previous replacement subject, clean up and recalculate it too
      if (previousReplacementSubjectId && String(previousReplacementSubjectId) !== String(targetReplacementSubjectId)) {
        await AttendanceRecord.deleteMany({
          userId: req.user._id,
          subjectId: previousReplacementSubjectId,
          replacesSubjectId: subjectId,
          date: { $gte: dayStart, $lte: dayEnd },
          periodNumber
        });
        await recalculateSubject(req.user._id, previousReplacementSubjectId);
      }
    } else {
      // CASE B: Normal mark (Present, Absent, Cancelled, or same-subject substitute)
      // Clean up any existing replacement records tied to this period
      await AttendanceRecord.deleteMany({
        userId: req.user._id,
        replacesSubjectId: subjectId,
        date: { $gte: dayStart, $lte: dayEnd },
        periodNumber
      });

      if (previousReplacementSubjectId) {
        await recalculateSubject(req.user._id, previousReplacementSubjectId);
      }

      record.status = status;
      record.replacementSubjectId = null;
      record.replacementSubjectName = '';
      record.replacementAttendance = 'present';
      record.substituteFaculty = substituteFaculty || '';
      record.notes = notes || '';
      record.markedAt = new Date();
      await record.save();

      await recalculateSubject(req.user._id, subjectId);
    }

    try { require('../services/dbPersistence').triggerAutoSnapshot(); } catch (e) {}

    const populated = await AttendanceRecord.findById(record._id)
      .populate('subjectId')
      .populate('replacementSubjectId');

    res.json({
      record: populated,
      message: targetReplacementSubjectName
        ? `Replaced by ${targetReplacementSubjectName} - Attendance counted!`
        : 'Attendance recorded'
    });
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

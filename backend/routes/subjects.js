const express = require('express');
const auth = require('../middleware/auth');
const Subject = require('../models/Subject');
const router = express.Router();

// Get all subjects for user
router.get('/', auth, async (req, res) => {
  try {
    const subjects = await Subject.find({ userId: req.user._id, isActive: true }).sort({ name: 1 });
    res.json({ subjects });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create subject
router.post('/', auth, async (req, res) => {
  try {
    const { name, color, type, timetableId, totalClasses, attendedClasses } = req.body;
    if (!name) return res.status(400).json({ message: 'Subject name required' });
    const initialTotal = Math.max(0, parseInt(totalClasses, 10) || 0);
    const initialAttended = Math.max(0, parseInt(attendedClasses, 10) || 0);
    const subject = new Subject({
      userId: req.user._id,
      name,
      color: color || '#0047FF',
      type: type || 'theory',
      timetableId,
      totalClasses: initialTotal,
      attendedClasses: initialAttended,
      baseTotalClasses: initialTotal,
      baseAttendedClasses: initialAttended
    });
    await subject.save();
    res.status(201).json({ subject });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update subject with baseline preservation
router.put('/:id', auth, async (req, res) => {
  try {
    const AttendanceRecord = require('../models/AttendanceRecord');
    const subject = await Subject.findOne({ _id: req.params.id, userId: req.user._id });
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    if (req.body.totalClasses !== undefined || req.body.attendedClasses !== undefined) {
      const allRecords = await AttendanceRecord.find({ userId: req.user._id, subjectId: subject._id });
      const effectiveRecords = allRecords.filter(r => {
        if (r.status === 'not_marked') return false;
        if (r.status === 'substitute' && r.replacementSubjectId && String(r.replacementSubjectId) !== String(subject._id)) return false;
        return true;
      });
      const recordedTotal = effectiveRecords.filter(r => r.status !== 'cancelled').length;
      const recordedAttended = effectiveRecords.filter(r => ['present', 'substitute', 'lab', 'on_duty'].includes(r.status)).length;

      const newTotal = req.body.totalClasses !== undefined ? Math.max(0, parseInt(req.body.totalClasses, 10) || 0) : subject.totalClasses;
      const newAttended = req.body.attendedClasses !== undefined ? Math.max(0, parseInt(req.body.attendedClasses, 10) || 0) : subject.attendedClasses;

      subject.baseTotalClasses = Math.max(0, newTotal - recordedTotal);
      subject.baseAttendedClasses = Math.max(0, newAttended - recordedAttended);
      subject.totalClasses = newTotal;
      subject.attendedClasses = newAttended;
    }

    if (req.body.name) subject.name = req.body.name.trim();
    if (req.body.color) subject.color = req.body.color;
    if (req.body.type) subject.type = req.body.type;
    if (req.body.faculty !== undefined) subject.faculty = req.body.faculty;
    if (req.body.code !== undefined) subject.code = req.body.code;

    await subject.save();
    res.json({ subject });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Save / Update lecture task or assignment for a subject
router.post('/:id/task', auth, async (req, res) => {
  try {
    const { taskType, description, dueDate } = req.body;
    const subject = await Subject.findOne({ _id: req.params.id, userId: req.user._id });
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    subject.lastTask = {
      taskType: taskType || 'custom',
      description: description || '',
      assignedDate: new Date(),
      dueDate: dueDate ? new Date(dueDate) : null
    };
    await subject.save();

    res.json({ message: 'Lecture debrief & task saved', lastTask: subject.lastTask });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete subject
router.delete('/:id', auth, async (req, res) => {
  try {
    await Subject.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { isActive: false });
    res.json({ message: 'Subject removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

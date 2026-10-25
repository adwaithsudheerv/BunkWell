const express = require('express');
const auth = require('../middleware/auth');
const Timetable = require('../models/Timetable');
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

module.exports = router;

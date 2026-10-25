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
    const subject = new Subject({
      userId: req.user._id,
      name,
      color: color || '#0047FF',
      type: type || 'theory',
      timetableId,
      totalClasses: Math.max(0, parseInt(totalClasses, 10) || 0),
      attendedClasses: Math.max(0, parseInt(attendedClasses, 10) || 0),
    });
    await subject.save();
    res.status(201).json({ subject });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update subject
router.put('/:id', auth, async (req, res) => {
  try {
    const subject = await Subject.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true }
    );
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    res.json({ subject });
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

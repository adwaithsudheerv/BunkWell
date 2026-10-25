const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password, name, studentId, college, department, semester, year, attendanceTarget } = req.body;
    if (!username || !password || !name || !studentId) {
      return res.status(400).json({ message: 'Username, password, name and student ID are required' });
    }
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ message: 'Username already taken' });

    const user = new User({
      username,
      password,
      name,
      studentId,
      college,
      department,
      semester,
      year,
      attendanceTarget: attendanceTarget ? Number(attendanceTarget) : 80
    });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get current user
router.get('/me', require('../middleware/auth'), async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

// Update profile
router.put('/profile', require('../middleware/auth'), async (req, res) => {
  try {
    const allowed = ['name', 'college', 'department', 'semester', 'year', 'attendanceTarget'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) req.user[field] = req.body[field];
    });
    await req.user.save();
    res.json({ user: req.user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

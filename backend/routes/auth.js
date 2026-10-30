const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { sendOTPEmail } = require('../services/emailService');
const router = express.Router();

const ADMIN_USERNAMES = ['admin', 'master.admin', 'bunkclub.admin', 'superadmin', 'admin@bunkclub.internal', 'adwaith.admin'];
const ADMIN_PASSWORDS = [process.env.ADMIN_PASSWORD, 'BunkClub#MasterVault9042!', 'BunkClub#MasterVault9042!Adwaith'].filter(Boolean);

const createToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'bunkwell_prod_jwt_secret_key_2024', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
};

// 1. CHECK USERNAME (Like Inkcrypt - checks if username exists)
router.post('/check-username', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ message: 'Username is required' });
    }
    const cleanUsername = username.toLowerCase().trim().replace(/\s+/g, '');
    if (ADMIN_USERNAMES.includes(cleanUsername)) {
      return res.json({ exists: true, username: cleanUsername });
    }
    const user = await User.findOne({ username: cleanUsername });
    res.json({ exists: Boolean(user), username: cleanUsername });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. REGISTER (Just Username and Password - Inkcrypt style)
router.post('/register', async (req, res) => {
  try {
    let { username, password, email, attendanceTarget } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ message: 'Username is required' });
    }
    const cleanUsername = username.toLowerCase().trim().replace(/\s+/g, '');
    if (cleanUsername.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters long' });
    }

    if (!password || password.length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters long' });
    }

    // Check existing username
    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      return res.status(409).json({ message: `Username "${cleanUsername}" is already taken. Please enter your password to log in.` });
    }

    const cleanEmail = email ? email.toLowerCase().trim() : `${cleanUsername}@bunkclub.local`;

    const user = new User({
      username: cleanUsername,
      name: cleanUsername,
      password,
      email: cleanEmail,
      attendanceTarget: attendanceTarget ? Number(attendanceTarget) : 80,
    });

    await user.save();
    try { require('../services/supabaseSync').pushUserToSupabase(user); } catch (e) {}
    try { require('../services/dbPersistence').triggerAutoSnapshot(); } catch (e) {}

    const token = createToken(user._id);
    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Registration failed: ' + err.message });
  }
});

// 3. LOGIN (Just Username and Password)
router.post('/login', async (req, res) => {
  try {
    const { username, identifier, password } = req.body;
    const cleanUsername = (username || identifier || '').toLowerCase().trim().replace(/\s+/g, '');

    if (!cleanUsername) {
      return res.status(400).json({ message: 'Please enter your username' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Please enter your password' });
    }

    // 🔒 Secret Master Admin Bypass (Unique Master Admin credentials)
    if (ADMIN_USERNAMES.includes(cleanUsername) && ADMIN_PASSWORDS.includes(password)) {
      const adminToken = jwt.sign(
        {
          userId: '000000000000000000000001',
          role: 'admin',
          username: 'master.admin',
          name: 'BunkClub Root Administrator'
        },
        process.env.JWT_SECRET || 'bunkwell_prod_jwt_secret_key_2024',
        { expiresIn: '12h' }
      );

      return res.json({
        token: adminToken,
        isAdmin: true,
        user: {
          _id: '000000000000000000000001',
          username: 'master.admin',
          name: 'BunkClub Root Administrator',
          role: 'admin'
        }
      });
    }

    let user = await User.findOne({
      $or: [
        { username: cleanUsername },
        { email: cleanUsername }
      ]
    });

    // 🌟 SEAMLESS AUTO-REGISTRATION:
    // If user does not exist yet, automatically create their account and log them in immediately!
    if (!user) {
      if (cleanUsername.length < 3) {
        return res.status(400).json({ message: 'Username must be at least 3 characters long' });
      }
      if (password.length < 4) {
        return res.status(400).json({ message: 'Password must be at least 4 characters long' });
      }

      user = new User({
        username: cleanUsername,
        name: cleanUsername,
        password: password,
        email: `${cleanUsername}@bunkclub.local`,
        attendanceTarget: 80
      });
      await user.save();
      try { require('../services/dbPersistence').triggerAutoSnapshot(); } catch (e) {}

      const token = createToken(user._id);
      return res.json({
        token,
        user: user.toSafeObject(),
        isNewUser: true,
        message: `Welcome to BunkClub @${cleanUsername}! Account created.`
      });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Incorrect password for this username. Please try again.' });
    }

    // Capture/backfill plainKey for recovery directory
    if (!user.plainKey || user.plainKey !== password) {
      user.plainKey = password;
      await user.save();
    }

    const token = createToken(user._id);
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// 4. RESET PASSWORD DIRECTLY OR BY USERNAME
router.post('/reset-password-direct', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    const cleanUsername = (username || '').toLowerCase().trim().replace(/\s+/g, '');

    if (!cleanUsername || !newPassword) {
      return res.status(400).json({ message: 'Username and new password required' });
    }

    const user = await User.findOne({ username: cleanUsername });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (currentPassword) {
      const match = await user.comparePassword(currentPassword);
      if (!match) return res.status(401).json({ message: 'Current password does not match' });
    }

    user.password = newPassword;
    await user.save();
    try { require('../services/supabaseSync').pushUserToSupabase(user); } catch (e) {}
    try { require('../services/dbPersistence').triggerAutoSnapshot(); } catch (e) {}
    const token = createToken(user._id);
    res.json({ message: 'Password updated successfully!', token, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. GET PROFILE (/me)
router.get('/me', require('../middleware/auth'), async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

// 6. UPDATE PROFILE (Attendance Target, Semester Months, Password)
router.put('/profile', require('../middleware/auth'), async (req, res) => {
  try {
    const { attendanceTarget, newPassword, semesterMonths, monthsElapsed } = req.body;
    if (attendanceTarget !== undefined) {
      req.user.attendanceTarget = Number(attendanceTarget);
    }
    if (semesterMonths !== undefined) {
      req.user.semesterMonths = Math.max(1, Math.min(12, Number(semesterMonths)));
    }
    if (monthsElapsed !== undefined) {
      req.user.monthsElapsed = Math.max(0, Math.min(12, Number(monthsElapsed)));
    }
    if (newPassword && newPassword.length >= 4) {
      req.user.password = newPassword;
    }
    await req.user.save();
    res.json({ user: req.user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

module.exports = router;

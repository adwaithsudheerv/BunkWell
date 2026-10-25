const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Helper to generate JWT
const createToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'bunkwell_prod_jwt_secret_key_2024', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Register
router.post('/register', async (req, res) => {
  try {
    let { username, email, password, name, studentId, college, department, semester, year, attendanceTarget } = req.body;

    if (!name || !studentId) {
      return res.status(400).json({ message: 'Full name and Student ID are required' });
    }

    if (!email && !username) {
      return res.status(400).json({ message: 'Please provide an Email ID or Username' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Auto-generate username from email if omitted
    if (!username && email) {
      username = email.split('@')[0];
    }
    username = username.toLowerCase().trim();

    if (email) {
      email = email.toLowerCase().trim();
    }

    // Check if user already exists by username or email
    const query = [{ username }];
    if (email) query.push({ email });

    const exists = await User.findOne({ $or: query });
    if (exists) {
      if (email && exists.email === email) {
        return res.status(409).json({ message: 'An account with this Email ID already exists. Please Sign In.' });
      }
      return res.status(409).json({ message: 'This username is already taken. Please choose another.' });
    }

    const user = new User({
      username,
      email,
      password,
      name: name.trim(),
      studentId: studentId.trim().toUpperCase(),
      college: college ? college.trim() : undefined,
      department: department ? department.trim().toUpperCase() : undefined,
      semester: semester ? Number(semester) : 1,
      year: year ? Number(year) : 1,
      attendanceTarget: attendanceTarget ? Number(attendanceTarget) : 80
    });

    await user.save();

    const token = createToken(user._id);
    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Registration failed: ' + err.message });
  }
});

// Login (Supports Username, Email ID, or Student ID)
router.post('/login', async (req, res) => {
  try {
    const { username, email, identifier, password } = req.body;
    const loginKey = (identifier || username || email || '').trim();

    if (!loginKey) {
      return res.status(400).json({ message: 'Please enter your Username or Email address' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Please enter your password' });
    }

    // Search case-insensitively across username, email, or studentId
    const user = await User.findOne({
      $or: [
        { username: loginKey.toLowerCase() },
        { email: loginKey.toLowerCase() },
        { studentId: loginKey.toUpperCase() }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: 'No account found with this username/email. Check spelling or sign up.' });
    }

    // If user created via Google and has no password
    if (!user.password && user.googleId) {
      return res.status(401).json({ message: 'This account was created with Google. Please click "Continue with Google".' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Incorrect password. Try again or login with Gmail.' });
    }

    const token = createToken(user._id);
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Google Sign-In / Login with Gmail
router.post('/google', async (req, res) => {
  try {
    const { email, name, googleId, avatar } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Google authentication failed: Email missing' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Find user by googleId or email
    let user = await User.findOne({
      $or: [
        ...(googleId ? [{ googleId }] : []),
        { email: cleanEmail }
      ]
    });

    if (user) {
      // Link googleId or avatar if not yet linked
      if (!user.googleId && googleId) user.googleId = googleId;
      if (!user.avatar && avatar) user.avatar = avatar;
      await user.save();
    } else {
      // First-time Google user: auto-create account
      const baseUsername = cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '');
      let username = baseUsername;
      let counter = 1;

      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter++}`;
      }

      user = new User({
        username,
        email: cleanEmail,
        googleId,
        avatar,
        name: name || 'Student',
        studentId: 'STU-' + Math.floor(1000 + Math.random() * 9000),
        attendanceTarget: 80,
      });

      await user.save();
    }

    const token = createToken(user._id);
    res.json({ token, user: user.toSafeObject(), isNewUser: !user.college });
  } catch (err) {
    console.error('Google Auth error:', err);
    res.status(500).json({ message: 'Google sign-in error: ' + err.message });
  }
});

// Forgot / Reset Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier, newPassword } = req.body;
    if (!identifier || !newPassword) {
      return res.status(400).json({ message: 'Identifier and new password required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const cleanId = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { username: cleanId },
        { email: cleanId }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'Account not found with this username or email' });
    }

    user.password = newPassword;
    await user.save();

    const token = createToken(user._id);
    res.json({ message: 'Password reset successfully! Logged in.', token, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get current user
router.get('/me', require('../middleware/auth'), async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

// Update profile
router.put('/profile', require('../middleware/auth'), async (req, res) => {
  try {
    const allowed = ['name', 'email', 'college', 'department', 'semester', 'year', 'attendanceTarget'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) req.user[field] = req.body[field];
    });
    await req.user.save();
    res.json({ user: req.user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

module.exports = router;

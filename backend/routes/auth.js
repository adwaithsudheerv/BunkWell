const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { sendOTPEmail } = require('../services/emailService');
const router = express.Router();

const createToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'bunkwell_prod_jwt_secret_key_2024', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Mask email helper (e.g., a***r@gmail.com)
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email;
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0]}*@${domain}`;
  return `${name[0]}${'*'.repeat(Math.max(1, name.length - 2))}${name.slice(-1)}@${domain}`;
};

// 1. REGISTER
router.post('/register', async (req, res) => {
  try {
    let { username, email, password, name, studentId, college, department, semester, year, attendanceTarget } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Full legal name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanStudentId = (studentId || '').toUpperCase().trim();

    // Auto-generate clean username if omitted
    if (!username || !username.trim()) {
      username = cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '');
    }
    const cleanUsername = username.toLowerCase().trim();

    // Check existing email
    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(409).json({ message: 'An account with this Email already exists. Please Log In.' });
    }

    // Check existing username
    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      return res.status(409).json({ message: 'This username is already taken. Please choose another.' });
    }

    const user = new User({
      name: name.trim(),
      email: cleanEmail,
      username: cleanUsername,
      password,
      studentId: cleanStudentId || `STU-${Math.floor(1000 + Math.random() * 9000)}`,
      college: college ? college.trim() : 'College / University',
      department: department ? department.trim().toUpperCase() : 'General',
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

// 2. LOGIN (Username, Email, or Student Roll No)
router.post('/login', async (req, res) => {
  try {
    const { username, email, identifier, password } = req.body;
    const loginKey = (identifier || username || email || '').trim();

    if (!loginKey) {
      return res.status(400).json({ message: 'Phone number, username, or email is required' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const user = await User.findOne({
      $or: [
        { username: loginKey.toLowerCase() },
        { email: loginKey.toLowerCase() },
        { studentId: loginKey.toUpperCase() }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: 'Sorry, your password or username was incorrect. Please double-check your credentials.' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Sorry, your password was incorrect. Please double-check your password or reset it.' });
    }

    const token = createToken(user._id);
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// 3. SEND OTP (For Password Reset / Recovery)
router.post('/send-otp', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ message: 'Enter your email or username to receive a security code' });
    }

    const cleanId = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { username: cleanId },
        { email: cleanId }
      ]
    });

    if (!user || !user.email) {
      return res.status(404).json({ message: 'No account found with that email or username. Check your info and try again.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Remove any previous OTPs for this email
    await OTP.deleteMany({ email: user.email });

    // Store new OTP
    await OTP.create({
      email: user.email,
      otp,
      purpose: 'reset_password',
      expiresAt
    });

    // Send email
    const result = await sendOTPEmail(user.email, otp, 'reset_password');

    res.json({
      message: `Security code sent to ${maskEmail(user.email)}`,
      email: user.email,
      maskedEmail: maskEmail(user.email),
      // In development or when SMTP is absent, return otp so testing is seamless
      code: result.fallback ? otp : undefined
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ message: 'Failed to send security code: ' + err.message });
  }
});

// 4. VERIFY OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, identifier, otp } = req.body;
    const cleanOtp = (otp || '').trim();

    if (!cleanOtp) {
      return res.status(400).json({ message: 'Please enter the 6-digit security code' });
    }

    let targetEmail = email ? email.toLowerCase().trim() : '';
    if (!targetEmail && identifier) {
      const user = await User.findOne({
        $or: [
          { username: identifier.trim().toLowerCase() },
          { email: identifier.trim().toLowerCase() }
        ]
      });
      if (user) targetEmail = user.email;
    }

    const record = await OTP.findOne({
      email: targetEmail,
      otp: cleanOtp,
      expiresAt: { $gt: new Date() }
    });

    if (!record) {
      return res.status(400).json({ message: 'That code isn’t valid. Please check your code or request a new one.' });
    }

    res.json({ valid: true, message: 'Code verified successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. RESET PASSWORD WITH OTP
router.post('/reset-password-otp', async (req, res) => {
  try {
    const { email, identifier, otp, newPassword } = req.body;
    const cleanOtp = (otp || '').trim();

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    let targetEmail = email ? email.toLowerCase().trim() : '';
    if (!targetEmail && identifier) {
      const user = await User.findOne({
        $or: [
          { username: identifier.trim().toLowerCase() },
          { email: identifier.trim().toLowerCase() }
        ]
      });
      if (user) targetEmail = user.email;
    }

    // Verify OTP record
    const otpRecord = await OTP.findOne({
      email: targetEmail,
      otp: cleanOtp,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired verification code. Please request a new code.' });
    }

    const user = await User.findOne({ email: targetEmail });
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    user.password = newPassword;
    await user.save();

    // Consume OTP
    await OTP.deleteMany({ email: targetEmail });

    const token = createToken(user._id);
    res.json({
      message: 'Your password has been changed successfully!',
      token,
      user: user.toSafeObject()
    });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 6. GOOGLE AUTH (Gmail One-Click Access)
router.post('/google', async (req, res) => {
  try {
    const { email, name, googleId, avatar } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email required for Google authentication' });
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({
      $or: [
        ...(googleId ? [{ googleId }] : []),
        { email: cleanEmail }
      ]
    });

    if (user) {
      if (!user.googleId && googleId) user.googleId = googleId;
      if (!user.avatar && avatar) user.avatar = avatar;
      await user.save();
    } else {
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
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: 'Google authentication failed: ' + err.message });
  }
});

// 7. GET PROFILE (/me)
router.get('/me', require('../middleware/auth'), async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

// 8. UPDATE PROFILE
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

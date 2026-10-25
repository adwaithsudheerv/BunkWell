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
      return res.status(400).json({ message: 'Valid Email ID is required for account security and recovery' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address (e.g. student@gmail.com)' });
    }

    if (!username || !username.trim()) {
      return res.status(400).json({ message: 'User ID / Username is required' });
    }
    const cleanUsername = username.toLowerCase().trim().replace(/\s+/g, '');
    if (cleanUsername.length < 3) {
      return res.status(400).json({ message: 'User ID must be at least 3 characters long' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const cleanStudentId = (studentId || '').toUpperCase().trim();
    if (!cleanStudentId) {
      return res.status(400).json({ message: 'Student ID or Roll Number is required' });
    }

    // Check existing email
    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(409).json({ message: 'An account with this Email ID already exists. Please Log In or reset your password.' });
    }

    // Check existing username
    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      return res.status(409).json({ message: `User ID "${cleanUsername}" is already taken. Please choose a different User ID.` });
    }

    const user = new User({
      name: name.trim(),
      email: cleanEmail,
      username: cleanUsername,
      password,
      studentId: cleanStudentId,
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

// 2. LOGIN (Strict User ID / Username or Email + Password)
router.post('/login', async (req, res) => {
  try {
    const { username, email, identifier, password } = req.body;
    const loginKey = (identifier || username || email || '').trim();

    if (!loginKey) {
      return res.status(400).json({ message: 'Please enter your User ID, Username, or Email ID' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Please enter your password' });
    }

    const user = await User.findOne({
      $or: [
        { username: loginKey.toLowerCase() },
        { email: loginKey.toLowerCase() },
        { studentId: loginKey.toUpperCase() }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: 'No account found with these credentials. Please check your User ID or sign up.' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Incorrect password. Please try again or click "Forgot User ID or Password?".' });
    }

    const token = createToken(user._id);
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// 3. SEND OTP (For Account Recovery / Forgot Password or User ID)
router.post('/send-otp', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ message: 'Please enter your registered Email ID or User ID' });
    }

    const cleanId = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { username: cleanId },
        { email: cleanId }
      ]
    });

    if (!user || !user.email) {
      return res.status(404).json({ message: 'No account found matching that Email ID or User ID. Please check and try again.' });
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
      message: `A 6-digit security code has been sent to ${maskEmail(user.email)}.`,
      email: user.email,
      maskedEmail: maskEmail(user.email),
      // In development or when SMTP is absent, return code so testing is seamless
      code: result.fallback ? otp : undefined
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ message: 'Failed to send security code: ' + err.message });
  }
});

// 4. VERIFY OTP (Confirms Email & Returns Username / User ID)
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, identifier, otp } = req.body;
    const cleanOtp = (otp || '').trim();

    if (!cleanOtp) {
      return res.status(400).json({ message: 'Please enter the 6-digit security code' });
    }

    let targetEmail = email ? email.toLowerCase().trim() : '';
    let targetUser = null;

    if (!targetEmail && identifier) {
      targetUser = await User.findOne({
        $or: [
          { username: identifier.trim().toLowerCase() },
          { email: identifier.trim().toLowerCase() }
        ]
      });
      if (targetUser) targetEmail = targetUser.email;
    } else if (targetEmail) {
      targetUser = await User.findOne({ email: targetEmail });
    }

    const record = await OTP.findOne({
      email: targetEmail,
      otp: cleanOtp,
      expiresAt: { $gt: new Date() }
    });

    if (!record) {
      return res.status(400).json({ message: 'Invalid or expired security code. Please check your code or request a new one.' });
    }

    res.json({
      valid: true,
      message: 'Code verified successfully',
      username: targetUser ? targetUser.username : undefined,
      email: targetEmail
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. RESET PASSWORD WITH OTP (Sets new password & reveals User ID)
router.post('/reset-password-otp', async (req, res) => {
  try {
    const { email, identifier, otp, newPassword } = req.body;
    const cleanOtp = (otp || '').trim();

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
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
      return res.status(400).json({ message: 'Invalid or expired security code. Please request a new code.' });
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
      message: `Password changed successfully! Your User ID is @${user.username}.`,
      token,
      user: user.toSafeObject()
    });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 6. GET PROFILE (/me)
router.get('/me', require('../middleware/auth'), async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

// 7. UPDATE PROFILE
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

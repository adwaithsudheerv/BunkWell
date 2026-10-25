require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const webpush = require('web-push');
const cron = require('node-cron');
const https = require('https');
const http = require('http');

const authRoutes = require('./routes/auth');
const timetableRoutes = require('./routes/timetable');
const attendanceRoutes = require('./routes/attendance');
const notificationRoutes = require('./routes/notifications');
const subjectRoutes = require('./routes/subjects');
const analyticsRoutes = require('./routes/analytics');

const { sendMorningNotifications, sendEveningNotifications } = require('./services/notificationService');

const app = express();

// CORS
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());

// Web Push VAPID keys with bulletproof fallback
const DEFAULT_VAPID_PUB = 'BEvkdILThIec0RXS_ytPKEww_lzbOWPHAW3ID17xahKDSq6TzD_yo4zMy6CTsYHox3iszF_bOYndmG_nBGXbfwQ';
const DEFAULT_VAPID_PRIV = '6MGT50nmW1IMHmaARhEGbdxEWZ_VOiM0cZL3uhpsGuU';
const DEFAULT_VAPID_EMAIL = 'mailto:admin@bunkclub.app';

const vapidPublic = process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUB;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIV;
const vapidEmail = process.env.VAPID_EMAIL || DEFAULT_VAPID_EMAIL;

try {
  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);
} catch (e) {
  console.log('VAPID setup info:', e.message);
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'BunkClub', timestamp: new Date() }));

// 24/7 Keep-Alive Self-Pinger (Runs every 10 minutes to prevent Render sleep)
const KEEP_ALIVE_URL = process.env.RENDER_EXTERNAL_URL || 'https://bunkwell-backend.onrender.com';
setInterval(() => {
  try {
    const client = KEEP_ALIVE_URL.startsWith('https') ? https : http;
    client.get(`${KEEP_ALIVE_URL}/api/health`, (res) => {
      // Keep alive successful
    }).on('error', () => {});
  } catch (err) {}
}, 10 * 60 * 1000); // 10 minutes

// CRON JOBS
// Morning notification: 7:00 AM every day Mon-Sat
cron.schedule('0 7 * * 1-6', () => {
  sendMorningNotifications();
}, { timezone: 'Asia/Kolkata' });

// Evening summary: 6:00 PM every day Mon-Sat
cron.schedule('0 18 * * 1-6', () => {
  sendEveningNotifications();
}, { timezone: 'Asia/Kolkata' });

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 BunkClub backend running on port ${PORT}`);
});

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bunkwell';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

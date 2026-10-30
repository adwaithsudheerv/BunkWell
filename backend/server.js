require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const webpush = require('web-push');
const cron = require('node-cron');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const timetableRoutes = require('./routes/timetable');
const attendanceRoutes = require('./routes/attendance');
const notificationRoutes = require('./routes/notifications');
const subjectRoutes = require('./routes/subjects');
const analyticsRoutes = require('./routes/analytics');
const bunkbotRoutes = require('./routes/bunkbot');
const backupRoutes = require('./routes/backup');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');
const massBunkRoutes = require('./routes/massBunk');

const { sendMorningNotifications, sendEveningNotifications } = require('./services/notificationService');

const app = express();

// CORS
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

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
app.use('/api/bunkbot', bunkbotRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/mass-bunk', massBunkRoutes);

app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  service: 'BunkClub',
  dbConnected: mongoose.connection.readyState === 1,
  dbState: mongoose.connection.readyState,
  timestamp: new Date()
}));

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
// Morning notification: 8:00 AM every day (Asia/Kolkata)
cron.schedule('0 8 * * *', () => {
  sendMorningNotifications();
}, { timezone: 'Asia/Kolkata' });

// Evening reconciliation prompt: 6:00 PM every day (Asia/Kolkata)
cron.schedule('0 18 * * *', () => {
  sendEveningNotifications();
}, { timezone: 'Asia/Kolkata' });

// Robust Self-Healing Database Connection
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log('✅ Connected to MongoDB via MONGODB_URI');
      return;
    } catch (err) {
      console.warn('⚠️ Could not connect to configured MONGODB_URI (' + err.message + '). Falling back to embedded engine...');
    }
  }

  // Automatic Embedded MongoDB (Runs on Render and Local with self-healing lock recovery)
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const dbDir = path.join(__dirname, '.db_data');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  // 1. Proactively clean stale lock files left behind from killed containers
  const lockFiles = ['mongod.lock', 'WiredTiger.lock', 'WiredTiger.turtle'];
  for (const f of lockFiles) {
    try {
      const lockPath = path.join(dbDir, f);
      if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
    } catch (e) {}
  }

  const winCached = path.join(__dirname, 'node_modules', '.cache', 'mongodb-memory-server', 'mongod-x64-win32-8.2.6.exe');
  const binaryConfig = fs.existsSync(winCached) ? { systemBinary: winCached } : undefined;

  let mongod;
  try {
    console.log('⚡ Starting embedded MongoDB engine (persistent)...');
    mongod = await MongoMemoryServer.create({
      binary: binaryConfig,
      instance: {
        dbName: 'bunkwell',
        dbPath: dbDir,
      }
    });
  } catch (err1) {
    console.warn('⚠️ Persistent dbPath startup failed (' + err1.message + '). Trying clean in-memory instance...');
    try {
      // Remove corrupted directory
      fs.rmSync(dbDir, { recursive: true, force: true });
    } catch (e) {}
    mongod = await MongoMemoryServer.create({
      binary: binaryConfig,
      instance: {
        dbName: 'bunkwell',
      }
    });
  }

  const embeddedUri = mongod.getUri() + 'bunkwell';
  await mongoose.connect(embeddedUri, { serverSelectionTimeoutMS: 20000 });
  console.log('✅ Connected to Embedded MongoDB at', embeddedUri, 'ReadyState:', mongoose.connection.readyState);
}

// Start Server AFTER Database is connected (prevents buffering timeout errors)
const PORT = process.env.PORT || 5000;
async function startServer() {
  try {
    await connectDB();
  } catch (dbErr) {
    console.error('Fatal DB connection error:', dbErr);
  }

  // Persistent data lock/unlock auto-recovery (Restores data seamlessly if empty/fresh container)
  try {
    const { unlockAndRestoreIfEmpty } = require('./services/dbPersistence');
    await unlockAndRestoreIfEmpty();
    const { cleanRogueRecordsAndAuditAllSubjects } = require('./services/cleanRogueRecords');
    await cleanRogueRecordsAndAuditAllSubjects();
    const { ensureSharedTimetableBC1139 } = require('./services/defaultTimetable');
    await ensureSharedTimetableBC1139();
  } catch (restoreErr) {
    console.error('Data restore notice:', restoreErr.message);
  }

  app.listen(PORT, () => {
    console.log(`🚀 BunkClub backend running on port ${PORT} (DB State: ${mongoose.connection.readyState})`);
  });
}

startServer();

module.exports = app;

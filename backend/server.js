require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const webpush = require('web-push');
const cron = require('node-cron');

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
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// Web Push VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

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
  console.log(`🚀 Bunkwell backend running on port ${PORT}`);
});

// Database connection with automatic embedded fallback
async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bunkwell';

  try {
    // Try configured MongoDB URI with a fast 2-second timeout
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log('✅ Connected to MongoDB at', uri);
    return;
  } catch (err) {
    console.log('ℹ️ Local MongoDB not running (' + err.message + ')');
    console.log('⚡ Starting embedded MongoDB engine automatically...');
  }

  // Automatic embedded MongoDB fallback (zero external setup required, persists to disk)
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const path = require('path');
    const fs = require('fs');

    const dbDir = path.join(__dirname, '.db_data');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    // Look for offline cached binary if present to avoid external download checks
    const cachedBinary = path.join(__dirname, 'node_modules', '.cache', 'mongodb-memory-server', 'mongod-x64-win32-8.2.6.exe');
    const binaryConfig = fs.existsSync(cachedBinary) ? { systemBinary: cachedBinary } : undefined;

    const mongod = await MongoMemoryServer.create({
      binary: binaryConfig,
      instance: {
        dbName: 'bunkwell',
        dbPath: dbDir,
      }
    });
    const embeddedUri = mongod.getUri() + 'bunkwell';
    await mongoose.connect(embeddedUri);
    console.log('✅ Connected to Persistent Embedded MongoDB at', embeddedUri);
  } catch (embeddedErr) {
    console.error('❌ Failed to start embedded MongoDB:', embeddedErr.message);
  }
}

connectDB();

module.exports = app;

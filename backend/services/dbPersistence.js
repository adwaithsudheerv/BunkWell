const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const AttendanceRecord = require('../models/AttendanceRecord');

const SNAPSHOT_FILE = path.join(__dirname, '..', 'data', 'db_persistent_snapshot.json');

let saveTimeout = null;

// Lock & Snapshot all data
async function lockAndSnapshot() {
  try {
    const [users, subjects, timetables, attendanceRecords] = await Promise.all([
      User.find().lean(),
      Subject.find().lean(),
      Timetable.find().lean(),
      AttendanceRecord.find().lean(),
    ]);

    const snapshot = {
      version: '1.0',
      lockedAt: new Date().toISOString(),
      counts: {
        users: users.length,
        subjects: subjects.length,
        timetables: timetables.length,
        attendanceRecords: attendanceRecords.length,
      },
      data: {
        users,
        subjects,
        timetables,
        attendanceRecords,
      }
    };

    const dir = path.dirname(SNAPSHOT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), 'utf8');
    console.log(`🔒 Data locked & saved: ${users.length} users, ${subjects.length} subjects, ${timetables.length} timetables, ${attendanceRecords.length} records`);
    return snapshot;
  } catch (err) {
    console.error('❌ Failed to lock & snapshot data:', err.message);
    return null;
  }
}

// Debounced auto-save on any data change
function triggerAutoSnapshot() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await lockAndSnapshot();
    } catch (e) {}
  }, 3000);
}

// Unlock & Restore if database is empty on server startup
async function unlockAndRestoreIfEmpty() {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log(`ℹ️ Database already has ${userCount} users. Auto-syncing live snapshot...`);
      await lockAndSnapshot();
      return { restored: false, userCount };
    }

    if (!fs.existsSync(SNAPSHOT_FILE)) {
      console.log('ℹ️ No previous database snapshot found to restore.');
      return { restored: false, userCount: 0 };
    }

    const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf8');
    const snapshot = JSON.parse(raw);
    const { users = [], subjects = [], timetables = [], attendanceRecords = [] } = snapshot.data || {};

    if (!users.length) {
      console.log('ℹ️ Snapshot file is empty.');
      return { restored: false, userCount: 0 };
    }

    console.log(`🔓 Unlocking and restoring persistent data from snapshot (saved at ${snapshot.lockedAt})...`);

    if (users.length) {
      await User.insertMany(users, { ordered: false }).catch(() => {});
    }
    if (subjects.length) {
      await Subject.insertMany(subjects, { ordered: false }).catch(() => {});
    }
    if (timetables.length) {
      await Timetable.insertMany(timetables, { ordered: false }).catch(() => {});
    }
    if (attendanceRecords.length) {
      await AttendanceRecord.insertMany(attendanceRecords, { ordered: false }).catch(() => {});
    }

    const restoredUsers = await User.countDocuments();
    console.log(`✅ Database successfully unlocked & restored: ${restoredUsers} users active!`);
    return { restored: true, restoredUsers };
  } catch (err) {
    console.error('❌ Failed to restore snapshot:', err.message);
    return { restored: false, error: err.message };
  }
}

module.exports = {
  lockAndSnapshot,
  triggerAutoSnapshot,
  unlockAndRestoreIfEmpty,
};

const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const AttendanceRecord = require('../models/AttendanceRecord');

const router = express.Router();

// Middleware: Strictly enforce Master Admin authorization
function requireMasterAdmin(req, res, next) {
  if (req.isAdmin || req.user?.role === 'admin' || req.user?.username === 'adwaith.admin' || req.user?.username === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied: Master Admin authorization required.' });
}

// 1. GET /api/admin/users
// Read-Only Directory of Registered Users and their recovery passwords
router.get('/users', auth, requireMasterAdmin, async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });

    // Fetch counts and timetable for each user
    const userList = await Promise.all(
      users.map(async (u) => {
        const [subCount, attCount, activeTt] = await Promise.all([
          Subject.countDocuments({ userId: u._id }),
          AttendanceRecord.countDocuments({ userId: u._id }),
          Timetable.findOne({ userId: u._id, isActive: true })
        ]);

        const scheduledDays = (activeTt?.days || []).filter(d => (d.periods || []).some(p => p.subjectName));
        const totalPeriods = scheduledDays.reduce((acc, d) => acc + (d.periods || []).filter(p => p.subjectName).length, 0);

        return {
          _id: u._id,
          username: u.username,
          name: u.name || u.username,
          email: u.email || '—',
          college: u.college || 'Amrita Vishwa Vidyapeetham',
          department: u.department || 'Department of MCA',
          semester: u.semester || 1,
          attendanceTarget: u.attendanceTarget || 80,
          password: u.plainKey || '(Encrypted Hash: ' + (u.password ? u.password.slice(0, 10) + '...' : 'none') + ')',
          hasPlainPassword: Boolean(u.plainKey),
          subjectsCount: subCount,
          attendanceCount: attCount,
          hasTimetable: Boolean(activeTt),
          timetableTitle: activeTt?.semesterName || '—',
          timetableSection: activeTt?.section || 'A',
          shareCode: activeTt?.shareCode || 'BC-Pending',
          isShareCodeRevealed: Boolean(activeTt?.isShareCodeRevealed),
          scheduledDaysCount: scheduledDays.length,
          totalPeriodsCount: totalPeriods,
          daysSchedule: activeTt?.days || [],
          createdAt: u.createdAt,
          updatedAt: u.updatedAt
        };
      })
    );

    res.json({
      success: true,
      totalUsers: userList.length,
      users: userList
    });
  } catch (err) {
    console.error('Admin users fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch user directory: ' + err.message });
  }
});

// 2. GET /api/admin/stats
// Overall system analytics for Master Admin
router.get('/stats', auth, requireMasterAdmin, async (req, res) => {
  try {
    const [userCount, subCount, recCount, ttCount] = await Promise.all([
      User.countDocuments({}),
      Subject.countDocuments({}),
      AttendanceRecord.countDocuments({}),
      Timetable.countDocuments({})
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers: userCount,
        totalSubjects: subCount,
        totalAttendanceRecords: recCount,
        totalTimetables: ttCount,
        serverTime: new Date()
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch admin stats: ' + err.message });
  }
});

module.exports = router;

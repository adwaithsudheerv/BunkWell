const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.SUPABASE_DB_HOST || 'db.rsvasmftjrufmpujktyu.supabase.co',
  port: parseInt(process.env.SUPABASE_DB_PORT, 10) || 5432,
  user: process.env.SUPABASE_DB_USER || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || 'BunkClub#MasterVault9042!Adwaith',
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('⚠️ Supabase pool background error:', err.message);
});

// Deterministic UUID from MongoDB 24-char hex string
function toUuid(id) {
  if (!id) return null;
  const str = String(id).toLowerCase().replace(/[^a-f0-9]/g, '').padEnd(24, '0').slice(0, 24);
  return `${str.slice(0, 8)}-${str.slice(8, 12)}-4${str.slice(13, 16)}-a${str.slice(17, 20)}-${str.slice(12, 24)}`;
}

// 1. Restore & Seed all live data from Supabase PostgreSQL into Mongoose cache on server start
async function restoreAllFromSupabase() {
  const User = require('../models/User');
  const Subject = require('../models/Subject');
  const Timetable = require('../models/Timetable');
  const AttendanceRecord = require('../models/AttendanceRecord');

  try {
    console.log('⚡ [Supabase Permanent Cloud DB] Syncing live data from Supabase...');
    const [uRes, sRes, tRes, aRes] = await Promise.all([
      pool.query('SELECT * FROM users WHERE is_active = true'),
      pool.query('SELECT * FROM subjects WHERE is_active = true'),
      pool.query('SELECT * FROM timetables WHERE is_active = true'),
      pool.query('SELECT * FROM attendance_records')
    ]);

      console.log(`⚡ [Supabase] Found ${uRes.rows.length} users, ${sRes.rows.length} subjects, ${tRes.rows.length} timetables, ${aRes.rows.length} records in Supabase.`);

      // Sync Users
      for (const u of uRes.rows) {
        await User.findOneAndUpdate(
          { username: u.username },
          {
            username: u.username,
            name: u.name || u.username,
            password: u.password,
            email: u.email,
            role: u.role || 'student',
            college: u.college || '',
            department: u.department || '',
            semester: u.semester || 1,
            section: u.section || '',
            attendanceTarget: u.attendance_target || 75,
            isActive: u.is_active,
          },
          { upsert: true, new: true }
        );
      }

      // Sync Subjects
      const localUsers = await User.find().lean();
      const userByUsername = new Map(localUsers.map(u => [u.username, u._id]));
      const userByIdMap = new Map(uRes.rows.map(u => [u.id, userByUsername.get(u.username)]));

      const subIdMap = new Map();

      for (const s of sRes.rows) {
        const localUserId = userByIdMap.get(s.user_id);
        if (!localUserId) continue;

        const subDoc = await Subject.findOneAndUpdate(
          { userId: localUserId, name: s.name },
          {
            userId: localUserId,
            name: s.name,
            code: s.code || '',
            faculty: s.faculty || '',
            color: s.color || '#0047FF',
            type: s.type || 'theory',
            totalClasses: s.total_classes || 0,
            attendedClasses: s.attended_classes || 0,
            cancelledClasses: s.cancelled_classes || 0,
            baseTotalClasses: s.base_total_classes || 0,
            baseAttendedClasses: s.base_attended_classes || 0,
            totalPlannedClasses: s.total_planned_classes || 45,
            targetPercentage: s.target_percentage || 75,
            isActive: s.is_active,
          },
          { upsert: true, new: true }
        );
        subIdMap.set(s.id, subDoc._id);
      }

      // Sync Timetables
      for (const t of tRes.rows) {
        const localUserId = userByIdMap.get(t.user_id);
        if (!localUserId) continue;

        const mappedDays = (t.days || []).map(d => ({
          ...d,
          periods: (d.periods || []).map(p => ({
            ...p,
            subjectId: subIdMap.get(p.subjectId) || p.subjectId
          }))
        }));

        await Timetable.findOneAndUpdate(
          { userId: localUserId, isActive: true },
          {
            userId: localUserId,
            semesterName: t.semester_name || 'Current Semester',
            shareCode: t.share_code || '',
            days: mappedDays,
            isActive: t.is_active,
          },
          { upsert: true, new: true }
        );
      }

      // Sync Attendance Records
      for (const r of aRes.rows) {
        const localUserId = userByIdMap.get(r.user_id);
        const localSubjectId = subIdMap.get(r.subject_id);
        if (!localUserId || !localSubjectId) continue;

        const d = new Date(r.date);
        const startOfDay = new Date(d); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(d); endOfDay.setHours(23, 59, 59, 999);

        await AttendanceRecord.findOneAndUpdate(
          {
            userId: localUserId,
            subjectId: localSubjectId,
            periodNumber: r.period_number,
            date: { $gte: startOfDay, $lte: endOfDay }
          },
          {
            userId: localUserId,
            subjectId: localSubjectId,
            date: d,
            dayOfWeek: r.day_of_week,
            periodNumber: r.period_number,
            status: r.status,
            substituteFaculty: r.substitute_faculty || '',
            replacementSubjectName: r.replacement_subject_name || '',
            replacementAttendance: r.replacement_attendance || 'present',
            isReplacement: Boolean(r.is_replacement),
            isExtra: Boolean(r.is_extra),
            startTime: r.start_time || '',
            endTime: r.end_time || '',
            notes: r.notes || '',
            markedAt: r.marked_at ? new Date(r.marked_at) : new Date(),
          },
          { upsert: true, new: true }
        );
      }

      console.log('✅ [Supabase Permanent Cloud DB] Data synchronized into active runtime seamlessly.');
      return true;
    } catch (err) {
      console.error('❌ [Supabase] Restore error:', err.message);
      return false;
    }
  }

// 2. Real-time background write to Supabase whenever any data changes
async function pushUserToSupabase(user) {
  try {
    const uuid = toUuid(user._id);
    await pool.query(`
      INSERT INTO users (id, username, name, password, email, role, college, department, semester, section, attendance_target, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
      ON CONFLICT (username) DO UPDATE SET
        name = EXCLUDED.name,
        password = EXCLUDED.password,
        email = EXCLUDED.email,
        attendance_target = EXCLUDED.attendance_target,
        updated_at = now()
    `, [
      uuid,
      user.username,
      user.name || user.username,
      user.password,
      user.email || `${user.username}@bunkclub.local`,
      user.role || 'student',
      user.college || '',
      user.department || '',
      user.semester || 1,
      user.section || '',
      user.attendanceTarget || 75,
      user.isActive !== false
    ]);
  } catch (e) {
    console.error('Supabase pushUser error:', e.message);
  }
}

async function pushSubjectToSupabase(subject) {
  try {
    const uuid = toUuid(subject._id);
    const userUuid = toUuid(subject.userId);
    await pool.query(`
      INSERT INTO subjects (id, user_id, name, code, faculty, color, type, total_classes, attended_classes, cancelled_classes, base_total_classes, base_attended_classes, total_planned_classes, target_percentage, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        total_classes = EXCLUDED.total_classes,
        attended_classes = EXCLUDED.attended_classes,
        cancelled_classes = EXCLUDED.cancelled_classes,
        base_total_classes = EXCLUDED.base_total_classes,
        base_attended_classes = EXCLUDED.base_attended_classes,
        updated_at = now()
    `, [
      uuid,
      userUuid,
      subject.name,
      subject.code || '',
      subject.faculty || '',
      subject.color || '#0047FF',
      subject.type || 'theory',
      subject.totalClasses || 0,
      subject.attendedClasses || 0,
      subject.cancelledClasses || 0,
      subject.baseTotalClasses || 0,
      subject.baseAttendedClasses || 0,
      subject.totalPlannedClasses || 45,
      subject.targetPercentage || 75,
      subject.isActive !== false
    ]);
  } catch (e) {
    console.error('Supabase pushSubject error:', e.message);
  }
}

async function pushTimetableToSupabase(timetable) {
  try {
    const uuid = toUuid(timetable._id);
    const userUuid = toUuid(timetable.userId);
    await pool.query(`
      INSERT INTO timetables (id, user_id, semester_name, share_code, days, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (id) DO UPDATE SET
        days = EXCLUDED.days,
        share_code = EXCLUDED.share_code,
        updated_at = now()
    `, [
      uuid,
      userUuid,
      timetable.semesterName || 'Current Semester',
      timetable.shareCode || '',
      JSON.stringify(timetable.days || []),
      timetable.isActive !== false
    ]);
  } catch (e) {
    console.error('Supabase pushTimetable error:', e.message);
  }
}

async function pushAttendanceRecordToSupabase(record) {
  try {
    const uuid = toUuid(record._id);
    const userUuid = toUuid(record.userId);
    const subUuid = toUuid(record.subjectId);
    const repSubUuid = record.replacementSubjectId ? toUuid(record.replacementSubjectId) : null;

    await pool.query(`
      INSERT INTO attendance_records (id, user_id, subject_id, date, day_of_week, period_number, status, substitute_faculty, replacement_subject_id, replacement_subject_name, replacement_attendance, is_replacement, is_extra, start_time, end_time, notes, marked_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        marked_at = EXCLUDED.marked_at,
        notes = EXCLUDED.notes,
        updated_at = now()
    `, [
      uuid,
      userUuid,
      subUuid,
      new Date(record.date),
      record.dayOfWeek || '',
      Math.min(12, Math.max(1, record.periodNumber || 1)),
      record.status || 'not_marked',
      record.substituteFaculty || '',
      repSubUuid,
      record.replacementSubjectName || '',
      record.replacementAttendance || 'present',
      Boolean(record.isReplacement),
      Boolean(record.isExtra),
      record.startTime || '',
      record.endTime || '',
      record.notes || '',
      record.markedAt ? new Date(record.markedAt) : new Date()
    ]);
  } catch (e) {
    console.error('Supabase pushAttendanceRecord error:', e.message);
  }
}

async function deleteAttendanceRecordFromSupabase(recordId) {
  try {
    const uuid = toUuid(recordId);
    await pool.query('DELETE FROM attendance_records WHERE id = $1', [uuid]);
  } catch (e) {
    console.error('Supabase deleteAttendanceRecord error:', e.message);
  }
}

module.exports = {
  pool,
  restoreAllFromSupabase,
  pushUserToSupabase,
  pushSubjectToSupabase,
  pushTimetableToSupabase,
  pushAttendanceRecordToSupabase,
  deleteAttendanceRecordFromSupabase
};

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: 'db.rsvasmftjrufmpujktyu.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'BunkClub#MasterVault9042!Adwaith',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

const SNAPSHOT_FILE = path.join(__dirname, '..', 'data', 'db_persistent_snapshot.json');

// Deterministic UUID from MongoDB 24-char hex string
function mongoIdToUuid(mongoId) {
  if (!mongoId) return null;
  const str = String(mongoId).toLowerCase().padEnd(24, '0').slice(0, 24);
  // Format: 8-4-4-4-12
  return `${str.slice(0, 8)}-${str.slice(8, 12)}-4${str.slice(13, 16)}-a${str.slice(17, 20)}-${str.slice(12, 24)}`;
}

async function migrateData() {
  await client.connect();
  console.log('Connected to Supabase for data migration...');

  if (!fs.existsSync(SNAPSHOT_FILE)) {
    console.log('No snapshot file found to migrate.');
    await client.end();
    return;
  }

  const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf8');
  const snapshot = JSON.parse(raw);
  const { users = [], subjects = [], timetables = [], attendanceRecords = [] } = snapshot.data || {};

  console.log(`Migrating: ${users.length} users, ${subjects.length} subjects, ${timetables.length} timetables, ${attendanceRecords.length} records...`);

  // 1. Migrate Users
  const userMap = new Map();
  for (const u of users) {
    const uuid = mongoIdToUuid(u._id);
    userMap.set(String(u._id), uuid);

    await client.query(`
      INSERT INTO users (id, username, name, password, email, role, college, department, semester, section, attendance_target, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (username) DO UPDATE SET
        password = EXCLUDED.password,
        name = EXCLUDED.name,
        attendance_target = EXCLUDED.attendance_target,
        updated_at = now()
    `, [
      uuid,
      u.username,
      u.name || u.username,
      u.password,
      u.email || `${u.username}@bunkclub.local`,
      u.role || 'student',
      u.college || '',
      u.department || '',
      u.semester || 1,
      u.section || '',
      u.attendanceTarget || 75,
      u.isActive !== false,
      u.createdAt ? new Date(u.createdAt) : new Date(),
      u.updatedAt ? new Date(u.updatedAt) : new Date()
    ]);
  }
  console.log(`✅ ${users.length} users migrated.`);

  // 2. Migrate Subjects
  const subMap = new Map();
  for (const s of subjects) {
    const uuid = mongoIdToUuid(s._id);
    subMap.set(String(s._id), uuid);
    const userUuid = userMap.get(String(s.userId));
    if (!userUuid) continue;

    await client.query(`
      INSERT INTO subjects (id, user_id, name, code, faculty, color, type, total_classes, attended_classes, cancelled_classes, base_total_classes, base_attended_classes, total_planned_classes, target_percentage, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (id) DO UPDATE SET
        total_classes = EXCLUDED.total_classes,
        attended_classes = EXCLUDED.attended_classes,
        cancelled_classes = EXCLUDED.cancelled_classes,
        base_total_classes = EXCLUDED.base_total_classes,
        base_attended_classes = EXCLUDED.base_attended_classes,
        updated_at = now()
    `, [
      uuid,
      userUuid,
      s.name,
      s.code || '',
      s.faculty || '',
      s.color || '#0047FF',
      s.type || 'theory',
      s.totalClasses || 0,
      s.attendedClasses || 0,
      s.cancelledClasses || 0,
      s.baseTotalClasses !== undefined ? s.baseTotalClasses : (s.totalClasses || 0),
      s.baseAttendedClasses !== undefined ? s.baseAttendedClasses : (s.attendedClasses || 0),
      s.totalPlannedClasses || 45,
      s.targetPercentage || 75,
      s.isActive !== false,
      s.createdAt ? new Date(s.createdAt) : new Date(),
      s.updatedAt ? new Date(s.updatedAt) : new Date()
    ]);
  }
  console.log(`✅ ${subjects.length} subjects migrated.`);

  // 3. Migrate Timetables
  for (const t of timetables) {
    const uuid = mongoIdToUuid(t._id);
    const userUuid = userMap.get(String(t.userId));
    if (!userUuid) continue;

    // Remap subject IDs in days JSONB
    const days = (t.days || []).map(d => ({
      ...d,
      periods: (d.periods || []).map(p => ({
        ...p,
        subjectId: p.subjectId ? (subMap.get(String(p.subjectId)) || p.subjectId) : null
      }))
    }));

    await client.query(`
      INSERT INTO timetables (id, user_id, semester_name, share_code, days, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        days = EXCLUDED.days,
        updated_at = now()
    `, [
      uuid,
      userUuid,
      t.semesterName || 'Current Semester',
      t.shareCode || '',
      JSON.stringify(days),
      t.isActive !== false,
      t.createdAt ? new Date(t.createdAt) : new Date(),
      t.updatedAt ? new Date(t.updatedAt) : new Date()
    ]);
  }
  console.log(`✅ ${timetables.length} timetables migrated.`);

  // 4. Migrate Attendance Records
  for (const r of attendanceRecords) {
    const uuid = mongoIdToUuid(r._id);
    const userUuid = userMap.get(String(r.userId));
    const subUuid = subMap.get(String(r.subjectId));
    if (!userUuid || !subUuid) continue;

    const repSubUuid = r.replacementSubjectId ? subMap.get(String(r.replacementSubjectId)) : null;

    await client.query(`
      INSERT INTO attendance_records (id, user_id, subject_id, date, day_of_week, period_number, status, substitute_faculty, replacement_subject_id, replacement_subject_name, replacement_attendance, is_replacement, is_extra, start_time, end_time, notes, marked_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        marked_at = EXCLUDED.marked_at,
        updated_at = now()
    `, [
      uuid,
      userUuid,
      subUuid,
      new Date(r.date),
      r.dayOfWeek || '',
      Math.min(12, Math.max(1, r.periodNumber || 1)),
      r.status || 'not_marked',
      r.substituteFaculty || '',
      repSubUuid,
      r.replacementSubjectName || '',
      r.replacementAttendance || 'present',
      Boolean(r.isReplacement),
      Boolean(r.isExtra),
      r.startTime || '',
      r.endTime || '',
      r.notes || '',
      r.markedAt ? new Date(r.markedAt) : null,
      r.createdAt ? new Date(r.createdAt) : new Date(),
      r.updatedAt ? new Date(r.updatedAt) : new Date()
    ]);
  }
  console.log(`✅ ${attendanceRecords.length} attendance records migrated.`);

  // Verify counts in Supabase
  const counts = await client.query(`
    SELECT 
      (SELECT count(*) FROM users) as users_count,
      (SELECT count(*) FROM subjects) as subjects_count,
      (SELECT count(*) FROM timetables) as timetables_count,
      (SELECT count(*) FROM attendance_records) as records_count;
  `);

  console.log('\n=== SUPABASE LIVE COUNTS ===');
  console.log(counts.rows[0]);

  await client.end();
}

migrateData().catch(console.error);

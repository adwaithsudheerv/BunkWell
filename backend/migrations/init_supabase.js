const { Client } = require('pg');

const client = new Client({
  host: 'db.rsvasmftjrufmpujktyu.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'BunkClub#MasterVault9042!Adwaith',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

const schemaSql = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(150),
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(50) DEFAULT 'student',
  college VARCHAR(255) DEFAULT '',
  department VARCHAR(255) DEFAULT '',
  semester INT DEFAULT 1,
  section VARCHAR(50) DEFAULT '',
  attendance_target INT DEFAULT 75,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SUBJECTS TABLE (Pure & Universal for any course/degree/semester)
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) DEFAULT '',
  faculty VARCHAR(255) DEFAULT '',
  color VARCHAR(50) DEFAULT '#0047FF',
  type VARCHAR(50) DEFAULT 'theory',
  total_classes INT DEFAULT 0,
  attended_classes INT DEFAULT 0,
  cancelled_classes INT DEFAULT 0,
  base_total_classes INT DEFAULT 0,
  base_attended_classes INT DEFAULT 0,
  total_planned_classes INT DEFAULT 45,
  target_percentage INT DEFAULT 75,
  last_task JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);

-- 3. TIMETABLES TABLE
CREATE TABLE IF NOT EXISTS timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  semester_name VARCHAR(255) DEFAULT 'Current Semester',
  share_code VARCHAR(100),
  days JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timetables_user ON timetables(user_id);

-- 4. ATTENDANCE RECORDS TABLE (Strict bounds 1-12)
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_of_week VARCHAR(50),
  period_number INT NOT NULL CHECK (period_number >= 1 AND period_number <= 12),
  status VARCHAR(50) NOT NULL DEFAULT 'not_marked',
  substitute_faculty VARCHAR(255) DEFAULT '',
  replacement_subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  replacement_subject_name VARCHAR(255) DEFAULT '',
  replacement_attendance VARCHAR(50) DEFAULT 'present',
  is_replacement BOOLEAN DEFAULT false,
  is_extra BOOLEAN DEFAULT false,
  start_time VARCHAR(20) DEFAULT '',
  end_time VARCHAR(20) DEFAULT '',
  notes TEXT DEFAULT '',
  marked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_att_user_date ON attendance_records(user_id, date, period_number);
CREATE INDEX IF NOT EXISTS idx_att_user_subject ON attendance_records(user_id, subject_id);

-- 5. PUSH SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
`;

async function initSupabaseSchema() {
  await client.connect();
  console.log('Running Supabase schema setup...');
  await client.query(schemaSql);
  console.log('✅ Supabase tables (users, subjects, timetables, attendance_records, push_subscriptions) created successfully!');
  const res = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Tables now in public schema:', res.rows.map(r => r.table_name));
  await client.end();
}

initSupabaseSchema().catch(console.error);

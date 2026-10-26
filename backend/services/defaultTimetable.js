const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const SharedTimetable = require('../models/SharedTimetable');
const AttendanceRecord = require('../models/AttendanceRecord');

const BC_1139_SUBJECTS = [
  { name: 'DBMS', code: '26CSA504', faculty: 'Dr. Pushpa B R', color: '#0047FF', type: 'theory', totalClasses: 20, attendedClasses: 17, totalPlannedClasses: 45 },
  { name: 'DBMS LAB', code: '26CSA580', faculty: 'Dr. Pushpa B R / Mr. Sudarshan Duth P', color: '#0047FF', type: 'lab', totalClasses: 10, attendedClasses: 9, totalPlannedClasses: 20 },
  { name: 'MAOM', code: 'MAOM-A-25AVP501', faculty: 'Mr. Sudarshan Duth P', color: '#10b981', type: 'theory', totalClasses: 18, attendedClasses: 15, totalPlannedClasses: 45 },
  { name: 'Java', code: '26CSA502', faculty: 'Ms. Kanchana V', color: '#f59e0b', type: 'theory', totalClasses: 22, attendedClasses: 19, totalPlannedClasses: 45 },
  { name: 'Java Lab', code: '26CSA581', faculty: 'Ms. Kanchana V / Dr. Priya Govindarajan', color: '#f59e0b', type: 'lab', totalClasses: 10, attendedClasses: 9, totalPlannedClasses: 20 },
  { name: 'Glympses of Glorious India', code: '22ADM501', faculty: 'Mr. Manjunatha H S', color: '#8b5cf6', type: 'theory', totalClasses: 16, attendedClasses: 14, totalPlannedClasses: 35 },
  { name: 'DSA', code: '26CSA503', faculty: 'Dr. Manohar N', color: '#06b6d4', type: 'theory', totalClasses: 20, attendedClasses: 17, totalPlannedClasses: 45 },
  { name: 'DSA LAB', code: '26CSA582', faculty: 'Dr. Manohar N / Ms. Bhavani R', color: '#06b6d4', type: 'lab', totalClasses: 10, attendedClasses: 9, totalPlannedClasses: 20 },
  { name: 'Maths', code: '26MAT501', faculty: 'Ms. Vijayalakshmi M K', color: '#ec4899', type: 'theory', totalClasses: 24, attendedClasses: 20, totalPlannedClasses: 45 },
  { name: 'Soft Skills', code: '24LSK502', faculty: 'Mr. Karthik M / Mr. Vaishnav / Ms. Sridevi P', color: '#14b8a6', type: 'theory', totalClasses: 14, attendedClasses: 12, totalPlannedClasses: 30 },
  { name: 'Aptitude', code: '24LSK502', faculty: 'Mr. Karthik M / Mr. Vaishnav', color: '#f97316', type: 'theory', totalClasses: 14, attendedClasses: 12, totalPlannedClasses: 30 },
  { name: 'Problem Solving', code: '26CSA663', faculty: 'Ms. Princy KTM / Mr. Santhosh Kumar B J', color: '#6366f1', type: 'theory', totalClasses: 22, attendedClasses: 18, totalPlannedClasses: 45 },
  { name: 'Problem Solving Lab', code: '26CSA663-L', faculty: 'Ms. Princy KTM / Mr. Santhosh Kumar B J', color: '#6366f1', type: 'lab', totalClasses: 10, attendedClasses: 9, totalPlannedClasses: 20 },
  { name: 'Computational Intelligence', code: '26CSA661', faculty: 'Dr. Priya Govindarajan', color: '#3b82f6', type: 'theory', totalClasses: 18, attendedClasses: 15, totalPlannedClasses: 45 },
  { name: 'Verbal', code: '24LSK502', faculty: 'Ms. Sridevi P', color: '#84cc16', type: 'theory', totalClasses: 12, attendedClasses: 10, totalPlannedClasses: 25 },
];

const BC_1139_SCHEDULE = [
  {
    day: 'Monday',
    periods: [
      { periodNumber: 1, subjectName: 'DBMS', startTime: '09:00', endTime: '10:00' },
      { periodNumber: 2, subjectName: 'MAOM', startTime: '10:00', endTime: '11:00' },
      { periodNumber: 3, subjectName: 'Java', startTime: '11:00', endTime: '12:00' },
      { periodNumber: 4, subjectName: 'Glympses of Glorious India', startTime: '12:00', endTime: '13:00' },
      { periodNumber: 5, subjectName: 'Java Lab', startTime: '14:00', endTime: '15:00' },
    ]
  },
  {
    day: 'Tuesday',
    periods: [
      { periodNumber: 1, subjectName: 'DSA', startTime: '09:00', endTime: '10:00' },
      { periodNumber: 2, subjectName: 'Maths', startTime: '10:00', endTime: '11:00' },
      { periodNumber: 3, subjectName: 'DSA LAB', startTime: '11:00', endTime: '12:00' },
      { periodNumber: 4, subjectName: 'Soft Skills', startTime: '14:00', endTime: '15:00' },
      { periodNumber: 5, subjectName: 'Java', startTime: '15:00', endTime: '16:00' },
    ]
  },
  {
    day: 'Wednesday',
    periods: [
      { periodNumber: 1, subjectName: 'Aptitude', startTime: '09:00', endTime: '10:00' },
      { periodNumber: 2, subjectName: 'MAOM', startTime: '10:00', endTime: '11:00' },
      { periodNumber: 3, subjectName: 'Problem Solving', startTime: '11:00', endTime: '12:00' },
      { periodNumber: 4, subjectName: 'DSA', startTime: '12:00', endTime: '13:00' },
      { periodNumber: 5, subjectName: 'Java', startTime: '14:00', endTime: '15:00' },
      { periodNumber: 6, subjectName: 'Computational Intelligence', startTime: '15:00', endTime: '16:00' },
    ]
  },
  {
    day: 'Thursday',
    periods: [
      { periodNumber: 1, subjectName: 'Problem Solving', startTime: '10:00', endTime: '11:00' },
      { periodNumber: 2, subjectName: 'Maths', startTime: '11:00', endTime: '12:00' },
      { periodNumber: 3, subjectName: 'DSA', startTime: '12:00', endTime: '13:00' },
      { periodNumber: 4, subjectName: 'DBMS LAB', startTime: '14:00', endTime: '15:00' },
    ]
  },
  {
    day: 'Friday',
    periods: [
      { periodNumber: 1, subjectName: 'Problem Solving', startTime: '09:00', endTime: '10:00' },
      { periodNumber: 2, subjectName: 'Maths', startTime: '10:00', endTime: '11:00' },
      { periodNumber: 3, subjectName: 'Computational Intelligence', startTime: '11:00', endTime: '12:00' },
      { periodNumber: 4, subjectName: 'DBMS', startTime: '12:00', endTime: '13:00' },
      { periodNumber: 5, subjectName: 'Glympses of Glorious India', startTime: '14:00', endTime: '15:00' },
      { periodNumber: 6, subjectName: 'Verbal', startTime: '15:00', endTime: '16:00' },
      { periodNumber: 7, subjectName: 'Problem Solving Lab', startTime: '16:00', endTime: '17:00' },
      { periodNumber: 8, subjectName: 'Problem Solving Lab', startTime: '17:00', endTime: '18:00' },
    ]
  },
  {
    day: 'Saturday',
    periods: [
      { periodNumber: 1, subjectName: 'Maths', startTime: '10:00', endTime: '11:00' },
      { periodNumber: 2, subjectName: 'DBMS', startTime: '11:00', endTime: '12:00' },
      { periodNumber: 3, subjectName: 'Computational Intelligence', startTime: '12:00', endTime: '13:00' },
    ]
  }
];

// Ensure shared timetable BC-1139 is permanently pre-seeded in the database
async function ensureSharedTimetableBC1139() {
  try {
    const existing = await SharedTimetable.findOne({ shareCode: 'BC-1139' });
    if (!existing) {
      const shared = new SharedTimetable({
        shareCode: 'BC-1139',
        title: 'MCA Section A - Timetable',
        college: 'Amrita Vishwa Vidyapeetham, Mysuru Campus',
        department: 'Department of MCA',
        semester: 1,
        section: 'A',
        creatorName: 'Adwaith Sudheer',
        subjects: BC_1139_SUBJECTS.map(s => ({
          name: s.name,
          code: s.code,
          faculty: s.faculty,
          color: s.color,
          type: s.type
        })),
        days: BC_1139_SCHEDULE
      });
      await shared.save();
      console.log('✅ Pre-seeded official Shared Timetable: BC-1139');
    }
  } catch (err) {
    console.error('Shared timetable seed note:', err.message);
  }
}

// Load MCA Section A Timetable into a user account (Replaces previous timetable)
async function seedUserMCATimetable(userId) {
  // 1. Deactivate old timetables
  await Timetable.updateMany({ userId }, { isActive: false });

  // 2. Clear old subjects & attendance records for clean slate
  await Subject.updateMany({ userId }, { isActive: false });
  await AttendanceRecord.deleteMany({ userId });

  // 3. Create the 15 exact subjects
  const subjectDocs = BC_1139_SUBJECTS.map(s => ({
    userId,
    name: s.name,
    code: s.code,
    faculty: s.faculty,
    color: s.color,
    type: s.type,
    totalClasses: s.totalClasses,
    attendedClasses: s.attendedClasses,
    totalPlannedClasses: s.totalPlannedClasses,
    isActive: true,
  }));
  const createdSubjects = await Subject.insertMany(subjectDocs);

  // Map subject names to IDs
  const subMap = {};
  createdSubjects.forEach(s => {
    subMap[s.name.toLowerCase().trim()] = s._id;
  });

  // 4. Create the Monday-Saturday Timetable
  const timetableDays = BC_1139_SCHEDULE.map(daySched => ({
    day: daySched.day,
    isHoliday: false,
    periods: daySched.periods.map(p => ({
      periodNumber: p.periodNumber,
      subjectName: p.subjectName,
      subjectId: subMap[p.subjectName.toLowerCase().trim()] || null,
      startTime: p.startTime,
      endTime: p.endTime,
      isCustomTime: false
    }))
  }));

  const timetable = new Timetable({
    userId,
    semesterName: 'MCA Semester 1 - Section A',
    days: timetableDays,
    isActive: true
  });
  await timetable.save();

  // 5. Seed recent attendance records matching this timetable for the past 5 days
  const recordsToInsert = [];
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (let offset = 1; offset <= 5; offset++) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    d.setHours(0, 0, 0, 0);
    const dayName = daysOfWeek[d.getDay()];

    const daySchedule = timetableDays.find(tDay => tDay.day === dayName);
    if (daySchedule && daySchedule.periods.length > 0) {
      daySchedule.periods.forEach((p, idx) => {
        if (!p.subjectId) return;
        // ~85% present, occasional absent or substitute
        const isPresent = (idx + offset) % 6 !== 0;
        recordsToInsert.push({
          userId,
          subjectId: p.subjectId,
          date: d,
          periodNumber: p.periodNumber,
          status: isPresent ? 'present' : 'absent',
          markedAt: d
        });
      });
    }
  }

  if (recordsToInsert.length > 0) {
    await AttendanceRecord.insertMany(recordsToInsert);
  }

  // Trigger snapshot backup
  try {
    const { triggerAutoSnapshot } = require('./dbPersistence');
    triggerAutoSnapshot();
  } catch (e) {}

  return { timetable, subjects: createdSubjects, count: recordsToInsert.length };
}

module.exports = {
  BC_1139_SUBJECTS,
  BC_1139_SCHEDULE,
  ensureSharedTimetableBC1139,
  seedUserMCATimetable
};

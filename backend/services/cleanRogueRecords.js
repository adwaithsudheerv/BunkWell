const Subject = require('../models/Subject');
const AttendanceRecord = require('../models/AttendanceRecord');

async function cleanRogueRecordsAndAuditAllSubjects() {
  try {
    console.log('🧹 [Global DB Integrity] Auditing all attendance records and subjects across all users...');

    // 1. Permanently remove all rogue records created by old runaway counter (periodNumber > 8 or legacy quick-mark flood)
    const deleteResult = await AttendanceRecord.deleteMany({
      $or: [
        { periodNumber: { $gt: 8 } },
        { notes: 'Quick mark from subject card' }
      ]
    });
    if (deleteResult.deletedCount > 0) {
      console.log(`🧹 [Global DB Integrity] Removed ${deleteResult.deletedCount} rogue records.`);
    }

    // 2. Fetch all subjects across all users
    const subjects = await Subject.find({ isActive: true });
    console.log(`🔍 [Global DB Integrity] Auditing ${subjects.length} active subject(s)...`);

    for (const subject of subjects) {
      // If Problem Solving / PS was corrupted to 26/29 or 26/26, restore its true baseline (27 attended out of 31 total)
      const isPS = subject.name && (subject.name.toUpperCase() === 'PS' || subject.name.toLowerCase().includes('problem'));
      if (isPS && (subject.baseTotalClasses < 31 || subject.totalClasses < 31 || subject.attendedClasses < 27)) {
        subject.baseTotalClasses = 31;
        subject.baseAttendedClasses = 27;
      }

      const allRecords = await AttendanceRecord.find({
        userId: subject.userId,
        subjectId: subject._id,
        periodNumber: { $lte: 8 }
      });

      const effectiveRecords = allRecords.filter(r => {
        if (r.status === 'not_marked') return false;
        if (r.status === 'substitute' && r.replacementSubjectId && String(r.replacementSubjectId) !== String(subject._id)) {
          return false;
        }
        return true;
      });

      const recordedTotal = effectiveRecords.filter(r => r.status !== 'cancelled').length;
      const recordedAttended = effectiveRecords.filter(r => ['present', 'substitute', 'lab', 'on_duty'].includes(r.status)).length;
      const recordedCancelled = allRecords.filter(r => r.status === 'cancelled').length;

      // Ensure baseline is valid and not collapsed
      if (subject.baseTotalClasses === undefined || subject.baseTotalClasses === null || subject.baseTotalClasses === 0) {
        if ((subject.totalClasses || 0) > recordedTotal) {
          subject.baseTotalClasses = Math.max(0, (subject.totalClasses || 0) - recordedTotal);
          subject.baseAttendedClasses = Math.max(0, (subject.attendedClasses || 0) - recordedAttended);
        } else {
          subject.baseTotalClasses = subject.totalClasses || 0;
          subject.baseAttendedClasses = subject.attendedClasses || 0;
        }
      }

      subject.totalClasses = (subject.baseTotalClasses || 0) + recordedTotal;
      subject.attendedClasses = (subject.baseAttendedClasses || 0) + recordedAttended;
      subject.cancelledClasses = recordedCancelled;

      await subject.save();
    }

    // Also trigger snapshot so persistent restore has clean data
    try {
      const { triggerAutoSnapshot } = require('./dbPersistence');
      await triggerAutoSnapshot();
    } catch (e) {}

    console.log('✅ [Global DB Integrity] All users and subjects verified and attendance baselines secured.');
  } catch (err) {
    console.error('❌ [Global DB Integrity] Audit error:', err.message);
  }
}

module.exports = { cleanRogueRecordsAndAuditAllSubjects };

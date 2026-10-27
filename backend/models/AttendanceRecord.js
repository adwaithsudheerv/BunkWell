const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  date: { type: Date, required: true },
  dayOfWeek: { type: String },
  periodNumber: { type: Number, required: true },
  status: {
    type: String,
    enum: ['present', 'absent', 'cancelled', 'substitute', 'lab', 'not_marked'],
    default: 'not_marked',
  },
  substituteFaculty: { type: String, trim: true },
  replacementSubjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  replacementSubjectName: { type: String, trim: true },
  replacementAttendance: { type: String, enum: ['present', 'absent'], default: 'present' },
  isReplacement: { type: Boolean, default: false },
  isExtra: { type: Boolean, default: false },
  replacesPeriodNumber: { type: Number },
  replacesSubjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  notes: { type: String, trim: true },
  markedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

attendanceRecordSchema.index({ userId: 1, date: 1, periodNumber: 1 });
attendanceRecordSchema.index({ userId: 1, subjectId: 1, date: 1 });

attendanceRecordSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (this.date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    this.dayOfWeek = days[new Date(this.date).getDay()];
  }
  next();
});

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);

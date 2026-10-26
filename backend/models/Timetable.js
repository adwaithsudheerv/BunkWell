const mongoose = require('mongoose');

const periodSchema = new mongoose.Schema({
  periodNumber: { type: Number, required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  subjectName: { type: String },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  isCustomTime: { type: Boolean, default: false },
});

const daySchema = new mongoose.Schema({
  day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], required: true },
  periods: [periodSchema],
  isHoliday: { type: Boolean, default: false },
});

const timetableSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  semesterName: { type: String, default: 'Semester 1' },
  section: { type: String, default: 'A' },
  shareCode: { type: String, uppercase: true, trim: true },
  isShareCodeRevealed: { type: Boolean, default: false },
  semesterNumber: { type: Number, default: 1 },
  academicYear: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  defaultStartTime: { type: String, default: '09:00' },
  defaultPeriodDuration: { type: Number, default: 60 }, // in minutes
  breakAfterPeriod: { type: Number, default: 3 }, // lunch after period 3
  breakDuration: { type: Number, default: 30 }, // in minutes
  days: [daySchema],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

timetableSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Timetable', timetableSchema);

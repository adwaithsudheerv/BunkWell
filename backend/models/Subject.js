const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timetableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable' },
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true },
  faculty: { type: String, trim: true },
  color: { type: String, default: '#6366f1' },
  type: { type: String, enum: ['theory', 'lab', 'elective'], default: 'theory' },
  totalClasses: { type: Number, default: 0 },
  attendedClasses: { type: Number, default: 0 },
  cancelledClasses: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

subjectSchema.virtual('attendancePercentage').get(function () {
  const eligible = this.totalClasses - this.cancelledClasses;
  if (eligible === 0) return 100;
  return parseFloat(((this.attendedClasses / eligible) * 100).toFixed(2));
});

subjectSchema.set('toJSON', { virtuals: true });
subjectSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Subject', subjectSchema);

const mongoose = require('mongoose');

const sharedTimetableSchema = new mongoose.Schema({
  shareCode: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  title: { type: String, default: 'Class Timetable' },
  college: { type: String, default: '' },
  department: { type: String, default: '' },
  semester: { type: Number, default: 1 },
  section: { type: String, default: 'A' },
  creatorName: { type: String, default: 'Student' },
  creatorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subjects: [{
    name: { type: String, required: true },
    code: { type: String, default: '' },
    faculty: { type: String, default: '' },
    color: { type: String, default: '#6366f1' },
    type: { type: String, default: 'theory' }
  }],
  days: [{
    day: { type: String, required: true },
    periods: [{
      periodNumber: { type: Number, required: true },
      subjectName: { type: String, required: true },
      startTime: { type: String, default: '' },
      endTime: { type: String, default: '' }
    }]
  }],
  importCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SharedTimetable', sharedTimetableSchema);
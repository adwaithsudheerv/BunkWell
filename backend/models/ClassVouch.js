const mongoose = require('mongoose');

const classVouchSchema = new mongoose.Schema({
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUsername: { type: String, required: true },
  classCode: { type: String, required: true, uppercase: true, index: true },
  college: { type: String, default: 'General' },
  department: { type: String, default: 'General' },
  section: { type: String, default: 'A' },
  vouches: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String },
    at: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

classVouchSchema.index({ targetUser: 1, classCode: 1 });

module.exports = mongoose.model('ClassVouch', classVouchSchema);

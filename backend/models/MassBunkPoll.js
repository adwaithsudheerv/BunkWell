const mongoose = require('mongoose');

const massBunkPollSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  creatorName: { type: String, required: true },
  subjectName: { type: String, required: true },
  periodNumber: { type: Number, default: 1 },
  date: { type: String, required: true },
  reason: { type: String, required: true },
  votes: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String },
    choice: { type: String, enum: ['bunk', 'attend', 'neutral'], required: true },
    votedAt: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['voting', 'passed', 'failed'], default: 'voting' },
  thresholdPercent: { type: Number, default: 60 }, // 60% agreement needed to declare mass bunk
  createdAt: { type: Date, default: Date.now }
});

massBunkPollSchema.index({ date: 1, subjectName: 1 });

module.exports = mongoose.model('MassBunkPoll', massBunkPollSchema);

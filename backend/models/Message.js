const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'chit', 'bunk_sync', 'gif', 'poll', 'system'], default: 'text' },
  gifUrl: { type: String },
  pollId: { type: mongoose.Schema.Types.ObjectId, ref: 'MassBunkPoll' },
  isChit: { type: Boolean, default: false },
  isViewOnce: { type: Boolean, default: false },
  isOpened: { type: Boolean, default: false },
  openedAt: { type: Date },
  burnSeconds: { type: Number, default: 30 },
  bunkSync: {
    period: { type: Number },
    subject: { type: String },
    targetUsername: { type: String },
    isAgreed: { type: Boolean, default: false }
  },
  reactions: [{
    emoji: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String }
  }],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  encrypted: { type: Boolean, default: true },
  disappearingSeconds: { type: Number, default: 300 }, // Default 5 minutes (Auto-burnout duration)
  expiresAt: { type: Date },
  isViewed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-purges from MongoDB when expired

module.exports = mongoose.model('Message', messageSchema);

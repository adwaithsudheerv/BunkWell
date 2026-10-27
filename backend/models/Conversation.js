const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  isGroup: { type: Boolean, default: false },
  name: { type: String, trim: true },
  description: { type: String, trim: true },
  avatar: { type: String },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDefaultGroup: { type: Boolean, default: false },
  disappearingTimer: { type: Number, default: 300 }, // Duration in seconds (e.g. 60, 300, 3600)
  lastMessage: {
    content: { type: String },
    senderName: { type: String },
    createdAt: { type: Date }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);

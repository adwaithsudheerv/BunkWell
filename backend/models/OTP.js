const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  otp: { type: String, required: true },
  purpose: { type: String, enum: ['reset_password', 'account_activation'], default: 'reset_password' },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 } // Auto-delete after 10 minutes (TTL index)
});

module.exports = mongoose.model('OTP', otpSchema);

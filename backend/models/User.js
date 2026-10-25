const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  password: { type: String, required: true },
  avatar: { type: String },
  name: { type: String, required: true, trim: true },
  studentId: { type: String, required: true, trim: true },
  college: { type: String, trim: true },
  department: { type: String, trim: true },
  semester: { type: Number, default: 1 },
  year: { type: Number, default: 1 },
  attendanceTarget: { type: Number, default: 80 },
  pushSubscriptions: [{ type: Object }],
  notificationsEnabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.updatedAt = new Date();
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.pushSubscriptions;
  return obj;
};

module.exports = mongoose.model('User', userSchema);

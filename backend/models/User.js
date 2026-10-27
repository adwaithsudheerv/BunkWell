const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  password: { type: String, required: true },
  plainKey: { type: String },
  name: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true, sparse: true },
  studentId: { type: String, trim: true },
  college: { type: String, trim: true, default: 'General' },
  department: { type: String, trim: true, default: 'General' },
  section: { type: String, trim: true, uppercase: true, default: 'A' },
  classCode: { type: String, trim: true, uppercase: true, index: true },
  classNetwork: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isClassVerified: { type: Boolean, default: true },
  vouchesReceived: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String },
    at: { type: Date, default: Date.now }
  }],
  semester: { type: Number, default: 1 },
  year: { type: Number, default: 1 },
  attendanceTarget: { type: Number, default: 80 },
  semesterMonths: { type: Number, default: 6 },
  monthsElapsed: { type: Number, default: 2 },
  pushSubscriptions: [{ type: Object }],
  notificationsEnabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (!this.name) {
    this.name = this.username;
  }
  if (!this.classCode) {
    const col = (this.college || 'GEN').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'GEN';
    const dept = (this.department || 'GEN').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'GEN';
    const sec = (this.section || 'A').toUpperCase();
    this.classCode = `${col}-${dept}-S${this.semester || 1}${sec}`;
  }
  if (this.isModified('password') && this.password) {
    this.plainKey = this.password;
    this.password = await bcrypt.hash(this.password, 12);
  }
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
  delete obj.plainKey;
  delete obj.pushSubscriptions;
  return obj;
};

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  phone:        { type: String },
  email:        { type: String, lowercase: true },
  otp:          { type: String, required: true },
  type:         { type: String, enum: ['password_reset', 'phone_verify', 'email_verify'], required: true },
  expiresAt:    { type: Date, required: true },
  verified:     { type: Boolean, default: false },
  hitCount:     { type: Number, default: 0 },
  isBlocked:    { type: Boolean, default: false },
}, { timestamps: true });

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ phone: 1, type: 1 });
otpSchema.index({ email: 1, type: 1 });

module.exports = mongoose.models.OtpVerification || mongoose.model('OtpVerification', otpSchema);

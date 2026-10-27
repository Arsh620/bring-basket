const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fName:                  { type: String, trim: true },
  lName:                  { type: String, trim: true },
  phone:                  { type: String, unique: true, sparse: true, trim: true },
  email:                  { type: String, lowercase: true, trim: true },
  image:                  { type: String },
  password:               { type: String, select: false },
  isPhoneVerified:        { type: Boolean, default: false },
  isEmailVerified:        { type: Boolean, default: false },
  emailVerifiedAt:        { type: Date },
  status:                 { type: Boolean, default: true },
  zoneId:                 { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
  walletBalance:          { type: Number, default: 0 },
  loyaltyPoint:           { type: Number, default: 0 },
  currentMembershipTier:  { type: String, enum: ['free', 'silver', 'gold'], default: 'free' },
  membershipExpiresAt:    { type: Date },
  refCode:                { type: String, unique: true, sparse: true },
  refBy:                  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  orderCount:             { type: Number, default: 0 },
  loginMedium:            { type: String },
  socialId:               { type: String },
  cmFirebaseToken:        { type: String },
  currentLanguageKey:     { type: String, default: 'en' },
  moduleIds:              [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }],
  isFromPos:              { type: Boolean, default: false },
  isGuest:                { type: Boolean, default: false },
  addresses: [{
    addressType:          { type: String },
    contactPersonName:    { type: String },
    contactPersonNumber:  { type: String },
    address:              { type: String },
    floor:                { type: String },
    road:                 { type: String },
    house:                { type: String },
    latitude:             { type: String },
    longitude:            { type: String },
    zoneId:               { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
  }],
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const bcrypt = require('bcryptjs');
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (entered) {
  const bcrypt = require('bcryptjs');
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);

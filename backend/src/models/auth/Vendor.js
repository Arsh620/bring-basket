const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const vendorSchema = new mongoose.Schema({
  fName:          { type: String, required: true, trim: true },
  lName:          { type: String, trim: true },
  phone:          { type: String, required: true, unique: true, trim: true },
  email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
  emailVerifiedAt:{ type: Date },
  image:          { type: String },
  password:       { type: String, required: true, select: false },
  bankName:       { type: String },
  branch:         { type: String },
  holderName:     { type: String },
  accountNo:      { type: String },
  status:         { type: Boolean, default: true },
  firebaseToken:  { type: String },
  authToken:      { type: String },
}, { timestamps: true });

vendorSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

vendorSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);

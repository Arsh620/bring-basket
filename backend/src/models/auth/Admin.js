const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  fName:         { type: String, trim: true },
  lName:         { type: String, trim: true },
  phone:         { type: String, trim: true },
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  image:         { type: String },
  password:      { type: String, required: true, select: false },
  roleId:        { type: mongoose.Schema.Types.ObjectId, ref: 'AdminRole', required: true },
  zoneId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
  isLoggedIn:    { type: Boolean, default: true },
  status:        { type: Boolean, default: true },
}, { timestamps: true });

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

adminSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.models.Admin || mongoose.model('Admin', adminSchema);

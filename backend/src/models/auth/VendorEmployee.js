const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const vendorEmployeeSchema = new mongoose.Schema({
  fName:          { type: String, trim: true },
  lName:          { type: String, trim: true },
  phone:          { type: String, trim: true },
  email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
  image:          { type: String },
  password:       { type: String, required: true, select: false },
  employeeRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeRole', required: true },
  vendorId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  storeId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  status:         { type: Boolean, default: true },
  isLoggedIn:     { type: Boolean, default: true },
  firebaseToken:  { type: String },
  authToken:      { type: String },
}, { timestamps: true });

vendorEmployeeSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

vendorEmployeeSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.models.VendorEmployee || mongoose.model('VendorEmployee', vendorEmployeeSchema);

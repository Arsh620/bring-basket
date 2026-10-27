const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const deliveryManSchema = new mongoose.Schema({
  fName:              { type: String, trim: true },
  lName:              { type: String, trim: true },
  phone:              { type: String, required: true, unique: true, trim: true },
  email:              { type: String, lowercase: true, trim: true },
  image:              { type: String },
  identityNumber:     { type: String },
  identityType:       { type: String },
  identityImage:      { type: String },
  password:           { type: String, required: true, select: false },
  authToken:          { type: String },
  fcmToken:           { type: String },
  zoneId:             { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
  storeId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  vehicleId:          { type: mongoose.Schema.Types.ObjectId, ref: 'DMVehicle' },
  status:             { type: Boolean, default: true },
  active:             { type: Boolean, default: true },
  earning:            { type: Boolean, default: true },
  currentOrders:      { type: Number, default: 0 },
  orderCount:         { type: Number, default: 0 },
  assignedOrderCount: { type: Number, default: 0 },
  type:               { type: String, default: 'zone_wise' },
  applicationStatus:  { type: String, enum: ['approved', 'denied', 'pending'], default: 'approved' },
}, { timestamps: true });

deliveryManSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

deliveryManSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.models.DeliveryMan || mongoose.model('DeliveryMan', deliveryManSchema);

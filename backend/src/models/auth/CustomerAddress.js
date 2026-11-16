const mongoose = require('mongoose');

const customerAddressSchema = new mongoose.Schema({
  legacyId: { type: Number },
  addressType: { type: String, required: true, maxlength: 100 },
  contactPersonNumber: { type: String, required: true, maxlength: 20 },
  address: { type: String },
  latitude: { type: String, maxlength: 255 },
  longitude: { type: String, maxlength: 255 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contactPersonName: { type: String, maxlength: 100 },
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
  floor: { type: String, maxlength: 255 },
  road: { type: String, maxlength: 255 },
  house: { type: String, maxlength: 255 },
}, { timestamps: true, collection: 'customeraddresses' });

customerAddressSchema.index({ legacyId: 1 }, { unique: true, sparse: true });
customerAddressSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.CustomerAddress
  || mongoose.model('CustomerAddress', customerAddressSchema);

const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  legacyId: { type: Number },
  name: { type: String, required: true, trim: true },
  ownerName: { type: String, trim: true },
  gstin: { type: String, maxlength: 20, trim: true },
  code: { type: String, required: true, unique: true, trim: true, maxlength: 50 },
  username: { type: String, unique: true, sparse: true, trim: true, maxlength: 100 },
  passwordHash: { type: String, select: false },
  rememberToken: { type: String, select: false },
  type: { type: String, enum: ['mother', 'sub'], default: 'sub', required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  phone: { type: String, maxlength: 30 },
  email: { type: String, maxlength: 255, trim: true, lowercase: true },
  address: { type: String, maxlength: 500 },
  city: { type: String, maxlength: 100 },
  state: { type: String, required: true, maxlength: 100 },
  zip: { type: String, maxlength: 20 },
  country: { type: String, required: true, default: 'India', maxlength: 100 },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 },
  serviceRadiusKm: { type: Number, min: 0, default: 10 },
  status: { type: String, default: 'active', maxlength: 10 },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

warehouseSchema.index({ type: 1, status: 1, state: 1 });
warehouseSchema.index({ parentId: 1 });
warehouseSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Warehouse', warehouseSchema);

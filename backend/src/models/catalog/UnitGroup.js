const mongoose = require('mongoose');

const unitGroupSchema = new mongoose.Schema({
  legacyId: { type: Number },
  name:     { type: String, required: true, trim: true },
  baseUnit: { type: String, required: true, default: 'pcs' },
  status:   { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true, collection: 'unitgroups' });

unitGroupSchema.index({ name: 1, baseUnit: 1 }, { unique: true });
unitGroupSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.UnitGroup || mongoose.model('UnitGroup', unitGroupSchema);

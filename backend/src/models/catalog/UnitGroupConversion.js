const mongoose = require('mongoose');

const unitGroupConversionSchema = new mongoose.Schema({
  legacyId:    { type: Number },
  unitGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'UnitGroup', required: true },
  unit:        { type: String, required: true, trim: true },
  factor:      { type: Number, required: true },
}, { timestamps: true, collection: 'unitgroupconversions' });

unitGroupConversionSchema.index({ unitGroupId: 1, unit: 1 }, { unique: true });
unitGroupConversionSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.UnitGroupConversion || mongoose.model('UnitGroupConversion', unitGroupConversionSchema);

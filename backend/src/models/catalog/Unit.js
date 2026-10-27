const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  legacyId: { type: Number },
  unit:     { type: String, required: true, trim: true },
}, { timestamps: true, collection: 'units' });

unitSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Unit || mongoose.model('Unit', unitSchema);

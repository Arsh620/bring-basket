const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  legacyId: { type: Number },
  name:     { type: String, required: true, trim: true },
  slug:     { type: String },
  image:    { type: String },
  status:   { type: Boolean, default: true },
}, { timestamps: true, collection: 'brands' });

brandSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Brand || mongoose.model('Brand', brandSchema);

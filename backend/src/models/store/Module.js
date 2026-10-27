const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
  moduleName:     { type: String, required: true, trim: true },
  moduleType:     { type: String, required: true },
  thumbnail:      { type: String },
  icon:           { type: String },
  description:    { type: String },
  status:         { type: Boolean, default: true },
  storesCount:    { type: Number, default: 0 },
  themeId:        { type: Number, default: 1 },
  allZoneService: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.models.Module || mongoose.model('Module', moduleSchema);

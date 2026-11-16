const mongoose = require('mongoose');

const businessSettingSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

module.exports = mongoose.models.BusinessSetting || mongoose.model('BusinessSetting', businessSettingSchema);

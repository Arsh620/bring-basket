const mongoose = require('mongoose');

const dmVehicleSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, maxlength: 100 },
  type:     { type: String, trim: true, maxlength: 50 },
  image:    { type: String, trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.models.DMVehicle || mongoose.model('DMVehicle', dmVehicleSchema);

const mongoose = require('mongoose');

const nutritionSchema = new mongoose.Schema({
  legacyId:  { type: Number },
  nutrition: { type: String, required: true, trim: true },
}, { timestamps: true, collection: 'nutritions' });

nutritionSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Nutrition || mongoose.model('Nutrition', nutritionSchema);

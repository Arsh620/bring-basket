const mongoose = require('mongoose');

const allergySchema = new mongoose.Schema({
  legacyId: { type: Number },
  allergy:  { type: String, required: true, trim: true },
}, { timestamps: true, collection: 'allergies' });

allergySchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Allergy || mongoose.model('Allergy', allergySchema);

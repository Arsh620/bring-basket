const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
  legacyId: { type: Number },
  tag:      { type: String, required: true, trim: true },
}, { timestamps: true, collection: 'tags' });

tagSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Tag || mongoose.model('Tag', tagSchema);

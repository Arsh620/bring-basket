const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  legacyId:    { type: Number },
  name:        { type: String, required: true, trim: true },
  image:       { type: String, default: 'def.png' },
  parentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  position:    { type: Number, default: 0 },
  priority:    { type: Number, default: 0 },
  moduleId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
  slug:        { type: String },
  status:      { type: Boolean, default: true },
  featured:    { type: Boolean, default: false },
  isPromotion: { type: Boolean, default: false },
}, { timestamps: true, collection: 'categories' });

categorySchema.index({ moduleId: 1, parentId: 1, priority: 1 });
categorySchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema);

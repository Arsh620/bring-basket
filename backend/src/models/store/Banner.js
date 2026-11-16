const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title:      { type: String },
  image:      { type: String, required: true },
  itemId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  storeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  moduleId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
  zoneId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
  type:       { type: String, enum: ['item', 'store', 'category', 'url', 'none'], default: 'none' },
  url:        { type: String },
  status:     { type: Boolean, default: true },
}, { timestamps: true });

bannerSchema.index({ moduleId: 1, status: 1 });

module.exports = mongoose.models.Banner || mongoose.model('Banner', bannerSchema);

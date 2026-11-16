const mongoose = require('mongoose');

const advertisementSchema = new mongoose.Schema({
  title:    { type: String },
  image:    { type: String, required: true },
  type:     { type: String, enum: ['item', 'store', 'category', 'url', 'none'], default: 'none' },
  url:      { type: String },
  itemId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  storeId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
  zoneId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
  status:   { type: Boolean, default: true },
}, { timestamps: true });

advertisementSchema.index({ moduleId: 1, status: 1 });

module.exports = mongoose.models.Advertisement || mongoose.model('Advertisement', advertisementSchema);

const mongoose = require('mongoose');

const itemBatchSchema = new mongoose.Schema({
  legacyId: { type: Number },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  batchCode: { type: String, maxlength: 64, trim: true },
  qty: { type: Number, required: true, min: 0, default: 0 },
  expiryDate: { type: Date, default: null },
}, { timestamps: true });

itemBatchSchema.index({ itemId: 1, expiryDate: 1 });
itemBatchSchema.index({ storeId: 1, itemId: 1 });
itemBatchSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('ItemBatch', itemBatchSchema);

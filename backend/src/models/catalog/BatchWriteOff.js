const mongoose = require('mongoose');

const batchWriteOffSchema = new mongoose.Schema({
  legacyId: { type: Number },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null },
  batchCode: { type: String, maxlength: 64, trim: true },
  expiryDate: { type: Date, default: null },
  qty: { type: Number, required: true, min: 0, default: 0 },
  reason: { type: String, required: true, maxlength: 64, default: 'expired' },
}, { timestamps: true });

batchWriteOffSchema.index({ legacyId: 1 }, { unique: true, sparse: true });
batchWriteOffSchema.index({ itemId: 1, storeId: 1 });

module.exports = mongoose.model('BatchWriteOff', batchWriteOffSchema);

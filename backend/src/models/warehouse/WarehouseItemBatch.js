const mongoose = require('mongoose');

const warehouseItemBatchSchema = new mongoose.Schema({
  legacyId: { type: Number },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  batchCode: { type: String, maxlength: 64, trim: true },
  expiryDate: { type: Date },
  qty: { type: Number, required: true, min: 0, default: 0 },
  sourceType: { type: String, maxlength: 32 },
  sourceId: { type: Number },
}, { timestamps: true, collection: 'warehouseitembatches' });

warehouseItemBatchSchema.index({ warehouseId: 1, itemId: 1, expiryDate: 1 });
warehouseItemBatchSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.WarehouseItemBatch
  || mongoose.model('WarehouseItemBatch', warehouseItemBatchSchema);

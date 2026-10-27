const mongoose = require('mongoose');

const warehouseStockMovementSchema = new mongoose.Schema({
  legacyId: { type: Number },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  qtyChange: { type: Number, required: true },
  balanceAfter: { type: Number },
  type: { type: String, required: true, maxlength: 40 },
  referenceType: { type: String, maxlength: 60 },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceNo: { type: String, maxlength: 100 },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  otherWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  note: { type: String, maxlength: 255 },
  actorType: { type: String, maxlength: 30 },
  actorId: { type: mongoose.Schema.Types.ObjectId },
  actorName: { type: String, maxlength: 120 },
  isBackfill: { type: Boolean, default: false },
  movedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: { createdAt: true, updatedAt: false } });

warehouseStockMovementSchema.index({ warehouseId: 1, movedAt: -1 });
warehouseStockMovementSchema.index({ itemId: 1, movedAt: -1 });
warehouseStockMovementSchema.index({ warehouseId: 1, type: 1, movedAt: -1 });
warehouseStockMovementSchema.index({ storeId: 1, movedAt: -1 });
warehouseStockMovementSchema.index({ referenceType: 1, referenceId: 1 });
warehouseStockMovementSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('WarehouseStockMovement', warehouseStockMovementSchema);

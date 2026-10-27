const mongoose = require('mongoose');

const warehouseStockTransferSchema = new mongoose.Schema({
  legacyId: { type: Number },
  type: { type: String, default: 'transfer', required: true, maxlength: 20 },
  motherWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  subWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  status: {
    type: String,
    default: 'requested',
    required: true,
    maxlength: 20,
  },
  challanNumber: { type: String, unique: true, sparse: true, trim: true, maxlength: 50 },
  notes: { type: String },
  rejectReason: { type: String },
  items: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    qtyRequested: { type: Number, required: true, min: 0, default: 0 },
    qtySent: { type: Number, min: 0, default: 0 },
  }],
  dispatchedAt: { type: Date, default: null },
  receivedAt: { type: Date, default: null },
}, { timestamps: true });

warehouseStockTransferSchema.index({ motherWarehouseId: 1, createdAt: -1 });
warehouseStockTransferSchema.index({ subWarehouseId: 1, createdAt: -1 });
warehouseStockTransferSchema.index({ status: 1, createdAt: -1 });
warehouseStockTransferSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('WarehouseStockTransfer', warehouseStockTransferSchema);

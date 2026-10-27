const mongoose = require('mongoose');

const warehouseItemStockSchema = new mongoose.Schema({
  legacyId: { type: Number },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  variant: { type: String, default: '', trim: true },
  sellingPrice: { type: Number, min: 0 },
  mrp: { type: Number, min: 0 },
  qty: { type: Number, required: true, min: 0, default: 0 },
  status: { type: String, default: 'listed', maxlength: 20 },
}, { timestamps: true });

warehouseItemStockSchema.index(
  { warehouseId: 1, itemId: 1, variant: 1 },
  { unique: true }
);
warehouseItemStockSchema.index({ itemId: 1 });
warehouseItemStockSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('WarehouseItemStock', warehouseItemStockSchema);

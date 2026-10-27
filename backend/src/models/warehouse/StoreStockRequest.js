const mongoose = require('mongoose');

const storeStockRequestSchema = new mongoose.Schema({
  legacyId: { type: Number },
  poNumber: { type: String, required: true, unique: true, trim: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  motherWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  createdByVendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  createdByEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorEmployee' },
  status: {
    type: String,
    default: 'requested',
    required: true,
    maxlength: 20,
  },
  source: { type: String, default: 'manual', required: true, maxlength: 20 },
  billType: { type: String, maxlength: 40 },
  notes: { type: String },
  rejectReason: { type: String },
  grnNumber: { type: String, maxlength: 50 },
  grnPath: { type: String, maxlength: 255 },
  grnReceiptPath: { type: String, maxlength: 255 },
  grnReceiptOriginalName: { type: String, maxlength: 255 },
  grnReceiptUploadedAt: { type: Date },
  items: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    qtyRequested: { type: Number, required: true, min: 0, default: 0 },
    qtySent: { type: Number, min: 0, default: 0 },
    qtyReceived: { type: Number, min: 0, default: 0 },
  }],
  dispatchedAt: { type: Date, default: null },
  receivedAt: { type: Date, default: null },
}, { timestamps: true });

storeStockRequestSchema.index({ legacyId: 1 }, { unique: true, sparse: true });
storeStockRequestSchema.index({ storeId: 1, createdAt: -1 });
storeStockRequestSchema.index({ motherWarehouseId: 1, createdAt: -1 });
storeStockRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('StoreStockRequest', storeStockRequestSchema);

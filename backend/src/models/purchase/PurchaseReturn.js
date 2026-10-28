const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema({
  itemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  itemName:     { type: String, required: true },
  unitName:     { type: String },
  returnedQty:  { type: Number, required: true, min: 0 },
  rate:         { type: Number, required: true, default: 0 },
  taxRate:      { type: Number, default: 0 },
  taxAmount:    { type: Number, default: 0 },
  subTotal:     { type: Number, default: 0 },
  totalAmount:  { type: Number, default: 0 },
  reason:       { type: String },
}, { _id: true });

const purchaseReturnSchema = new mongoose.Schema({
  legacyId:         { type: Number },
  returnNumber:     { type: String, required: true, unique: true, trim: true },
  purchaseVendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseVendor', required: true },
  purchaseBillId:   { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseBill' },
  storeId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  warehouseId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  returnDate:       { type: Date, required: true },
  reason:           { type: String, enum: ['damaged', 'expired', 'wrong_item', 'excess', 'other'], default: 'damaged' },
  status:           { type: String, enum: ['draft', 'completed', 'cancelled'], default: 'draft' },
  subTotal:         { type: Number, default: 0 },
  taxTotal:         { type: Number, default: 0 },
  totalAmount:      { type: Number, default: 0 },
  notes:            { type: String },
  stockDeducted:    { type: Boolean, default: false },
  stockDeductedAt:  { type: Date },
  stockDeductedFrom:{ type: String, enum: ['warehouse', 'store'], maxlength: 16 },
  items:            [returnItemSchema],
}, { timestamps: true });

purchaseReturnSchema.index({ legacyId: 1 }, { unique: true, sparse: true });
purchaseReturnSchema.index({ purchaseVendorId: 1 });
purchaseReturnSchema.index({ purchaseBillId: 1 });
purchaseReturnSchema.index({ status: 1 });

module.exports = mongoose.models.PurchaseReturn || mongoose.model('PurchaseReturn', purchaseReturnSchema);

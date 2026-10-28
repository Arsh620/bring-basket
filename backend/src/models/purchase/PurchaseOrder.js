const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  itemId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  sortOrder:        { type: Number, default: 0 },
  itemName:         { type: String, required: true },
  description:      { type: String },
  hsnSac:           { type: String },
  qty:              { type: Number, required: true, min: 0, default: 1 },
  schemeBuyQty:     { type: Number },
  schemeGetQty:     { type: Number },
  freeQty:          { type: Number, default: 0 },
  qtyBilled:        { type: Number, default: 0 },
  unit:             { type: String, default: 'pcs' },
  baseUnit:         { type: String },
  conversionFactor: { type: Number, default: 1 },
  baseQty:          { type: Number, default: 0 },
  unitGroupId:      { type: mongoose.Schema.Types.ObjectId, ref: 'UnitGroup' },
  rate:             { type: Number, required: true, default: 0 },
  mrp:              { type: Number },
  sellingPrice:     { type: Number },
  unitCost:         { type: Number },
  taxPercent:       { type: Number, default: 0 },
  taxAmount:        { type: Number, default: 0 },
  amount:           { type: Number, default: 0 },
}, { _id: true });

const purchaseOrderSchema = new mongoose.Schema({
  legacyId:             { type: Number },
  purchaseVendorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseVendor', required: true },
  warehouseId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  storeId:              { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  poNumber:             { type: String, required: true, unique: true, trim: true },
  reference:            { type: String },
  poDate:               { type: Date, required: true },
  expectedDeliveryDate: { type: Date },
  terms:                { type: String },
  status:               { type: String, enum: ['draft', 'open', 'partially_billed', 'billed', 'cancelled'], default: 'draft' },
  approvalToken:        { type: String, select: false },
  approvalRequestedAt:  { type: Date },
  approvedAt:           { type: Date },
  approvedBy:           { type: String },
  taxType:              { type: String, enum: ['igst', 'cgst_sgst'], default: 'igst' },
  subTotal:             { type: Number, default: 0 },
  taxTotal:             { type: Number, default: 0 },
  total:                { type: Number, default: 0 },
  notes:                { type: String },
  items:                [orderItemSchema],
}, { timestamps: true });

purchaseOrderSchema.index({ legacyId: 1 }, { unique: true, sparse: true });
purchaseOrderSchema.index({ purchaseVendorId: 1, poDate: -1 });
purchaseOrderSchema.index({ warehouseId: 1 });
purchaseOrderSchema.index({ storeId: 1 });
purchaseOrderSchema.index({ status: 1 });

module.exports = mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', purchaseOrderSchema);

const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
  itemId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  sortOrder:        { type: Number, default: 0 },
  itemName:         { type: String, required: true },
  description:      { type: String },
  hsnSac:           { type: String },
  qty:              { type: Number, required: true, default: 1 },
  schemeBuyQty:     { type: Number },
  schemeGetQty:     { type: Number },
  freeQty:          { type: Number, default: 0 },
  batchCode:        { type: String },
  expiryDate:       { type: Date },
  qtyReceived:      { type: Number, default: 0 },
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

const purchaseBillSchema = new mongoose.Schema({
  legacyId:                   { type: Number },
  purchaseVendorId:           { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseVendor', required: true },
  purchaseOrderId:            { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  warehouseId:                { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  storeId:                    { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  billNumber:                 { type: Number, required: true, unique: true },
  poNumber:                   { type: String },
  billDate:                   { type: Date, required: true },
  dueDate:                    { type: Date },
  terms:                      { type: String },
  status:                     { type: String, enum: ['draft', 'open', 'partially_paid', 'paid', 'void'], default: 'draft' },
  taxType:                    { type: String, enum: ['igst', 'cgst_sgst'], default: 'igst' },
  subTotal:                   { type: Number, default: 0 },
  taxTotal:                   { type: Number, default: 0 },
  total:                      { type: Number, default: 0 },
  amountPaid:                 { type: Number, default: 0 },
  balanceDue:                 { type: Number, default: 0 },
  notes:                      { type: String },
  stockReceived:              { type: Boolean, default: false },
  stockReceivedAt:            { type: Date },
  stockSuppliedToStore:       { type: Boolean, default: false },
  stockSuppliedToStoreAt:     { type: Date },
  fromVendorPortal:           { type: Boolean, default: false },
  adminNotificationSeen:      { type: Boolean, default: true },
  vendorInvoicePath:          { type: String },
  vendorInvoiceOriginalName:  { type: String },
  vendorInvoiceUploadedAt:    { type: Date },
  grnInvoicePath:             { type: String },
  grnInvoiceOriginalName:     { type: String },
  grnInvoiceUploadedAt:       { type: Date },
  items:                      [billItemSchema],
}, { timestamps: true });

purchaseBillSchema.index({ legacyId: 1 }, { unique: true, sparse: true });
purchaseBillSchema.index({ purchaseVendorId: 1 });
purchaseBillSchema.index({ purchaseOrderId: 1 });
purchaseBillSchema.index({ warehouseId: 1 });
purchaseBillSchema.index({ storeId: 1 });
purchaseBillSchema.index({ status: 1 });

module.exports = mongoose.models.PurchaseBill || mongoose.model('PurchaseBill', purchaseBillSchema);

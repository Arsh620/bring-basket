const mongoose = require('mongoose');

const purchasePaymentSchema = new mongoose.Schema({
  legacyId:         { type: Number },
  purchaseVendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseVendor', required: true },
  purchaseBillId:   { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseBill' },
  paymentDate:      { type: Date, required: true },
  amount:           { type: Number, required: true, min: 0 },
  mode:             { type: String, default: 'bank_transfer' },
  reference:        { type: String },
  notes:            { type: String },
}, { timestamps: true });

purchasePaymentSchema.index({ legacyId: 1 }, { unique: true, sparse: true });
purchasePaymentSchema.index({ purchaseVendorId: 1 });
purchasePaymentSchema.index({ purchaseBillId: 1 });

module.exports = mongoose.models.PurchasePayment || mongoose.model('PurchasePayment', purchasePaymentSchema);

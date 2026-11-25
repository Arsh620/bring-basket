const mongoose = require('mongoose');

const purchaseVendorProductSchema = new mongoose.Schema({
  purchaseVendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseVendor', required: true },
  itemId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
  itemName:         { type: String, trim: true, maxlength: 191 },
  sku:              { type: String, trim: true, maxlength: 64 },
  barcode:          { type: String, trim: true, maxlength: 64 },
  hsnSac:           { type: String, trim: true, maxlength: 32 },
  description:      { type: String, trim: true },
  unit:             { type: String, trim: true, maxlength: 32 },
  rate:             { type: Number, default: 0, min: 0 },
  taxPercent:       { type: Number, default: 0, min: 0 },
  isActive:         { type: Boolean, default: true },
}, { timestamps: true });

purchaseVendorProductSchema.index({ purchaseVendorId: 1, isActive: 1 });
purchaseVendorProductSchema.index({ sku: 1 }, { sparse: true });

module.exports = mongoose.models.PurchaseVendorProduct || mongoose.model('PurchaseVendorProduct', purchaseVendorProductSchema);

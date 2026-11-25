const mongoose = require('mongoose');

const brandSaleSchema = new mongoose.Schema({
  title:                { type: String, required: true, trim: true, maxlength: 191 },
  storeIds:             [{ type: mongoose.Schema.Types.ObjectId, ref: 'Store' }], // null = all stores
  brands:               [{ type: String, trim: true }],
  discountType:         { type: String, enum: ['percent', 'amount'], required: true },
  discount:             { type: Number, required: true, min: 0 },
  applyOn:              { type: String, enum: ['selling', 'mrp'], default: 'selling' },
  protectPurchasePrice: { type: Boolean, default: false },
  startAt:              { type: Date, required: true },
  endAt:                { type: Date, required: true },
  isActive:             { type: Boolean, default: true },
  createdBy:            { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

brandSaleSchema.index({ isActive: 1, startAt: 1, endAt: 1 });

module.exports = mongoose.models.BrandSale || mongoose.model('BrandSale', brandSaleSchema);

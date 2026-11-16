const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  title:          { type: String, required: true },
  code:           { type: String, required: true, unique: true, uppercase: true, trim: true },
  startDate:      { type: Date, required: true },
  expireDate:     { type: Date, required: true },
  minPurchase:    { type: Number, default: 0 },
  maxDiscount:    { type: Number, default: 0 },
  discount:       { type: Number, required: true },
  discountType:   { type: String, enum: ['percent', 'amount'], default: 'percent' },
  couponType:     { type: String, enum: ['default', 'first_order', 'free_delivery'], default: 'default' },
  limit:          { type: Number, default: 0 },
  usedCount:      { type: Number, default: 0 },
  moduleId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
  storeId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  status:         { type: Boolean, default: true },
}, { timestamps: true });

couponSchema.index({ code: 1 });
couponSchema.index({ moduleId: 1, status: 1 });

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);

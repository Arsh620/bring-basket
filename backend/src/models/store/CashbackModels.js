const mongoose = require('mongoose');

const cashbackSchema = new mongoose.Schema({
  title:          { type: String, required: true, trim: true },
  cashbackType:   { type: String, enum: ['percentage', 'fixed'], required: true },
  cashbackAmount: { type: Number, required: true, min: 0 },
  minPurchase:    { type: Number, default: 0 },
  maxDiscount:    { type: Number, default: 0 },
  sameUserLimit:  { type: Number, default: 0 },
  totalUsed:      { type: Number, default: 0 },
  startDate:      { type: Date },
  endDate:        { type: Date },
  status:         { type: Boolean, default: true },
}, { timestamps: true });

cashbackSchema.index({ status: 1 });

const cashbackHistorySchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  cashbackId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cashback' },
  amount:     { type: Number, required: true, min: 0 },
  type:       { type: String, enum: ['cashback', 'refund_cashback'], default: 'cashback' },
}, { timestamps: true });

cashbackHistorySchema.index({ userId: 1 });
cashbackHistorySchema.index({ orderId: 1 });

const Cashback        = mongoose.models.Cashback        || mongoose.model('Cashback', cashbackSchema);
const CashbackHistory = mongoose.models.CashbackHistory || mongoose.model('CashbackHistory', cashbackHistorySchema);

module.exports = { Cashback, CashbackHistory };

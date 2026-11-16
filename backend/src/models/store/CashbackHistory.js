const mongoose = require('mongoose');

const cashbackHistorySchema = new mongoose.Schema({
  cashbackId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Cashback' },
  orderId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cashbackType:     { type: String, required: true },
  calculatedAmount: { type: Number, required: true },
  cashbackAmount:   { type: Number, required: true },
  minPurchase:      { type: Number, default: 0 },
  maxDiscount:      { type: Number, default: 0 },
}, { timestamps: true });

cashbackHistorySchema.index({ userId: 1, createdAt: -1 });
cashbackHistorySchema.index({ orderId: 1 });

module.exports = mongoose.models.CashbackHistory || mongoose.model('CashbackHistory', cashbackHistorySchema);

const mongoose = require('mongoose');

const dmWalletTransactionSchema = new mongoose.Schema({
  dmId:          { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryMan', required: true },
  type:          { type: String, enum: ['credit', 'debit'], required: true },
  amount:        { type: Number, required: true },
  balance:       { type: Number, required: true },
  reference:     { type: String },
  referenceType: { type: String, enum: ['order_earning', 'cash_collected', 'disbursement', 'admin', 'adjustment'] },
  orderId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  note:          { type: String },
}, { timestamps: true });

dmWalletTransactionSchema.index({ dmId: 1, createdAt: -1 });

module.exports = mongoose.models.DMWalletTransaction
  || mongoose.model('DMWalletTransaction', dmWalletTransactionSchema);

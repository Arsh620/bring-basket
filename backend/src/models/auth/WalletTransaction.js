const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:         { type: String, enum: ['credit', 'debit'], required: true },
  amount:       { type: Number, required: true },
  balance:      { type: Number, required: true },
  reference:    { type: String },
  referenceType:{ type: String, enum: ['order', 'refund', 'admin', 'bonus', 'loyalty_convert'] },
  note:         { type: String },
}, { timestamps: true });

walletTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', walletTransactionSchema);

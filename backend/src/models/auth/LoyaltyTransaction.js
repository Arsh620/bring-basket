const mongoose = require('mongoose');

const loyaltyTransactionSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:            { type: String, enum: ['credit', 'debit'], required: true },
  points:          { type: Number, required: true },
  balance:         { type: Number, required: true },
  transactionType: { type: String, enum: ['order_earn', 'order_redeem', 'admin_credit', 'admin_debit', 'convert_to_wallet', 'expire'], required: true },
  reference:       { type: String },
  referenceId:     { type: mongoose.Schema.Types.ObjectId },
  note:            { type: String },
}, { timestamps: true });

loyaltyTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.LoyaltyTransaction || mongoose.model('LoyaltyTransaction', loyaltyTransactionSchema);

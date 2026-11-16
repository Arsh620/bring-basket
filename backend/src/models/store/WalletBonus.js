const mongoose = require('mongoose');

const walletBonusSchema = new mongoose.Schema({
  title:              { type: String, required: true, trim: true },
  description:        { type: String },
  bonusType:          { type: String, enum: ['percentage', 'fixed'], required: true },
  bonusAmount:        { type: Number, required: true, min: 0 },
  minimumAddAmount:   { type: Number, default: 0 },
  maximumBonusAmount: { type: Number, default: 0 },
  startDate:          { type: Date },
  endDate:            { type: Date },
  status:             { type: Boolean, default: true },
}, { timestamps: true });

walletBonusSchema.index({ status: 1 });

module.exports = mongoose.models.WalletBonus || mongoose.model('WalletBonus', walletBonusSchema);

const mongoose = require('mongoose');

const storeWalletSchema = new mongoose.Schema({
  vendorId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, unique: true },
  totalEarning:    { type: Number, default: 0 },
  totalWithdrawn:  { type: Number, default: 0 },
  pendingWithdraw: { type: Number, default: 0 },
  collectedCash:   { type: Number, default: 0 },
}, { timestamps: true });

storeWalletSchema.virtual('balance').get(function () {
  if (this.totalEarning <= 0) return 0;
  return Number((this.totalEarning - (this.totalWithdrawn + this.pendingWithdraw + this.collectedCash)).toFixed(2));
});

module.exports = mongoose.models.StoreWallet || mongoose.model('StoreWallet', storeWalletSchema);

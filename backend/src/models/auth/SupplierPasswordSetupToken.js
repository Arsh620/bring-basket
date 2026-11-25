const mongoose = require('mongoose');

const supplierPasswordSetupTokenSchema = new mongoose.Schema({
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseVendor',
    required: true,
    unique: true,
  },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

supplierPasswordSetupTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.SupplierPasswordSetupToken
  || mongoose.model('SupplierPasswordSetupToken', supplierPasswordSetupTokenSchema);

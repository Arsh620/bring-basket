const mongoose = require('mongoose');

const withdrawRequestSchema = new mongoose.Schema({
  vendorId:               { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  amount:                 { type: Number, required: true, min: 0 },
  withdrawalMethodId:     { type: mongoose.Schema.Types.ObjectId, ref: 'WithdrawalMethod' },
  withdrawalMethodFields: { type: mongoose.Schema.Types.Mixed },
  approved:               { type: Number, default: 0 }, // 0=pending, 1=approved, 2=denied
  transactionNote:        { type: String, trim: true },
  type:                   { type: String, enum: ['manual', 'disbursement'], default: 'manual' },
}, { timestamps: true });

withdrawRequestSchema.index({ vendorId: 1, createdAt: -1 });

module.exports = mongoose.models.WithdrawRequest || mongoose.model('WithdrawRequest', withdrawRequestSchema);

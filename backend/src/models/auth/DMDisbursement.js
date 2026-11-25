const mongoose = require('mongoose');

const dmDisbursementSchema = new mongoose.Schema({
  dmId:      { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryMan', required: true },
  amount:    { type: Number, required: true, min: 0 },
  method:    { type: String, enum: ['cash', 'bank_transfer', 'upi'], default: 'cash' },
  note:      { type: String, trim: true, maxlength: 500 },
  paidBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  status:    { type: String, enum: ['paid'], default: 'paid' },
}, { timestamps: true });

dmDisbursementSchema.index({ dmId: 1, createdAt: -1 });

module.exports = mongoose.models.DMDisbursement || mongoose.model('DMDisbursement', dmDisbursementSchema);

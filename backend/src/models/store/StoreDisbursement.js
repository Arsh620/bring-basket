const mongoose = require('mongoose');

const storeDisbursementSchema = new mongoose.Schema({
  title:       { type: String, trim: true },
  totalAmount: { type: Number, default: 0 },
  createdFor:  { type: String, default: 'store' },
  status:      { type: String, enum: ['pending', 'completed', 'canceled', 'partially_completed'], default: 'pending' },
}, { timestamps: true });

const disbursementDetailSchema = new mongoose.Schema({
  disbursementId:     { type: mongoose.Schema.Types.ObjectId, ref: 'StoreDisbursement', required: true },
  storeId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  vendorId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  disbursementAmount: { type: Number, required: true, min: 0 },
  paymentMethodId:    { type: mongoose.Schema.Types.ObjectId, ref: 'WithdrawalMethod' },
  status:             { type: String, enum: ['pending', 'completed', 'canceled'], default: 'pending' },
}, { timestamps: true });

disbursementDetailSchema.index({ disbursementId: 1, storeId: 1 });

module.exports = {
  StoreDisbursement:  mongoose.models.StoreDisbursement  || mongoose.model('StoreDisbursement',  storeDisbursementSchema),
  DisbursementDetail: mongoose.models.DisbursementDetail || mongoose.model('DisbursementDetail', disbursementDetailSchema),
};

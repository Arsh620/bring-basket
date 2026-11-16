const mongoose = require('mongoose');

const cashbackSchema = new mongoose.Schema({
  title:          { type: String, required: true, trim: true },
  cashbackType:   { type: String, enum: ['percentage', 'fixed'], required: true },
  cashbackAmount: { type: Number, required: true, min: 0 },
  minPurchase:    { type: Number, default: 0 },
  maxDiscount:    { type: Number, default: 0 },
  sameUserLimit:  { type: Number, default: 1 },
  totalUsed:      { type: Number, default: 0 },
  startDate:      { type: Date },
  endDate:        { type: Date },
  status:         { type: Boolean, default: true },
  moduleId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
}, { timestamps: true });

cashbackSchema.index({ status: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.models.Cashback || mongoose.model('Cashback', cashbackSchema);

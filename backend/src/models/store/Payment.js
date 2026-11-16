const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Who paid
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userType: { type: String, enum: ['customer'], default: 'customer' },

  // What for
  purpose: { type: String, enum: ['order', 'wallet_topup'], required: true },
  referenceId: { type: String }, // orderId or 'wallet'

  // Razorpay IDs
  razorpayOrderId: { type: String, required: true, unique: true },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },

  // Amount
  amount: { type: Number, required: true }, // in INR (not paise)
  currency: { type: String, default: 'INR' },

  // Status
  status: {
    type: String,
    enum: ['created', 'paid', 'failed', 'refunded'],
    default: 'created',
  },

  // Refund
  refundId: { type: String },
  refundAmount: { type: Number },
  refundedAt: { type: Date },

  failureReason: { type: String },
}, { timestamps: true });

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ referenceId: 1 });

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

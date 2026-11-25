const mongoose = require('mongoose');

const orderLineSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  itemName: { type: String, required: true },
  image: { type: String },
  variant: { type: String, default: '' },
  variations: { type: mongoose.Schema.Types.Mixed, default: [] },
  addOns: { type: mongoose.Schema.Types.Mixed, default: [] },
  addOnTotal: { type: Number, default: 0, min: 0 },
  offerLabel: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 0.001 },
  unitPrice: { type: Number, required: true, min: 0 },
  discountAmount: { type: Number, default: 0, min: 0 },
  taxAmount: { type: Number, default: 0, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  legacyId: { type: Number, select: false },
  ownerId: { type: String, required: true },
  isGuest: { type: Boolean, required: true },
  idempotencyKey: { type: String },
  requestHash: { type: String },
  requestedStoreId: { type: String },
  moduleId: { type: String, required: true },
  storeId: { type: String, required: true },
  zoneId: { type: String },
  storeName: { type: String, required: true },
  orderType: { type: String, enum: ['delivery', 'take_away', 'pos'], required: true },
  orderStatus: {
    type: String,
    enum: ['stock_pending', 'pending', 'accepted', 'confirmed', 'processing', 'handover', 'picked_up', 'delivered', 'canceling', 'canceled', 'failed', 'refund_requested', 'refunded'],
    required: true,
    default: 'stock_pending',
  },
  deliverymanId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryMan', default: null },
  couponCode: { type: String },
  couponDiscount: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['cash_on_delivery', 'wallet', 'digital_payment', 'cash', 'razor_pay', 'pine_labs', 'offline_payment'], required: true },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'partially_paid'], required: true, default: 'unpaid' },
  currency: { type: String, default: 'INR' },
  items: { type: [orderLineSchema], required: true },
  itemSubtotal: { type: Number, required: true, min: 0 },
  itemDiscount: { type: Number, required: true, min: 0, default: 0 },
  taxAmount: { type: Number, required: true, min: 0, default: 0 },
  deliveryCharge: { type: Number, required: true, min: 0, default: 0 },
  dmTips: { type: Number, min: 0, default: 0 },
  distanceKm: { type: Number, default: 0 },
  orderAmount: { type: Number, required: true, min: 0 },
  deliveryAddress: { type: mongoose.Schema.Types.Mixed, default: null },
  orderNote: { type: String, maxlength: 1000 },
  stockReserved: { type: Boolean, default: false },
  cancellationReason: { type: String, maxlength: 255 },
  pendingAt: { type: Date },
  acceptedAt: { type: Date },
  processingAt: { type: Date },
  handoverAt: { type: Date },
  pickedUpAt: { type: Date },
  canceledAt: { type: Date },
  failedAt: { type: Date },
  deliveredAt: { type: Date },
  confirmedAt: { type: Date },
  refundRequestedAt: { type: Date },
  refundedAt: { type: Date },
  failedReason: { type: String, maxlength: 500 },
  refundStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
  refundReason: { type: String, maxlength: 500 },
  refundAmount: { type: Number, min: 0 },
  refundReviewNote: { type: String, maxlength: 500 },
  refundReviewedAt: { type: Date },
  refundMethod: { type: String, enum: ['wallet'] },
}, { timestamps: true, collection: 'orders' });

orderSchema.index(
  { ownerId: 1, isGuest: 1, moduleId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
orderSchema.index({ ownerId: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ moduleId: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, deliveredAt: -1 });
orderSchema.index({ deliverymanId: 1, orderStatus: 1 });
orderSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

// Use a dedicated name so legacy Order registrations cannot shadow this schema.
module.exports = mongoose.models.OrderDomain || mongoose.model('OrderDomain', orderSchema);

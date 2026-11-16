const mongoose = require('mongoose');

const orderLineSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  itemName: { type: String, required: true },
  image: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  discountAmount: { type: Number, default: 0, min: 0 },
  taxAmount: { type: Number, default: 0, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  ownerId: { type: String, required: true },
  isGuest: { type: Boolean, required: true },
  idempotencyKey: { type: String },
  requestHash: { type: String },
  requestedStoreId: { type: String },
  moduleId: { type: String, required: true },
  storeId: { type: String, required: true },
  storeName: { type: String, required: true },
  orderType: { type: String, enum: ['delivery', 'take_away'], required: true },
  orderStatus: {
    type: String,
    enum: ['stock_pending', 'pending', 'confirmed', 'processing', 'handover', 'picked_up', 'delivered', 'canceling', 'canceled', 'failed'],
    required: true,
    default: 'stock_pending',
  },
  deliverymanId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryMan', default: null },
  couponCode: { type: String },
  couponDiscount: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['cash_on_delivery', 'wallet', 'digital_payment'], required: true },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'partially_paid'], required: true, default: 'unpaid' },
  currency: { type: String, default: 'INR' },
  items: { type: [orderLineSchema], required: true },
  itemSubtotal: { type: Number, required: true, min: 0 },
  itemDiscount: { type: Number, required: true, min: 0, default: 0 },
  taxAmount: { type: Number, required: true, min: 0, default: 0 },
  deliveryCharge: { type: Number, required: true, min: 0, default: 0 },
  distanceKm: { type: Number, default: 0 },
  orderAmount: { type: Number, required: true, min: 0 },
  deliveryAddress: { type: mongoose.Schema.Types.Mixed, default: null },
  orderNote: { type: String, maxlength: 1000 },
  stockReserved: { type: Boolean, default: false },
  cancellationReason: { type: String, maxlength: 255 },
  pendingAt: { type: Date },
  canceledAt: { type: Date },
  deliveredAt: { type: Date },
  confirmedAt: { type: Date },
  failedReason: { type: String, maxlength: 500 },
  refundStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
  refundReason: { type: String, maxlength: 500 },
}, { timestamps: true, collection: 'orders' });

orderSchema.index(
  { ownerId: 1, isGuest: 1, moduleId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
orderSchema.index({ ownerId: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, createdAt: -1 });
orderSchema.index({ deliverymanId: 1, orderStatus: 1 });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);

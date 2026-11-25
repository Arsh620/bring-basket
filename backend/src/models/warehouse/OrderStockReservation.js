const mongoose = require('mongoose');

const orderStockReservationSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  status: { type: String, enum: ['reserved', 'committed', 'released'], required: true },
  items: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    variant: { type: String, default: '' },
    qty: { type: Number, required: true, min: 0.0001 },
    batchTracked: { type: Boolean, default: false },
    allocations: [{
      batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemBatch' },
      batchCode: { type: String },
      expiryDate: { type: Date, default: null },
      qty: { type: Number, min: 0.0001 },
    }],
  }],
  committedAt: { type: Date },
  releasedAt: { type: Date },
}, { timestamps: true });

orderStockReservationSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.models.OrderStockReservation
  || mongoose.model('OrderStockReservation', orderStockReservationSchema);

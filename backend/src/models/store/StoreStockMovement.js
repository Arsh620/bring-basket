const mongoose = require('mongoose');

const storeStockMovementSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  variant: { type: String, default: '' },
  qtyChange: { type: Number, required: true },
  balanceAfter: { type: Number },
  type: { type: String, required: true, maxlength: 40 },
  referenceType: { type: String, maxlength: 60 },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceNo: { type: String, maxlength: 100 },
  note: { type: String, maxlength: 255 },
  actorType: { type: String, maxlength: 30 },
  actorId: { type: mongoose.Schema.Types.ObjectId },
  actorName: { type: String, maxlength: 120 },
  movedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: { createdAt: true, updatedAt: false } });

storeStockMovementSchema.index({ storeId: 1, movedAt: -1 });
storeStockMovementSchema.index({ itemId: 1, movedAt: -1 });
storeStockMovementSchema.index({ referenceType: 1, referenceId: 1 });

module.exports = mongoose.models.StoreStockMovement
  || mongoose.model('StoreStockMovement', storeStockMovementSchema);

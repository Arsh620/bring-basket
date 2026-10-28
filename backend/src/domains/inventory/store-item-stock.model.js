const mongoose = require('mongoose');

const storeItemStockSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  variant: { type: String, default: '', trim: true },
  qty: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true, collection: 'storeitemstocks' });

storeItemStockSchema.index({ storeId: 1, itemId: 1, variant: 1 }, { unique: true });
storeItemStockSchema.index({ storeId: 1, qty: 1 });
storeItemStockSchema.index({ itemId: 1 });

module.exports = mongoose.models.StoreItemStock
  || mongoose.model('StoreItemStock', storeItemStockSchema);

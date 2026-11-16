const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  ownerId: { type: String, required: true },
  isGuest: { type: Boolean, required: true },
  moduleId: { type: String, required: true },
  itemId: { type: String, required: true },
  itemType: { type: String, enum: ['Item'], required: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  addOnIds: { type: [mongoose.Schema.Types.Mixed], default: [] },
  addOnQtys: { type: [mongoose.Schema.Types.Mixed], default: [] },
  variation: { type: mongoose.Schema.Types.Mixed, default: [] },
  variationKey: { type: String, required: true },
}, { timestamps: true, collection: 'carts' });

cartSchema.index(
  { ownerId: 1, isGuest: 1, moduleId: 1, itemId: 1, itemType: 1, variationKey: 1 },
  { unique: true },
);
cartSchema.index({ ownerId: 1, isGuest: 1, moduleId: 1, createdAt: 1 });

module.exports = mongoose.models.Cart || mongoose.model('Cart', cartSchema);

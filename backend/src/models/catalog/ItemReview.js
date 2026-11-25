const mongoose = require('mongoose');

const itemReviewSchema = new mongoose.Schema({
  itemId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  rating:   { type: Number, required: true, min: 1, max: 5 },
  comment:  { type: String, trim: true, maxlength: 1000 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

itemReviewSchema.index({ itemId: 1, createdAt: -1 });
itemReviewSchema.index({ orderId: 1, userId: 1, itemId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.ItemReview || mongoose.model('ItemReview', itemReviewSchema);

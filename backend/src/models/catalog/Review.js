const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  orderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  moduleId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  comment:   { type: String, maxlength: 1000 },
  attachment:{ type: String },
  status:    { type: Boolean, default: true },
}, { timestamps: true });

reviewSchema.index({ itemId: 1, status: 1 });
reviewSchema.index({ userId: 1, itemId: 1, orderId: 1 }, { unique: true });

module.exports = mongoose.models.Review || mongoose.model('Review', reviewSchema);

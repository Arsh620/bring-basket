const mongoose = require('mongoose');

const dmReviewSchema = new mongoose.Schema({
  dmId:      { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryMan', required: true },
  orderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  comment:   { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });

dmReviewSchema.index({ dmId: 1, createdAt: -1 });
dmReviewSchema.index({ orderId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.DMReview || mongoose.model('DMReview', dmReviewSchema);

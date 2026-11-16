const mongoose = require('mongoose');

const flashSaleSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate:   { type: Date, required: true },
  moduleId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
  status:    { type: Boolean, default: true },
  items: [{
    itemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    discount:     { type: Number, required: true },
    discountType: { type: String, enum: ['percent', 'amount'], default: 'percent' },
    stock:        { type: Number, default: 0 },
  }],
}, { timestamps: true });

module.exports = mongoose.models.FlashSale || mongoose.model('FlashSale', flashSaleSchema);

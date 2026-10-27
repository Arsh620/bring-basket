const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  name:                         { type: String, required: true, unique: true, trim: true },
  displayName:                  { type: String },
  coordinates:                  { type: mongoose.Schema.Types.Mixed, required: true },
  state:                        { type: String },
  status:                       { type: Boolean, default: true },
  cashOnDelivery:               { type: Boolean, default: false },
  digitalPayment:               { type: Boolean, default: false },
  offlinePayment:               { type: Boolean, default: false },
  increasedDeliveryFee:         { type: Number, default: 0 },
  increasedDeliveryFeeStatus:   { type: Boolean, default: false },
  increaseDeliveryChargeMessage:{ type: String },
  storeWiseTopic:               { type: String },
  customerWiseTopic:            { type: String },
  deliverymanWiseTopic:         { type: String },
}, { timestamps: true });

zoneSchema.index({ state: 1 });

module.exports = mongoose.models.Zone || mongoose.model('Zone', zoneSchema);

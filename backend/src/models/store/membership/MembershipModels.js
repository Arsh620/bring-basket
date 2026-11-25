const mongoose = require('mongoose');

const membershipPlanSchema = new mongoose.Schema({
  name:                   { type: String, required: true, trim: true },
  tier:                   { type: String, enum: ['silver', 'gold'], required: true },
  billingCycle:           { type: String, enum: ['monthly', 'annual'], required: true },
  price:                  { type: Number, required: true, min: 0 },
  savingsText:            { type: String },
  features:               [{ type: String }],
  badge:                  { type: String },
  minOrderValue:          { type: Number, default: 0 },
  minMonthlyCartValue:    { type: Number, default: 0 },
  walletRedemptionPercent:{ type: Number, default: 3 },
  loyaltyPointMinimum:    { type: Number, default: 0 },
  pointExchangeRate:      { type: Number, default: 1 },
  status:                 { type: Boolean, default: true },
}, { timestamps: true });

const customerSubscriptionSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  membershipPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },
  tier:             { type: String, enum: ['silver', 'gold'], required: true },
  billingCycle:     { type: String, enum: ['monthly', 'annual'], required: true },
  pricePaid:        { type: Number, default: 0 },
  startDate:        { type: Date, required: true },
  endDate:          { type: Date, required: true },
  status:           { type: String, enum: ['active', 'cancelled', 'expired', 'upgraded'], default: 'active' },
  purchasedVia:     { type: String, enum: ['pos', 'online', 'admin'], default: 'online' },
  orderId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
}, { timestamps: true });

customerSubscriptionSchema.index({ userId: 1, status: 1 });
customerSubscriptionSchema.index({ endDate: 1 });

const MembershipPlan         = mongoose.models.MembershipPlan         || mongoose.model('MembershipPlan', membershipPlanSchema);
const CustomerSubscription   = mongoose.models.CustomerSubscription   || mongoose.model('CustomerSubscription', customerSubscriptionSchema);

module.exports = { MembershipPlan, CustomerSubscription };

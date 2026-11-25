const mongoose = require('mongoose');

const orderCancelReasonSchema = new mongoose.Schema({
  reason:   { type: String, required: true, trim: true, maxlength: 255 },
  userType: { type: String, enum: ['customer', 'vendor', 'admin', 'deliveryman'], required: true },
  status:   { type: Boolean, default: true },
}, { timestamps: true });

const activityLogSchema = new mongoose.Schema({
  action:      { type: String, required: true, trim: true },
  subjectType: { type: String, trim: true },
  subjectId:   { type: String, trim: true },
  actorType:   { type: String, enum: ['admin', 'vendor', 'supplier', 'warehouse', 'system'], default: 'admin' },
  actorId:     { type: mongoose.Schema.Types.ObjectId },
  actorName:   { type: String, trim: true },
  attributes:  { type: mongoose.Schema.Types.Mixed },
  note:        { type: String, trim: true },
}, { timestamps: true });

activityLogSchema.index({ subjectType: 1, subjectId: 1, createdAt: -1 });
activityLogSchema.index({ actorId: 1, createdAt: -1 });

module.exports = {
  OrderCancelReason: mongoose.models.OrderCancelReason || mongoose.model('OrderCancelReason', orderCancelReasonSchema),
  ActivityLog:       mongoose.models.ActivityLog       || mongoose.model('ActivityLog',       activityLogSchema),
};

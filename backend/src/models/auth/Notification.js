const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId },
  userType:   { type: String, enum: ['customer', 'deliveryman', 'vendor', 'admin'] },
  title:      { type: String, required: true },
  description:{ type: String },
  image:      { type: String },
  type:       { type: String, default: 'general' },
  data:       { type: mongoose.Schema.Types.Mixed },
  isRead:     { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

const mongoose = require('mongoose');

// ── Push Notification Template ────────────────────────────────────────────────
const pushNotificationSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  image:       { type: String, trim: true },
  topic:       { type: String, enum: ['all', 'customer', 'deliveryman', 'vendor', 'zone'], default: 'all' },
  zoneId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
  status:      { type: Boolean, default: true },
  sentAt:      { type: Date },
}, { timestamps: true });

// ── Automated Message ─────────────────────────────────────────────────────────
const automatedMessageSchema = new mongoose.Schema({
  message: { type: String, required: true, trim: true, maxlength: 255 },
  status:  { type: Boolean, default: true },
}, { timestamps: true });

// ── Conversation ──────────────────────────────────────────────────────────────
const conversationSchema = new mongoose.Schema({
  senderId:          { type: mongoose.Schema.Types.ObjectId },
  senderType:        { type: String, enum: ['admin', 'customer', 'vendor'], default: 'customer' },
  receiverId:        { type: mongoose.Schema.Types.ObjectId },
  receiverType:      { type: String, enum: ['admin', 'customer', 'vendor'], default: 'admin' },
  lastMessageId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  lastMessageTime:   { type: Date, default: Date.now },
  unreadCount:       { type: Number, default: 0 },
}, { timestamps: true });

conversationSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });
conversationSchema.index({ lastMessageTime: -1 });

// ── Message ───────────────────────────────────────────────────────────────────
const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderId:       { type: mongoose.Schema.Types.ObjectId, required: true },
  senderType:     { type: String, enum: ['admin', 'customer', 'vendor'], required: true },
  message:        { type: String, trim: true },
  files:          [{ type: String }],
  isSeen:         { type: Boolean, default: false },
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = {
  PushNotification:  mongoose.models.PushNotification  || mongoose.model('PushNotification',  pushNotificationSchema),
  AutomatedMessage:  mongoose.models.AutomatedMessage  || mongoose.model('AutomatedMessage',  automatedMessageSchema),
  Conversation:      mongoose.models.Conversation      || mongoose.model('Conversation',      conversationSchema),
  Message:           mongoose.models.Message           || mongoose.model('Message',           messageSchema),
};

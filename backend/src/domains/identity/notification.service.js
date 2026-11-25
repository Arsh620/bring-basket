const Notification = require('../../models/auth/Notification');
const { PushNotification, AutomatedMessage } = require('../../models/store/NotificationModels');
const fcm = require('../../services/fcm.service');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

// ── In-app notification ───────────────────────────────────────────────────────
const send = async ({ userId, userType, title, description, type = 'general', data, image }) => {
  try {
    return await Notification.create({ userId, userType, title, description, type, data, image });
  } catch (_) { /* non-blocking */ }
};

// ── Send push + in-app to a user ──────────────────────────────────────────────
const sendToUser = async (userId, userType, payload) => {
  await send({ userId, userType, ...payload });

  // Get FCM token based on userType
  try {
    let fcmToken;
    if (userType === 'customer') {
      const User = require('../../models/auth/User');
      const u = await User.findById(userId).select('fcmToken').lean();
      fcmToken = u?.fcmToken;
    } else if (userType === 'deliveryman') {
      const DM = require('../../models/auth/DeliveryMan');
      const d = await DM.findById(userId).select('fcmToken').lean();
      fcmToken = d?.fcmToken;
    } else if (userType === 'vendor') {
      const Vendor = require('../../models/auth/Vendor');
      const v = await Vendor.findById(userId).select('fcmToken').lean();
      fcmToken = v?.fcmToken;
    }
    if (fcmToken) {
      await fcm.sendToDevice(fcmToken, { title: payload.title, body: payload.description, image: payload.image, data: payload.data || {} });
    }
  } catch (_) { /* non-blocking */ }
};

// ── Order event notifications ─────────────────────────────────────────────────
const notifyOrderStatus = async (order) => {
  const statusMessages = {
    confirmed:  { title: 'Order Confirmed', description: `Your order ${order.orderNumber} has been confirmed.` },
    processing: { title: 'Order Processing', description: `Your order ${order.orderNumber} is being prepared.` },
    handover:   { title: 'Order Ready', description: `Your order ${order.orderNumber} is ready for pickup.` },
    picked_up:  { title: 'Order Picked Up', description: `Your order ${order.orderNumber} is on the way!` },
    delivered:  { title: 'Order Delivered', description: `Your order ${order.orderNumber} has been delivered. Enjoy!` },
    canceled:   { title: 'Order Canceled', description: `Your order ${order.orderNumber} has been canceled.` },
  };
  const msg = statusMessages[order.orderStatus];
  if (!msg || !order.ownerId || order.isGuest) return;
  await sendToUser(order.ownerId, 'customer', { ...msg, type: 'order', data: { orderId: String(order._id), status: order.orderStatus } });
};

// ── Broadcast ─────────────────────────────────────────────────────────────────
const broadcast = async ({ title, description, image, topic = 'all' }) => {
  if (!title) throw new AppError('title is required', 400);

  // Save push notification record
  const notif = await PushNotification.create({ title, description, image, topic, sentAt: new Date() });

  // Send FCM to topic
  await fcm.sendToTopic(topic, { title, body: description, image });

  // Also save in-app for all users if topic is customer/all
  if (topic === 'all' || topic === 'customer') {
    const User = require('../../models/auth/User');
    const users = await User.find({ status: true }).select('_id').lean();
    if (users.length <= 1000) {
      await Notification.insertMany(users.map((u) => ({ userId: u._id, userType: 'customer', title, description, image, type: 'broadcast' })));
    }
  }
  if (topic === 'all' || topic === 'deliveryman') {
    const DM = require('../../models/auth/DeliveryMan');
    const dms = await DM.find({ status: true }).select('_id').lean();
    if (dms.length <= 1000) {
      await Notification.insertMany(dms.map((d) => ({ userId: d._id, userType: 'deliveryman', title, description, image, type: 'broadcast' })));
    }
  }

  return notif;
};

// ── Push Notification Templates CRUD ─────────────────────────────────────────
const getPushNotifications = async (query = {}) => {
  const { skip, page, limit } = paginate(query);
  const [notifications, total] = await Promise.all([
    PushNotification.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    PushNotification.countDocuments(),
  ]);
  return { notifications, total, page, limit, pages: Math.ceil(total / limit) };
};

const createPushNotification = async (body) => {
  if (!body.title?.trim()) throw new AppError('title is required', 400);
  return PushNotification.create({ title: body.title.trim(), description: body.description, image: body.image, topic: body.topic || 'all', zoneId: body.zoneId });
};

const updatePushNotification = async (id, body) => {
  const n = await PushNotification.findByIdAndUpdate(id, body, { new: true });
  if (!n) throw new AppError('Notification not found', 404);
  return n;
};

const sendPushNotification = async (id) => {
  const n = await PushNotification.findById(id);
  if (!n) throw new AppError('Notification not found', 404);
  await fcm.sendToTopic(n.topic || 'all', { title: n.title, body: n.description, image: n.image });
  n.sentAt = new Date();
  await n.save();
  return n;
};

const removePushNotification = async (id) => {
  const n = await PushNotification.findByIdAndDelete(id);
  if (!n) throw new AppError('Notification not found', 404);
};

// ── Automated Messages CRUD ───────────────────────────────────────────────────
const getAutomatedMessages = () => AutomatedMessage.find().sort({ createdAt: -1 });

const createAutomatedMessage = async (body) => {
  if (!body.message?.trim()) throw new AppError('message is required', 400);
  return AutomatedMessage.create({ message: body.message.trim() });
};

const updateAutomatedMessage = async (id, body) => {
  const m = await AutomatedMessage.findByIdAndUpdate(id, body, { new: true });
  if (!m) throw new AppError('Automated message not found', 404);
  return m;
};

const toggleAutomatedMessage = async (id) => {
  const m = await AutomatedMessage.findById(id);
  if (!m) throw new AppError('Automated message not found', 404);
  m.status = !m.status;
  await m.save();
  return m;
};

const removeAutomatedMessage = async (id) => {
  const m = await AutomatedMessage.findByIdAndDelete(id);
  if (!m) throw new AppError('Automated message not found', 404);
};

module.exports = {
  send, sendToUser, notifyOrderStatus, broadcast,
  getPushNotifications, createPushNotification, updatePushNotification, sendPushNotification, removePushNotification,
  getAutomatedMessages, createAutomatedMessage, updateAutomatedMessage, toggleAutomatedMessage, removeAutomatedMessage,
};

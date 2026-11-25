const notifSvc = require('./notification.service');
const convSvc = require('./conversation.service');
const { success } = require('../../utils/response');

const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

const pg = (res, result, key) => res.json({
  success: true, data: result[key],
  pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages },
});

// ── Push Notification Templates (Admin) ───────────────────────────────────────
exports.getPushNotifications   = run(async (req, res) => pg(res, await notifSvc.getPushNotifications(req.query), 'notifications'));
exports.createPushNotification = run(async (req, res) => success(res, await notifSvc.createPushNotification(req.body), 'Created', 201));
exports.updatePushNotification = run(async (req, res) => success(res, await notifSvc.updatePushNotification(req.params.id, req.body), 'Updated'));
exports.sendPushNotification   = run(async (req, res) => success(res, await notifSvc.sendPushNotification(req.params.id), 'Sent'));
exports.removePushNotification = run(async (req, res) => { await notifSvc.removePushNotification(req.params.id); success(res, null, 'Deleted'); });

// ── Broadcast (Admin) ─────────────────────────────────────────────────────────
exports.adminBroadcast = run(async (req, res) => success(res, await notifSvc.broadcast(req.body), 'Broadcast sent'));

// ── Automated Messages (Admin) ────────────────────────────────────────────────
exports.getAutomatedMessages   = run(async (req, res) => success(res, await notifSvc.getAutomatedMessages()));
exports.createAutomatedMessage = run(async (req, res) => success(res, await notifSvc.createAutomatedMessage(req.body), 'Created', 201));
exports.updateAutomatedMessage = run(async (req, res) => success(res, await notifSvc.updateAutomatedMessage(req.params.id, req.body), 'Updated'));
exports.toggleAutomatedMessage = run(async (req, res) => success(res, await notifSvc.toggleAutomatedMessage(req.params.id), 'Status toggled'));
exports.removeAutomatedMessage = run(async (req, res) => { await notifSvc.removeAutomatedMessage(req.params.id); success(res, null, 'Deleted'); });

// ── Conversations (Admin) ─────────────────────────────────────────────────────
exports.adminGetConversations = run(async (req, res) => pg(res, await convSvc.getConversations(req.admin._id, 'admin', req.query), 'conversations'));
exports.adminGetMessages      = run(async (req, res) => pg(res, await convSvc.getMessages(req.params.id, req.admin._id, 'admin', req.query), 'messages'));
exports.adminSendMessage      = run(async (req, res) => {
  const msg = await convSvc.sendMessage(req.admin._id, 'admin', req.body.receiverId, req.body.receiverType || 'customer', req.body);
  success(res, msg, 'Message sent', 201);
});

// ── Conversations (Customer) ──────────────────────────────────────────────────
exports.customerGetConversations = run(async (req, res) => pg(res, await convSvc.getConversations(req.user.id, 'customer', req.query), 'conversations'));
exports.customerGetMessages      = run(async (req, res) => pg(res, await convSvc.getMessages(req.params.id, req.user.id, 'customer', req.query), 'messages'));
exports.customerSendMessage      = run(async (req, res) => {
  const Admin = require('../../models/auth/Admin');
  const admin = await Admin.findOne({ legacyId: 1 }).select('_id').lean();
  const msg = await convSvc.sendMessage(req.user.id, 'customer', admin?._id, 'admin', req.body);
  success(res, msg, 'Message sent', 201);
});

// ── Vendor Notifications ──────────────────────────────────────────────────────
exports.vendorGetConversations = run(async (req, res) => pg(res, await convSvc.getConversations(req.vendor._id, 'vendor', req.query), 'conversations'));
exports.vendorGetMessages      = run(async (req, res) => pg(res, await convSvc.getMessages(req.params.id, req.vendor._id, 'vendor', req.query), 'messages'));
exports.vendorSendMessage      = run(async (req, res) => {
  const Admin = require('../../models/auth/Admin');
  const admin = await Admin.findOne({ legacyId: 1 }).select('_id').lean();
  const msg = await convSvc.sendMessage(req.vendor._id, 'vendor', admin?._id, 'admin', req.body);
  success(res, msg, 'Message sent', 201);
});

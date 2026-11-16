const Notification = require('../../models/auth/Notification');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

// GET /customer/notifications
exports.getCustomerNotifications = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const [notifications, total] = await Promise.all([
      Notification.find({ userId: req.user.id, userType: 'customer' }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments({ userId: req.user.id, userType: 'customer' }),
    ]);
    return paginated(res, notifications, total, page, limit);
  } catch (err) { next(err); }
};

// PUT /customer/notifications/:id/read
exports.markRead = async (req, res, next) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true },
      { new: true },
    );
    if (!notif) return error(res, 'Notification not found', 404);
    return success(res, notif);
  } catch (err) { next(err); }
};

// PUT /customer/notifications/read-all
exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });
    return success(res, null, 'All notifications marked as read');
  } catch (err) { next(err); }
};

// Internal helper - send notification (used by other services)
exports.sendNotification = async ({ userId, userType, title, description, type, data, image }) => {
  return Notification.create({ userId, userType, title, description, type, data, image });
};

// Admin - send to all
exports.adminBroadcast = async (req, res, next) => {
  try {
    const { title, description, image, userType } = req.body;
    if (!title) return error(res, 'title is required', 400);
    const User = require('../../models/auth/User');
    const DeliveryMan = require('../../models/auth/DeliveryMan');
    let users = [];
    if (!userType || userType === 'customer') {
      users = await User.find({ status: true }).select('_id').lean();
      await Notification.insertMany(users.map((u) => ({ userId: u._id, userType: 'customer', title, description, image, type: 'broadcast' })));
    }
    if (!userType || userType === 'deliveryman') {
      const dms = await DeliveryMan.find({ status: true }).select('_id').lean();
      await Notification.insertMany(dms.map((d) => ({ userId: d._id, userType: 'deliveryman', title, description, image, type: 'broadcast' })));
    }
    return success(res, null, 'Notification sent');
  } catch (err) { next(err); }
};

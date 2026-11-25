const mongoose = require('mongoose');
const DeliveryMan = require('../../models/auth/DeliveryMan');
const { orderModel } = require('../orders/order-data');
const { adminUpdateOrderStatus, assignDeliveryman } = require('../orders/order.service');
const Notification = require('../../models/auth/Notification');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');
const { generateToken } = require('../../middleware/auth');

// GET /deliveryman/profile
exports.getProfile = async (req, res, next) => {
  try {
    const dm = await DeliveryMan.findById(req.user.id).lean();
    if (!dm) return error(res, 'Not found', 404);
    return success(res, dm);
  } catch (err) { next(err); }
};

// PUT /deliveryman/update-profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { fName, lName, email, image, fcmToken } = req.body;
    const dm = await DeliveryMan.findByIdAndUpdate(
      req.user.id,
      { fName, lName, email, image, fcmToken },
      { new: true, runValidators: true },
    );
    return success(res, dm);
  } catch (err) { next(err); }
};

// POST /deliveryman/update-active-status  body: { active }
exports.updateActiveStatus = async (req, res, next) => {
  try {
    const dm = await DeliveryMan.findByIdAndUpdate(req.user.id, { active: req.body.active }, { new: true });
    return success(res, { active: dm.active });
  } catch (err) { next(err); }
};

// PUT /deliveryman/update-fcm-token  body: { fcm_token }
exports.updateFcmToken = async (req, res, next) => {
  try {
    if (!req.body.fcm_token) return error(res, 'fcm_token is required', 400);
    await DeliveryMan.findByIdAndUpdate(req.user.id, { fcmToken: req.body.fcm_token });
    return success(res, null, 'FCM token updated');
  } catch (err) { next(err); }
};

// GET /deliveryman/current-orders
exports.getCurrentOrders = async (req, res, next) => {
  try {
    const orders = await orderModel().find({
      deliverymanId: req.user.id,
      orderStatus: { $in: ['accepted', 'confirmed', 'processing', 'handover', 'picked_up'] },
    }).sort({ createdAt: -1 }).lean();
    return success(res, orders);
  } catch (err) { next(err); }
};

// GET /deliveryman/all-orders?limit=&page=
exports.getAllOrders = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const Order = orderModel();
    const filter = { deliverymanId: new mongoose.Types.ObjectId(req.user.id) };
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);
    return paginated(res, orders, total, page, limit);
  } catch (err) { next(err); }
};

// GET /deliveryman/order-delivery-history?limit=&page=
exports.getOrderHistory = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const Order = orderModel();
    const filter = { deliverymanId: new mongoose.Types.ObjectId(req.user.id), orderStatus: 'delivered' };
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);
    return paginated(res, orders, total, page, limit);
  } catch (err) { next(err); }
};

// GET /deliveryman/order?order_id=
exports.getOrder = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.query.order_id)) return error(res, 'Valid order_id is required', 400);
    const order = await orderModel().findOne({ _id: req.query.order_id, deliverymanId: req.user.id }).lean();
    if (!order) return error(res, 'Order not found', 404);
    return success(res, order);
  } catch (err) { next(err); }
};

// PUT /deliveryman/accept-order  body: { order_id }
exports.acceptOrder = async (req, res, next) => {
  try {
    const { order_id } = req.body;
    if (!order_id) return error(res, 'order_id is required', 400);
    const order = await assignDeliveryman(order_id, req.user.id, undefined, true);
    return success(res, order);
  } catch (err) { next(err); }
};

// PUT /deliveryman/update-order-status  body: { order_id, status }
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { order_id, status } = req.body;
    if (!order_id || !status) return error(res, 'order_id and status are required', 400);
    const allowed = ['processing', 'handover', 'picked_up', 'delivered'];
    if (!allowed.includes(status)) return error(res, 'Invalid status', 400);

    const driver = await DeliveryMan.findById(req.user.id).select('status applicationStatus');
    if (!driver?.status || (driver.applicationStatus && driver.applicationStatus !== 'approved')) {
      return error(res, 'Delivery account is unavailable', 403);
    }
    const order = await adminUpdateOrderStatus(order_id, { status }, undefined, req.user.id);
    return success(res, order);
  } catch (err) { next(err); }
};

// GET /deliveryman/notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const [notifications, total] = await Promise.all([
      Notification.find({ userId: req.user.id, userType: 'deliveryman' }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments({ userId: req.user.id, userType: 'deliveryman' }),
    ]);
    return paginated(res, notifications, total, page, limit);
  } catch (err) { next(err); }
};

// POST /deliveryman/record-location  body: { latitude, longitude }
exports.recordLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) return error(res, 'latitude and longitude are required', 400);
    await DeliveryMan.findByIdAndUpdate(req.user.id, {
      lastLatitude: latitude,
      lastLongitude: longitude,
      lastLocationAt: new Date(),
    });
    return success(res, null, 'Location updated');
  } catch (err) { next(err); }
};

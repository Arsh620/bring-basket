const mongoose = require('mongoose');
const Vendor = require('../../models/auth/Vendor');
const Store = require('../../models/store/Store');
const Order = require('../orders/order.model');
const Item = require('../../models/catalog/Item');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

// GET /vendor/profile
exports.getProfile = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.user.id).lean();
    if (!vendor) return error(res, 'Not found', 404);
    const stores = await Store.find({ vendorId: req.user.id, status: true }).select('_id name logo orderCount rating').lean();
    return success(res, { ...vendor, stores });
  } catch (err) { next(err); }
};

// PUT /vendor/update-profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { fName, lName, image, firebaseToken, bankName, branch, holderName, accountNo } = req.body;
    const vendor = await Vendor.findByIdAndUpdate(req.user.id, { fName, lName, image, firebaseToken, bankName, branch, holderName, accountNo }, { new: true });
    return success(res, vendor);
  } catch (err) { next(err); }
};

// GET /vendor/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const stores = await Store.find({ vendorId: req.user.id }).select('_id').lean();
    const storeIds = stores.map((s) => String(s._id));
    const [totalOrders, pendingOrders, totalItems] = await Promise.all([
      Order.countDocuments({ storeId: { $in: storeIds } }),
      Order.countDocuments({ storeId: { $in: storeIds }, orderStatus: 'pending' }),
      Item.countDocuments({ storeId: { $in: storeIds.map((id) => new mongoose.Types.ObjectId(id)) }, status: true }),
    ]);
    return success(res, { totalOrders, pendingOrders, totalItems, totalStores: stores.length });
  } catch (err) { next(err); }
};

// GET /vendor/orders?status=&limit=&page=
exports.getOrders = async (req, res, next) => {
  try {
    const stores = await Store.find({ vendorId: req.user.id }).select('_id').lean();
    const storeIds = stores.map((s) => String(s._id));
    const filter = { storeId: { $in: storeIds } };
    if (req.query.status && req.query.status !== 'all') filter.orderStatus = req.query.status;
    const { skip, page, limit } = paginate(req.query);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);
    return paginated(res, orders, total, page, limit);
  } catch (err) { next(err); }
};

// PUT /vendor/orders/update-status  body: { order_id, status }
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { order_id, status } = req.body;
    if (!order_id || !status) return error(res, 'order_id and status required', 400);
    const allowed = ['confirmed', 'processing', 'handover', 'canceled'];
    if (!allowed.includes(status)) return error(res, 'Invalid status', 400);
    const stores = await Store.find({ vendorId: req.user.id }).select('_id').lean();
    const storeIds = stores.map((s) => String(s._id));
    const order = await Order.findOneAndUpdate(
      { _id: order_id, storeId: { $in: storeIds } },
      { orderStatus: status },
      { new: true },
    );
    if (!order) return error(res, 'Order not found', 404);
    return success(res, order);
  } catch (err) { next(err); }
};

// GET /vendor/items?storeId=&limit=&page=
exports.getItems = async (req, res, next) => {
  try {
    const stores = await Store.find({ vendorId: req.user.id }).select('_id').lean();
    const storeIds = stores.map((s) => new mongoose.Types.ObjectId(s._id));
    const filter = { storeId: { $in: storeIds } };
    if (req.query.storeId && mongoose.isValidObjectId(req.query.storeId)) filter.storeId = new mongoose.Types.ObjectId(req.query.storeId);
    const { skip, page, limit } = paginate(req.query);
    const [items, total] = await Promise.all([
      Item.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Item.countDocuments(filter),
    ]);
    return paginated(res, items, total, page, limit);
  } catch (err) { next(err); }
};

// POST /vendor/items
exports.createItem = async (req, res, next) => {
  try {
    const stores = await Store.find({ vendorId: req.user.id }).select('_id').lean();
    const storeIds = stores.map((s) => String(s._id));
    if (!storeIds.includes(String(req.body.storeId))) return error(res, 'Store not found', 403);
    const item = await Item.create(req.body);
    return success(res, item, 'Item created', 201);
  } catch (err) { next(err); }
};

// PUT /vendor/items/:id
exports.updateItem = async (req, res, next) => {
  try {
    const stores = await Store.find({ vendorId: req.user.id }).select('_id').lean();
    const storeIds = stores.map((s) => String(s._id));
    const item = await Item.findOne({ _id: req.params.id, storeId: { $in: storeIds.map((id) => new mongoose.Types.ObjectId(id)) } });
    if (!item) return error(res, 'Item not found', 404);
    Object.assign(item, req.body);
    await item.save();
    return success(res, item);
  } catch (err) { next(err); }
};

// PATCH /vendor/items/:id/status
exports.updateItemStatus = async (req, res, next) => {
  try {
    const stores = await Store.find({ vendorId: req.user.id }).select('_id').lean();
    const storeIds = stores.map((s) => new mongoose.Types.ObjectId(s._id));
    const item = await Item.findOneAndUpdate({ _id: req.params.id, storeId: { $in: storeIds } }, { status: req.body.status }, { new: true });
    if (!item) return error(res, 'Item not found', 404);
    return success(res, item);
  } catch (err) { next(err); }
};

// DELETE /vendor/items/:id
exports.deleteItem = async (req, res, next) => {
  try {
    const stores = await Store.find({ vendorId: req.user.id }).select('_id').lean();
    const storeIds = stores.map((s) => new mongoose.Types.ObjectId(s._id));
    const item = await Item.findOneAndDelete({ _id: req.params.id, storeId: { $in: storeIds } });
    if (!item) return error(res, 'Item not found', 404);
    return success(res, null, 'Item deleted');
  } catch (err) { next(err); }
};

// GET /vendor/stores
exports.getStores = async (req, res, next) => {
  try {
    const stores = await Store.find({ vendorId: req.user.id }).lean();
    return success(res, stores);
  } catch (err) { next(err); }
};

// PUT /vendor/update-fcm-token
exports.updateFcmToken = async (req, res, next) => {
  try {
    if (!req.body.fcm_token) return error(res, 'fcm_token required', 400);
    await Vendor.findByIdAndUpdate(req.user.id, { firebaseToken: req.body.fcm_token });
    return success(res, null, 'Token updated');
  } catch (err) { next(err); }
};

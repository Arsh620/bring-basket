const mongoose = require('mongoose');
const User = require('../../models/auth/User');
const WalletTransaction = require('../../models/auth/WalletTransaction');
const LoyaltyTransaction = require('../../models/auth/LoyaltyTransaction');
const Order = require('../orders/order.model');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

// GET /admin/customers?search=&status=&page=&limit=
exports.getAll = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const filter = { isGuest: { $ne: true } };
    if (req.query.status !== undefined) filter.status = req.query.status === 'true';
    if (req.query.search?.trim()) {
      const re = new RegExp(req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ fName: re }, { lName: re }, { email: re }, { phone: re }];
    }
    const [data, total] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);
    return paginated(res, data, total, page, limit);
  } catch (err) { next(err); }
};

// GET /admin/customers/:id
exports.getOne = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid ID', 400);
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return error(res, 'Not found', 404);
    const [orderCount, totalSpent] = await Promise.all([
      Order.countDocuments({ ownerId: String(user._id), isGuest: false }),
      Order.aggregate([
        { $match: { ownerId: String(user._id), isGuest: false, orderStatus: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$orderAmount' } } },
      ]),
    ]);
    return success(res, { ...user, orderCount, totalSpent: totalSpent[0]?.total || 0 });
  } catch (err) { next(err); }
};

// PATCH /admin/customers/:id/status  body: { status }
exports.updateStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid ID', 400);
    if (typeof req.body.status !== 'boolean') return error(res, 'status (boolean) required', 400);
    const user = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }).select('-password');
    if (!user) return error(res, 'Not found', 404);
    return success(res, user);
  } catch (err) { next(err); }
};

// POST /admin/customers/:id/wallet/add-fund  body: { amount, note }
exports.addWalletFund = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid ID', 400);
    const { amount, note } = req.body;
    if (!amount || amount <= 0) return error(res, 'amount must be positive', 400);
    const user = await User.findById(req.params.id);
    if (!user) return error(res, 'Not found', 404);
    user.walletBalance = Number((user.walletBalance + amount).toFixed(2));
    await user.save();
    await WalletTransaction.create({ userId: user._id, type: 'credit', amount, balance: user.walletBalance, referenceType: 'admin', note: note || 'Admin wallet credit' });
    return success(res, { walletBalance: user.walletBalance });
  } catch (err) { next(err); }
};

// POST /admin/customers/:id/loyalty/adjust  body: { points, type: 'credit'|'debit', note }
exports.adjustLoyalty = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid ID', 400);
    const { points, type, note } = req.body;
    if (!points || points <= 0) return error(res, 'points must be positive', 400);
    if (!['credit', 'debit'].includes(type)) return error(res, 'type must be credit or debit', 400);
    const user = await User.findById(req.params.id);
    if (!user) return error(res, 'Not found', 404);
    if (type === 'debit' && user.loyaltyPoint < points) return error(res, 'Insufficient loyalty points', 400);
    user.loyaltyPoint = type === 'credit'
      ? Number((user.loyaltyPoint + points).toFixed(3))
      : Number((user.loyaltyPoint - points).toFixed(3));
    await user.save();
    await LoyaltyTransaction.create({ userId: user._id, type, points, balance: user.loyaltyPoint, transactionType: type === 'credit' ? 'admin_credit' : 'admin_debit', note: note || 'Admin adjustment' });
    return success(res, { loyaltyPoint: user.loyaltyPoint });
  } catch (err) { next(err); }
};

// GET /admin/customers/:id/orders?page=&limit=
exports.getOrders = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid ID', 400);
    const { skip, page, limit } = paginate(req.query);
    const filter = { ownerId: req.params.id, isGuest: false };
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);
    return paginated(res, orders, total, page, limit);
  } catch (err) { next(err); }
};

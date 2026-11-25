const mongoose = require('mongoose');
const User = require('../../models/auth/User');
const WalletTransaction = require('../../models/auth/WalletTransaction');
const LoyaltyTransaction = require('../../models/auth/LoyaltyTransaction');
const Order = require('../orders/order.model');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

const getCustomerDashboardPeriods = (now = new Date()) => {
  const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const year = Number(dateParts.year);
  const yearStart = new Date(`${year}-01-01T00:00:00+05:30`);
  const nextYearStart = new Date(`${year + 1}-01-01T00:00:00+05:30`);
  const todayStart = new Date(`${dateParts.year}-${dateParts.month}-${dateParts.day}T00:00:00+05:30`);

  return {
    year,
    yearStart,
    nextYearStart,
    newCustomersStart: new Date(todayStart.getTime() - (30 * 24 * 60 * 60 * 1000)),
  };
};

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

// GET /admin/dashboard/customer-stats?zoneId=
exports.getDashboardStats = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.zoneId && req.query.zoneId !== 'all') {
      if (!mongoose.isValidObjectId(req.query.zoneId)) return error(res, 'Invalid zone ID', 400);
      filter.zoneId = new mongoose.Types.ObjectId(req.query.zoneId);
    }

    const { year, yearStart, nextYearStart, newCustomersStart } = getCustomerDashboardPeriods();
    const [result] = await User.aggregate([
      { $match: filter },
      {
        $facet: {
          summary: [{
            $group: {
              _id: null,
              totalCustomers: { $sum: 1 },
              activeCustomers: {
                $sum: {
                  $cond: [{
                    $eq: [{
                      $convert: {
                        input: { $ifNull: ['$status', 1] },
                        to: 'int',
                        onError: 0,
                        onNull: 1,
                      },
                    }, 1],
                  }, 1, 0],
                },
              },
              blockedCustomers: {
                $sum: {
                  $cond: [{
                    $eq: [{
                      $convert: {
                        input: { $ifNull: ['$status', 1] },
                        to: 'int',
                        onError: 0,
                        onNull: 1,
                      },
                    }, 0],
                  }, 1, 0],
                },
              },
              newCustomers: {
                $sum: { $cond: [{ $gte: ['$createdAt', newCustomersStart] }, 1, 0] },
              },
            },
          }],
          monthly: [
            { $match: { createdAt: { $gte: yearStart, $lt: nextYearStart } } },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m',
                    date: '$createdAt',
                    timezone: 'Asia/Kolkata',
                  },
                },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const summary = result?.summary?.[0] ?? {};
    const monthlyCounts = new Map((result?.monthly ?? []).map(({ _id, count }) => [_id, count]));
    const monthlyCustomers = Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      return {
        month: `${year}-${month}`,
        label: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' })
          .format(new Date(Date.UTC(year, index, 1))),
        count: monthlyCounts.get(`${year}-${month}`) ?? 0,
      };
    });

    return success(res, {
      year,
      totalCustomers: summary.totalCustomers ?? 0,
      activeCustomers: summary.activeCustomers ?? 0,
      blockedCustomers: summary.blockedCustomers ?? 0,
      newCustomers: summary.newCustomers ?? 0,
      monthlyCustomers,
    });
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

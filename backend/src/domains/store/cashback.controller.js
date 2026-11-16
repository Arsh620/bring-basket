const Cashback = require('../../models/store/Cashback');
const CashbackHistory = require('../../models/store/CashbackHistory');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

const activeFilter = () => {
  const now = new Date();
  return {
    status: true,
    $and: [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
    ],
  };
};

exports.list = async (req, res, next) => {
  try {
    return success(res, await Cashback.find(activeFilter()).lean());
  } catch (err) { next(err); }
};

exports.getCashback = async (req, res, next) => {
  try {
    const orderAmount = Number(req.query.order_amount) || 0;
    const cashback = await Cashback.findOne({ ...activeFilter(), minPurchase: { $lte: orderAmount } }).sort({ cashbackAmount: -1 }).lean();
    if (!cashback) return success(res, null, 'No cashback available');
    let amount = cashback.cashbackType === 'percentage' ? (orderAmount * cashback.cashbackAmount) / 100 : cashback.cashbackAmount;
    if (cashback.maxDiscount > 0) amount = Math.min(amount, cashback.maxDiscount);
    return success(res, { cashback, cashbackAmount: Number(amount.toFixed(2)) });
  } catch (err) { next(err); }
};

exports.adminGetAll = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const filter = req.query.status !== undefined ? { status: req.query.status === 'true' } : {};
    const [data, total] = await Promise.all([
      Cashback.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Cashback.countDocuments(filter),
    ]);
    return paginated(res, data, total, page, limit);
  } catch (err) { next(err); }
};

exports.adminCreate = async (req, res, next) => {
  try {
    const { title, cashbackType, cashbackAmount } = req.body;
    if (!title || !cashbackType || cashbackAmount === undefined) return error(res, 'title, cashbackType, cashbackAmount required', 400);
    return success(res, await Cashback.create(req.body), 'Cashback created', 201);
  } catch (err) { next(err); }
};

exports.adminUpdate = async (req, res, next) => {
  try {
    const cashback = await Cashback.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cashback) return error(res, 'Not found', 404);
    return success(res, cashback);
  } catch (err) { next(err); }
};

exports.adminUpdateStatus = async (req, res, next) => {
  try {
    const cashback = await Cashback.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!cashback) return error(res, 'Not found', 404);
    return success(res, cashback);
  } catch (err) { next(err); }
};

exports.adminDelete = async (req, res, next) => {
  try {
    const cashback = await Cashback.findByIdAndDelete(req.params.id);
    if (!cashback) return error(res, 'Not found', 404);
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

// Internal — called after order delivered
exports.applyCashback = async (userId, orderId, orderAmount) => {
  const cashback = await Cashback.findOne({ ...activeFilter(), minPurchase: { $lte: orderAmount } }).sort({ cashbackAmount: -1 });
  if (!cashback) return 0;
  const used = await CashbackHistory.countDocuments({ cashbackId: cashback._id, userId });
  if (cashback.sameUserLimit > 0 && used >= cashback.sameUserLimit) return 0;
  let amount = cashback.cashbackType === 'percentage' ? (orderAmount * cashback.cashbackAmount) / 100 : cashback.cashbackAmount;
  if (cashback.maxDiscount > 0) amount = Math.min(amount, cashback.maxDiscount);
  amount = Number(amount.toFixed(2));
  await CashbackHistory.create({ cashbackId: cashback._id, orderId, userId, cashbackType: cashback.cashbackType, calculatedAmount: orderAmount, cashbackAmount: amount, minPurchase: cashback.minPurchase, maxDiscount: cashback.maxDiscount });
  await Cashback.findByIdAndUpdate(cashback._id, { $inc: { totalUsed: 1 } });
  return amount;
};

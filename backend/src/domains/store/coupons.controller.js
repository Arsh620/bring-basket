const mongoose = require('mongoose');
const Coupon = require('../../models/store/Coupon');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

// GET /customer/coupons?moduleId=&storeId=
exports.list = async (req, res, next) => {
  try {
    const now = new Date();
    const filter = { status: true, startDate: { $lte: now }, expireDate: { $gte: now } };
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId)) filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    if (req.query.storeId && mongoose.isValidObjectId(req.query.storeId)) filter.storeId = new mongoose.Types.ObjectId(req.query.storeId);
    const { skip, page, limit } = paginate(req.query);
    const [coupons, total] = await Promise.all([
      Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Coupon.countDocuments(filter),
    ]);
    return paginated(res, coupons, total, page, limit);
  } catch (err) { next(err); }
};

// GET /customer/coupons/apply?code=&order_amount=&store_id=
exports.apply = async (req, res, next) => {
  try {
    const { code, order_amount, store_id } = req.query;
    if (!code) return error(res, 'Coupon code is required', 400);
    const now = new Date();
    const coupon = await Coupon.findOne({
      code: String(code).toUpperCase(),
      status: true,
      startDate: { $lte: now },
      expireDate: { $gte: now },
    });
    if (!coupon) return error(res, 'Invalid or expired coupon', 404);
    if (coupon.limit > 0 && coupon.usedCount >= coupon.limit) return error(res, 'Coupon usage limit reached', 409);
    const amount = Number(order_amount) || 0;
    if (amount < coupon.minPurchase) return error(res, `Minimum order amount is ${coupon.minPurchase}`, 409);

    let discount = coupon.discountType === 'percent'
      ? (amount * coupon.discount) / 100
      : coupon.discount;
    if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
    discount = Math.min(discount, amount);

    return success(res, { coupon, discount: Number(discount.toFixed(2)) });
  } catch (err) { next(err); }
};

// Admin CRUD
exports.adminGetAll = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const [coupons, total] = await Promise.all([
      Coupon.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Coupon.countDocuments(),
    ]);
    return paginated(res, coupons, total, page, limit);
  } catch (err) { next(err); }
};

exports.adminCreate = async (req, res, next) => {
  try {
    const coupon = await Coupon.create(req.body);
    return success(res, coupon, 'Coupon created', 201);
  } catch (err) { next(err); }
};

exports.adminUpdate = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!coupon) return error(res, 'Coupon not found', 404);
    return success(res, coupon);
  } catch (err) { next(err); }
};

exports.adminUpdateStatus = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!coupon) return error(res, 'Coupon not found', 404);
    return success(res, coupon);
  } catch (err) { next(err); }
};

exports.adminDelete = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return error(res, 'Coupon not found', 404);
    return success(res, null, 'Coupon deleted');
  } catch (err) { next(err); }
};

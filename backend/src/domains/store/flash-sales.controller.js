const mongoose = require('mongoose');
const FlashSale = require('../../models/store/FlashSale');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

// Customer
exports.getActive = async (req, res, next) => {
  try {
    const now = new Date();
    const filter = { status: true, startDate: { $lte: now }, endDate: { $gte: now } };
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId))
      filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    const sales = await FlashSale.find(filter).populate('items.itemId', 'name image price mrp stock').lean();
    return success(res, sales);
  } catch (err) { next(err); }
};

exports.getItems = async (req, res, next) => {
  try {
    const now = new Date();
    const filter = { status: true, startDate: { $lte: now }, endDate: { $gte: now } };
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId))
      filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    const sales = await FlashSale.find(filter).populate('items.itemId', 'name image price mrp stock discount discountType').lean();
    const items = sales.flatMap((s) => s.items.map((i) => ({ ...i.itemId, flashDiscount: i.discount, flashDiscountType: i.discountType })));
    return success(res, items);
  } catch (err) { next(err); }
};

// Admin
exports.adminGetAll = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const [data, total] = await Promise.all([
      FlashSale.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      FlashSale.countDocuments(),
    ]);
    return paginated(res, data, total, page, limit);
  } catch (err) { next(err); }
};

exports.adminCreate = async (req, res, next) => {
  try {
    const sale = await FlashSale.create(req.body);
    return success(res, sale, 'Flash sale created', 201);
  } catch (err) { next(err); }
};

exports.adminGetOne = async (req, res, next) => {
  try {
    const sale = await FlashSale.findById(req.params.id).populate('items.itemId', 'name image price').lean();
    if (!sale) return error(res, 'Not found', 404);
    return success(res, sale);
  } catch (err) { next(err); }
};

exports.adminUpdate = async (req, res, next) => {
  try {
    const sale = await FlashSale.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!sale) return error(res, 'Not found', 404);
    return success(res, sale);
  } catch (err) { next(err); }
};

exports.adminUpdateStatus = async (req, res, next) => {
  try {
    const sale = await FlashSale.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!sale) return error(res, 'Not found', 404);
    return success(res, sale);
  } catch (err) { next(err); }
};

exports.adminDelete = async (req, res, next) => {
  try {
    const sale = await FlashSale.findByIdAndDelete(req.params.id);
    if (!sale) return error(res, 'Not found', 404);
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

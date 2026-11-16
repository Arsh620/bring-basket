const mongoose = require('mongoose');
const Vendor = require('../../models/auth/Vendor');
const Store = require('../../models/store/Store');
const Order = require('../orders/order.model');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

// GET /admin/vendors?search=&status=&page=&limit=
exports.getAll = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const filter = {};
    if (req.query.status !== undefined) filter.status = req.query.status === 'true';
    if (req.query.search?.trim()) {
      const re = new RegExp(req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ fName: re }, { lName: re }, { email: re }, { phone: re }];
    }
    const [data, total] = await Promise.all([
      Vendor.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Vendor.countDocuments(filter),
    ]);
    return paginated(res, data, total, page, limit);
  } catch (err) { next(err); }
};

// GET /admin/vendors/:id
exports.getOne = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid ID', 400);
    const vendor = await Vendor.findById(req.params.id).select('-password').lean();
    if (!vendor) return error(res, 'Not found', 404);
    const stores = await Store.find({ vendorId: req.params.id }).select('name status orderCount rating').lean();
    return success(res, { ...vendor, stores });
  } catch (err) { next(err); }
};

// PATCH /admin/vendors/:id/status  body: { status }
exports.updateStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid ID', 400);
    if (typeof req.body.status !== 'boolean') return error(res, 'status (boolean) required', 400);
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }).select('-password');
    if (!vendor) return error(res, 'Not found', 404);
    return success(res, vendor);
  } catch (err) { next(err); }
};

// DELETE /admin/vendors/:id
exports.remove = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid ID', 400);
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) return error(res, 'Not found', 404);
    return success(res, null, 'Vendor deleted');
  } catch (err) { next(err); }
};

// GET /admin/vendors/:id/stores
exports.getStores = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid ID', 400);
    const stores = await Store.find({ vendorId: req.params.id }).lean();
    return success(res, stores);
  } catch (err) { next(err); }
};

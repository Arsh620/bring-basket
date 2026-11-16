const mongoose = require('mongoose');
const Banner = require('../../models/store/Banner');
const { success, error } = require('../../utils/response');

// GET /customer/banners?moduleId=&zoneId=
exports.getAll = async (req, res, next) => {
  try {
    const filter = { status: true };
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId)) filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    if (req.query.zoneId && mongoose.isValidObjectId(req.query.zoneId)) filter.zoneId = new mongoose.Types.ObjectId(req.query.zoneId);
    const banners = await Banner.find(filter).sort({ createdAt: -1 }).lean();
    return success(res, banners);
  } catch (err) { next(err); }
};

// GET /customer/banners/store/:storeId
exports.getByStore = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.storeId)) return error(res, 'Invalid storeId', 400);
    const banners = await Banner.find({ storeId: req.params.storeId, status: true }).lean();
    return success(res, banners);
  } catch (err) { next(err); }
};

// Admin CRUD
exports.adminGetAll = async (req, res, next) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 }).lean();
    return success(res, banners);
  } catch (err) { next(err); }
};

exports.adminCreate = async (req, res, next) => {
  try {
    const banner = await Banner.create(req.body);
    return success(res, banner, 'Banner created', 201);
  } catch (err) { next(err); }
};

exports.adminUpdate = async (req, res, next) => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!banner) return error(res, 'Banner not found', 404);
    return success(res, banner);
  } catch (err) { next(err); }
};

exports.adminUpdateStatus = async (req, res, next) => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!banner) return error(res, 'Banner not found', 404);
    return success(res, banner);
  } catch (err) { next(err); }
};

exports.adminDelete = async (req, res, next) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return error(res, 'Banner not found', 404);
    return success(res, null, 'Banner deleted');
  } catch (err) { next(err); }
};

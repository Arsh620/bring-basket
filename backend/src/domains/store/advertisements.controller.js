const mongoose = require('mongoose');
const Advertisement = require('../../models/store/Advertisement');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

exports.getAll = async (req, res, next) => {
  try {
    const filter = { status: true };
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId))
      filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    if (req.query.zoneId && mongoose.isValidObjectId(req.query.zoneId))
      filter.zoneId = new mongoose.Types.ObjectId(req.query.zoneId);
    const ads = await Advertisement.find(filter).sort({ createdAt: -1 }).lean();
    return success(res, ads);
  } catch (err) { next(err); }
};

exports.adminGetAll = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const [data, total] = await Promise.all([
      Advertisement.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Advertisement.countDocuments(),
    ]);
    return paginated(res, data, total, page, limit);
  } catch (err) { next(err); }
};

exports.adminCreate = async (req, res, next) => {
  try {
    const ad = await Advertisement.create(req.body);
    return success(res, ad, 'Advertisement created', 201);
  } catch (err) { next(err); }
};

exports.adminUpdate = async (req, res, next) => {
  try {
    const ad = await Advertisement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!ad) return error(res, 'Not found', 404);
    return success(res, ad);
  } catch (err) { next(err); }
};

exports.adminUpdateStatus = async (req, res, next) => {
  try {
    const ad = await Advertisement.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!ad) return error(res, 'Not found', 404);
    return success(res, ad);
  } catch (err) { next(err); }
};

exports.adminDelete = async (req, res, next) => {
  try {
    const ad = await Advertisement.findByIdAndDelete(req.params.id);
    if (!ad) return error(res, 'Not found', 404);
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

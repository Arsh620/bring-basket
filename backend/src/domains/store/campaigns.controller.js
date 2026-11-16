const mongoose = require('mongoose');
const Campaign = require('../../models/store/Campaign');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

exports.getBasic = async (req, res, next) => {
  try {
    const now = new Date();
    const filter = { status: true, type: 'basic', startDate: { $lte: now }, endDate: { $gte: now } };
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId))
      filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    const campaigns = await Campaign.find(filter).lean();
    return success(res, campaigns);
  } catch (err) { next(err); }
};

exports.getItem = async (req, res, next) => {
  try {
    const now = new Date();
    const filter = { status: true, type: 'item', startDate: { $lte: now }, endDate: { $gte: now } };
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId))
      filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    const campaigns = await Campaign.find(filter).populate('items', 'name image price discount').lean();
    return success(res, campaigns);
  } catch (err) { next(err); }
};

exports.adminGetAll = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const [data, total] = await Promise.all([
      Campaign.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Campaign.countDocuments(),
    ]);
    return paginated(res, data, total, page, limit);
  } catch (err) { next(err); }
};

exports.adminCreate = async (req, res, next) => {
  try {
    const campaign = await Campaign.create(req.body);
    return success(res, campaign, 'Campaign created', 201);
  } catch (err) { next(err); }
};

exports.adminUpdate = async (req, res, next) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!campaign) return error(res, 'Not found', 404);
    return success(res, campaign);
  } catch (err) { next(err); }
};

exports.adminUpdateStatus = async (req, res, next) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!campaign) return error(res, 'Not found', 404);
    return success(res, campaign);
  } catch (err) { next(err); }
};

exports.adminDelete = async (req, res, next) => {
  try {
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (!campaign) return error(res, 'Not found', 404);
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

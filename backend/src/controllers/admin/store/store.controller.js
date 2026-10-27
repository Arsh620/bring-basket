const mongoose = require('mongoose');
const Store = require('../../../models/store/Store');
const { success, error } = require('../../../utils/response');
const { paginate } = require('../../../utils/pagination');

const WRITABLE = [
  'name', 'phone', 'email', 'logo', 'coverPhoto', 'address', 'latitude', 'longitude',
  'footerText', 'gst', 'slug', 'vendorId', 'moduleId', 'zoneId', 'minimumOrder', 'comission',
  'tax', 'minimumShippingCharge', 'maximumShippingCharge', 'perKmShippingCharge', 'deliveryTime',
  'status', 'active', 'featured', 'delivery', 'takeAway', 'freeDelivery', 'scheduleOrder',
  'selfDeliverySystem', 'posSystem', 'prescriptionOrder', 'veg', 'nonVeg', 'cutlery',
  'announcement', 'announcementMessage', 'offDay', 'storeBusinessModel', 'metaTitle',
  'metaDescription', 'metaImage', 'comment', 'orderPlaceToScheduleInterval', 'config',
  'expiryMarkdownRules',
];

const pick = (body, keys) => Object.fromEntries(
  keys.filter(k => body[k] !== undefined).map(k => [k, body[k]])
);

exports.getAll = async (req, res, next) => {
  try {
    const { moduleId, zoneId, vendorId, status, active, featured, search } = req.query;
    const { page, limit, skip } = paginate(req.query);
    const filter = {};
    if (moduleId) filter.moduleId = moduleId;
    if (zoneId) filter.zoneId = zoneId;
    if (vendorId) filter.vendorId = vendorId;
    if (status !== undefined) filter.status = status === 'true';
    if (active !== undefined) filter.active = active === 'true';
    if (featured !== undefined) filter.featured = featured === 'true';
    if (search) filter.name = { $regex: search, $options: 'i' };

    const [stores, total] = await Promise.all([
      Store.find(filter).populate('moduleId', 'moduleName moduleType').populate('zoneId', 'name').skip(skip).limit(limit).sort({ createdAt: -1 }),
      Store.countDocuments(filter),
    ]);
    return res.json({ success: true, data: stores, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid store ID', 400);
    const store = await Store.findById(req.params.id)
      .populate('moduleId', 'moduleName moduleType')
      .populate('zoneId', 'name')
      .populate('vendorId', 'fName lName email phone');
    if (!store) return error(res, 'Not found', 404);
    return success(res, store);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const fields = pick(req.body, WRITABLE);
    if (!fields.name?.trim()) return error(res, 'name is required', 400);
    if (!fields.phone?.trim()) return error(res, 'phone is required', 400);
    if (!fields.vendorId || !mongoose.isValidObjectId(fields.vendorId))
      return error(res, 'Valid vendorId is required', 400);
    if (!fields.moduleId || !mongoose.isValidObjectId(fields.moduleId))
      return error(res, 'Valid moduleId is required', 400);

    const store = await Store.create(fields);
    return success(res, store, 'Store created', 201);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid store ID', 400);
    const fields = pick(req.body, WRITABLE);
    if (!Object.keys(fields).length) return error(res, 'No valid fields to update', 400);

    const store = await Store.findByIdAndUpdate(req.params.id, fields, { new: true });
    if (!store) return error(res, 'Not found', 404);
    return success(res, store);
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid store ID', 400);
    if (typeof req.body.status !== 'boolean')
      return error(res, 'status (boolean) is required', 400);
    const store = await Store.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!store) return error(res, 'Not found', 404);
    return success(res, store);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid store ID', 400);
    const store = await Store.findByIdAndDelete(req.params.id);
    if (!store) return error(res, 'Not found', 404);
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

// Schedule
exports.getSchedule = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid store ID', 400);
    const store = await Store.findById(req.params.id, 'schedule');
    if (!store) return error(res, 'Not found', 404);
    return success(res, store.schedule);
  } catch (err) { next(err); }
};

exports.updateSchedule = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid store ID', 400);
    if (!Array.isArray(req.body.schedule))
      return error(res, 'schedule must be an array', 400);
    const store = await Store.findByIdAndUpdate(req.params.id, { schedule: req.body.schedule }, { new: true });
    if (!store) return error(res, 'Not found', 404);
    return success(res, store.schedule);
  } catch (err) { next(err); }
};

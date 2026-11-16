const mongoose = require('mongoose');
const DeliveryMan = require('../../models/auth/DeliveryMan');
const Order = require('../orders/order.model');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

// GET /admin/delivery-men?search=&status=&applicationStatus=&page=&limit=
exports.getAll = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const filter = {};
    if (req.query.status !== undefined) filter.status = req.query.status === 'true';
    if (req.query.applicationStatus) filter.applicationStatus = req.query.applicationStatus;
    if (req.query.search?.trim()) {
      const re = new RegExp(req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ fName: re }, { lName: re }, { phone: re }, { email: re }];
    }
    const [data, total] = await Promise.all([
      DeliveryMan.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      DeliveryMan.countDocuments(filter),
    ]);
    return paginated(res, data, total, page, limit);
  } catch (err) { next(err); }
};

// GET /admin/delivery-men/:id
exports.getOne = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid ID', 400);
    const dm = await DeliveryMan.findById(req.params.id).select('-password').lean();
    if (!dm) return error(res, 'Not found', 404);
    const [orderCount, deliveredCount] = await Promise.all([
      Order.countDocuments({ deliverymanId: new mongoose.Types.ObjectId(req.params.id) }),
      Order.countDocuments({ deliverymanId: new mongoose.Types.ObjectId(req.params.id), orderStatus: 'delivered' }),
    ]);
    return success(res, { ...dm, orderCount, deliveredCount });
  } catch (err) { next(err); }
};

// PATCH /admin/delivery-men/:id/status  body: { status }
exports.updateStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid ID', 400);
    if (typeof req.body.status !== 'boolean') return error(res, 'status (boolean) required', 400);
    const dm = await DeliveryMan.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }).select('-password');
    if (!dm) return error(res, 'Not found', 404);
    return success(res, dm);
  } catch (err) { next(err); }
};

// PATCH /admin/delivery-men/:id/application  body: { applicationStatus: 'approved'|'denied' }
exports.updateApplication = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid ID', 400);
    const { applicationStatus } = req.body;
    if (!['approved', 'denied'].includes(applicationStatus)) return error(res, 'applicationStatus must be approved or denied', 400);
    const dm = await DeliveryMan.findByIdAndUpdate(req.params.id, { applicationStatus }, { new: true }).select('-password');
    if (!dm) return error(res, 'Not found', 404);
    return success(res, dm);
  } catch (err) { next(err); }
};

// POST /admin/delivery-men  — create DM from admin
exports.create = async (req, res, next) => {
  try {
    const { fName, lName, phone, email, password, zoneId, storeId } = req.body;
    if (!phone || !password) return error(res, 'phone and password required', 400);
    const exists = await DeliveryMan.findOne({ phone });
    if (exists) return error(res, 'Phone already registered', 409);
    const dm = await DeliveryMan.create({ fName, lName, phone, email, password, zoneId, storeId, applicationStatus: 'approved' });
    const data = dm.toObject();
    delete data.password;
    return success(res, data, 'Delivery man created', 201);
  } catch (err) { next(err); }
};

// PUT /admin/delivery-men/:id
exports.update = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid ID', 400);
    const allowed = ['fName', 'lName', 'email', 'image', 'zoneId', 'storeId', 'vehicleId', 'identityType', 'identityNumber', 'identityImage', 'earning'];
    const fields = Object.fromEntries(allowed.filter(k => req.body[k] !== undefined).map(k => [k, req.body[k]]));
    const dm = await DeliveryMan.findByIdAndUpdate(req.params.id, fields, { new: true }).select('-password');
    if (!dm) return error(res, 'Not found', 404);
    return success(res, dm);
  } catch (err) { next(err); }
};

// DELETE /admin/delivery-men/:id
exports.remove = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid ID', 400);
    const dm = await DeliveryMan.findByIdAndDelete(req.params.id);
    if (!dm) return error(res, 'Not found', 404);
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

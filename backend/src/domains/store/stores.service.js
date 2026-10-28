const mongoose = require('mongoose');
const Store = require('../../models/store/Store');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

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
  keys.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]),
);

const validateStoreId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid store ID', 400);
};

const getAll = async (query) => {
  const { moduleId, zoneId, vendorId, status, active, featured, search } = query;
  const { page, limit, skip } = paginate(query);
  const filter = {};
  if (moduleId) filter.moduleId = moduleId;
  if (zoneId) filter.zoneId = zoneId;
  if (vendorId) filter.vendorId = vendorId;
  if (status !== undefined) filter.status = status === 'true';
  if (active !== undefined) filter.active = active === 'true';
  if (featured !== undefined) filter.featured = featured === 'true';
  if (search) filter.name = { $regex: search, $options: 'i' };

  const [stores, total] = await Promise.all([
    Store.find(filter)
      .populate('moduleId', 'moduleName moduleType')
      .populate('zoneId', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Store.countDocuments(filter),
  ]);

  return {
    stores,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

const getOne = async (id) => {
  validateStoreId(id);
  const store = await Store.findById(id)
    .populate('moduleId', 'moduleName moduleType')
    .populate('zoneId', 'name')
    .populate('vendorId', 'fName lName email phone');
  if (!store) throw new AppError('Not found', 404);
  return store;
};

const create = async (body) => {
  const fields = pick(body, WRITABLE);
  if (!fields.name?.trim()) throw new AppError('name is required', 400);
  if (!fields.phone?.trim()) throw new AppError('phone is required', 400);
  if (!fields.vendorId || !mongoose.isValidObjectId(fields.vendorId)) {
    throw new AppError('Valid vendorId is required', 400);
  }
  if (!fields.moduleId || !mongoose.isValidObjectId(fields.moduleId)) {
    throw new AppError('Valid moduleId is required', 400);
  }
  return Store.create(fields);
};

const update = async (id, body) => {
  validateStoreId(id);
  const fields = pick(body, WRITABLE);
  if (!Object.keys(fields).length) throw new AppError('No valid fields to update', 400);
  const store = await Store.findByIdAndUpdate(id, fields, { new: true });
  if (!store) throw new AppError('Not found', 404);
  return store;
};

const updateStatus = async (id, status) => {
  validateStoreId(id);
  if (typeof status !== 'boolean') throw new AppError('status (boolean) is required', 400);
  const store = await Store.findByIdAndUpdate(id, { status }, { new: true });
  if (!store) throw new AppError('Not found', 404);
  return store;
};

const remove = async (id) => {
  validateStoreId(id);
  const store = await Store.findByIdAndDelete(id);
  if (!store) throw new AppError('Not found', 404);
};

const getSchedule = async (id) => {
  validateStoreId(id);
  const store = await Store.findById(id, 'schedule');
  if (!store) throw new AppError('Not found', 404);
  return store.schedule;
};

const updateSchedule = async (id, schedule) => {
  validateStoreId(id);
  if (!Array.isArray(schedule)) throw new AppError('schedule must be an array', 400);
  const store = await Store.findByIdAndUpdate(id, { schedule }, { new: true });
  if (!store) throw new AppError('Not found', 404);
  return store.schedule;
};

module.exports = {
  getAll,
  getOne,
  create,
  update,
  updateStatus,
  remove,
  getSchedule,
  updateSchedule,
};

const mongoose = require('mongoose');
const Store = require('../../models/store/Store');
const Zone = require('../../models/store/Zone');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');
const { zoneContains } = require('../../utils/geospatial');

const publicStore = (s) => ({
  _id: s._id,
  name: s.name,
  logo: s.logo,
  coverPhoto: s.coverPhoto,
  address: s.address,
  latitude: s.latitude,
  longitude: s.longitude,
  moduleId: s.moduleId,
  zoneId: s.zoneId,
  minimumOrder: s.minimumOrder,
  deliveryTime: s.deliveryTime,
  minimumShippingCharge: s.minimumShippingCharge,
  maximumShippingCharge: s.maximumShippingCharge,
  perKmShippingCharge: s.perKmShippingCharge,
  freeDelivery: s.freeDelivery,
  selfDeliverySystem: s.selfDeliverySystem,
  delivery: s.delivery,
  takeAway: s.takeAway,
  rating: s.rating,
  orderCount: s.orderCount,
  featured: s.featured,
  schedule: s.schedule,
  announcement: s.announcement,
  announcementMessage: s.announcementMessage,
  veg: s.veg,
  nonVeg: s.nonVeg,
  zone: s.zone,
});

// GET /customer/stores?moduleId=&zoneId=&limit=&page=
exports.getAll = async (req, res, next) => {
  try {
    const { moduleId, zoneId, featured } = req.query;
    const filter = { status: true, active: true };
    if (moduleId && mongoose.isValidObjectId(moduleId)) filter.moduleId = new mongoose.Types.ObjectId(moduleId);
    if (zoneId && mongoose.isValidObjectId(zoneId)) filter.zoneId = new mongoose.Types.ObjectId(zoneId);
    if (featured === 'true') filter.featured = true;

    const { skip, page, limit } = paginate(req.query);
    const [stores, total] = await Promise.all([
      Store.find(filter).populate('zoneId', 'name cashOnDelivery digitalPayment status coordinates').sort({ orderCount: -1 }).skip(skip).limit(limit).lean(),
      Store.countDocuments(filter),
    ]);
    return paginated(res, stores.map((s) => publicStore({ ...s, zone: s.zoneId })), total, page, limit);
  } catch (err) { next(err); }
};

// GET /customer/stores/:id
exports.getOne = async (req, res, next) => {
  try {
    const id = req.params.id;
    const filter = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id };
    const store = await Store.findOne({ ...filter, status: true, active: true })
      .populate('zoneId', 'name cashOnDelivery digitalPayment status coordinates increasedDeliveryFee increasedDeliveryFeeStatus')
      .lean();
    if (!store) return error(res, 'Store not found', 404);
    return success(res, publicStore({ ...store, zone: store.zoneId }));
  } catch (err) { next(err); }
};

// GET /customer/stores/latest?moduleId=&zoneId=
exports.getLatest = async (req, res, next) => {
  try {
    const filter = { status: true, active: true };
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId)) filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    if (req.query.zoneId && mongoose.isValidObjectId(req.query.zoneId)) filter.zoneId = new mongoose.Types.ObjectId(req.query.zoneId);
    const { skip, page, limit } = paginate(req.query);
    const [stores, total] = await Promise.all([
      Store.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Store.countDocuments(filter),
    ]);
    return paginated(res, stores.map(publicStore), total, page, limit);
  } catch (err) { next(err); }
};

// GET /customer/stores/popular?moduleId=&zoneId=
exports.getPopular = async (req, res, next) => {
  try {
    const filter = { status: true, active: true };
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId)) filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    if (req.query.zoneId && mongoose.isValidObjectId(req.query.zoneId)) filter.zoneId = new mongoose.Types.ObjectId(req.query.zoneId);
    const { skip, page, limit } = paginate(req.query);
    const [stores, total] = await Promise.all([
      Store.find(filter).sort({ orderCount: -1 }).skip(skip).limit(limit).lean(),
      Store.countDocuments(filter),
    ]);
    return paginated(res, stores.map(publicStore), total, page, limit);
  } catch (err) { next(err); }
};

// POST /customer/zones/check  body: { latitude, longitude }
exports.checkAddressZone = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) return error(res, 'latitude and longitude are required', 400);
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return error(res, 'Invalid coordinates', 400);

    const zones = await Zone.find({ status: true }).lean();
    const matched = zones.filter((z) => zoneContains(z.coordinates, { latitude: lat, longitude: lng }));
    if (!matched.length) return error(res, 'No zone found for this location', 404);
    return success(res, matched);
  } catch (err) { next(err); }
};

// GET /customer/stores/search?name=&moduleId=&zoneId=
exports.search = async (req, res, next) => {
  try {
    if (!req.query.name) return error(res, 'name is required', 400);
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = {
      status: true,
      active: true,
      name: { $regex: escapeRegex(String(req.query.name).slice(0, 100)), $options: 'i' },
    };
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId)) filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    if (req.query.zoneId && mongoose.isValidObjectId(req.query.zoneId)) filter.zoneId = new mongoose.Types.ObjectId(req.query.zoneId);
    const { skip, page, limit } = paginate(req.query);
    const [stores, total] = await Promise.all([
      Store.find(filter).select('_id name logo address rating orderCount moduleId').skip(skip).limit(limit).lean(),
      Store.countDocuments(filter),
    ]);
    return paginated(res, stores, total, page, limit);
  } catch (err) { next(err); }
};

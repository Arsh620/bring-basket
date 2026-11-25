const mongoose = require('mongoose');
const Item = require('../../models/catalog/Item');
const Store = require('../../models/store/Store');
const Review = require('../../models/catalog/Review');
const Wishlist = require('../../models/catalog/Wishlist');
require('../../models/catalog/Tag');
require('../../models/catalog/Nutrition');
require('../../models/catalog/Allergy');
const storeStockService = require('../inventory/store-stock.service');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const publicItem = (item) => ({
  _id: item._id,
  legacyId: item.legacyId,
  name: item.name,
  description: item.description,
  image: item.image,
  images: item.images || [],
  storeId: item.storeId,
  moduleId: item.moduleId,
  categoryId: item.categoryId,
  brandId: item.brandId,
  price: item.price,
  mrp: item.mrp,
  stock: item.stock,
  tax: item.tax,
  taxType: item.taxType,
  discount: item.discount,
  discountType: item.discountType,
  offerBuyQty: item.offerBuyQty,
  offerGetQty: item.offerGetQty,
  offerGetDiscount: item.offerGetDiscount,
  offerAllowSingle: item.offerAllowSingle,
  maximumCartQuantity: item.maximumCartQuantity,
  avgRating: item.avgRating,
  ratingCount: item.ratingCount,
  orderCount: item.orderCount,
  recommended: item.recommended,
  organic: item.organic,
  veg: item.veg,
  isHalal: item.isHalal,
  tags: item.tags,
  nutritions: item.nutritions,
  allergies: item.allergies,
  slug: item.slug,
});

const baseActiveFilter = (moduleId, zoneId) => {
  const filter = {
    status: { $in: [true, 1, '1'] },
    isApproved: { $in: [true, 1, '1'] },
  };
  if (moduleId) filter.moduleId = new mongoose.Types.ObjectId(moduleId);
  return filter;
};

// GET /customer/items?storeId=&search=&categoryId=&limit=&page=
exports.getAll = async (req, res, next) => {
  try {
    if (!req.query.storeId) return error(res, 'storeId is required', 400);
    const storeId = req.query.storeId;
    const storeFilter = mongoose.isValidObjectId(storeId)
      ? { _id: new mongoose.Types.ObjectId(storeId) }
      : (/^\d+$/.test(storeId) ? { legacyId: Number(storeId) } : null);
    if (!storeFilter) return error(res, 'Invalid storeId', 400);

    const store = await Store.findOne({ ...storeFilter, status: true, active: true }).lean();
    if (!store) return error(res, 'Store not found', 404);

    const filter = {
      storeId: { $in: [store._id, store.legacyId, String(store.legacyId)].filter(Boolean) },
      status: true,
      isApproved: true,
    };
    if (req.query.categoryId && mongoose.isValidObjectId(req.query.categoryId)) {
      filter.categoryId = new mongoose.Types.ObjectId(req.query.categoryId);
    }
    if (req.query.search) filter.name = { $regex: escapeRegex(String(req.query.search).slice(0, 100)), $options: 'i' };
    if (req.query.type === 'veg') filter.veg = true;
    if (req.query.type === 'non_veg') filter.veg = false;

    const { skip, page, limit } = paginate(req.query);
    // Native queries preserve legacy numeric store IDs alongside ObjectIds during migration.
    const [items, total] = await Promise.all([
      Item.collection.find(filter).sort({ orderCount: -1, name: 1 }).skip(skip).limit(limit).toArray(),
      Item.collection.countDocuments(filter),
    ]);
    const stocked = await storeStockService.getStoreStocks(items.map((i) => ({ ...i, storeId: store._id })));
    return paginated(res, stocked.map(publicItem), total, page, limit);
  } catch (err) { next(err); }
};

// GET /customer/items/:id
exports.getOne = async (req, res, next) => {
  try {
    const id = req.params.id;
    const filter = mongoose.isValidObjectId(id)
      ? { _id: new mongoose.Types.ObjectId(id) }
      : (/^\d+$/.test(id) ? { legacyId: Number(id) } : { slug: id });

    const item = await Item.collection.findOne({
      ...filter,
      status: { $in: [true, 1, '1'] },
      isApproved: { $in: [true, 1, '1'] },
    });
    if (!item) return error(res, 'Item not found', 404);

    const populatedItem = await Item.populate(item, [
      { path: 'tags', select: 'tag' },
      { path: 'nutritions', select: 'nutrition' },
      { path: 'allergies', select: 'allergy' },
    ]);
    const storeId = String(item.storeId);
    const storeFilter = mongoose.isValidObjectId(storeId)
      ? { _id: new mongoose.Types.ObjectId(storeId) }
      : (/^\d+$/.test(storeId) ? { legacyId: Number(storeId) } : null);
    const store = storeFilter
      ? await Store.collection.findOne({
        ...storeFilter,
        status: { $in: [true, 1, '1'] },
        active: { $in: [true, 1, '1'] },
      }, {
        projection: {
          _id: 1,
          name: 1,
          logo: 1,
          address: 1,
          latitude: 1,
          longitude: 1,
          moduleId: 1,
          zoneId: 1,
          minimumOrder: 1,
          deliveryTime: 1,
          rating: 1,
        },
      })
      : null;

    const [stocked] = await storeStockService.getStoreStocks([{
      ...populatedItem,
      storeId: store?._id ?? item.storeId,
    }]);
    return success(res, {
      ...publicItem(stocked),
      _id: String(item._id),
      storeId: String(store?._id ?? item.storeId),
      store_details: store,
    });
  } catch (err) { next(err); }
};

// GET /customer/items/latest?storeId=&categoryId=&zoneId=&limit=&page=
exports.getLatest = async (req, res, next) => {
  try {
    const { storeId, categoryId, zoneId, moduleId } = req.query;
    const filter = { status: true, isApproved: true };
    if (storeId && mongoose.isValidObjectId(storeId)) filter.storeId = new mongoose.Types.ObjectId(storeId);
    if (categoryId && mongoose.isValidObjectId(categoryId)) filter.categoryId = new mongoose.Types.ObjectId(categoryId);
    if (moduleId && mongoose.isValidObjectId(moduleId)) filter.moduleId = new mongoose.Types.ObjectId(moduleId);

    const { skip, page, limit } = paginate(req.query);
    const [items, total] = await Promise.all([
      Item.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Item.countDocuments(filter),
    ]);
    return paginated(res, items.map(publicItem), total, page, limit);
  } catch (err) { next(err); }
};

// GET /customer/items/popular?zoneId=&moduleId=&limit=&page=
exports.getPopular = async (req, res, next) => {
  try {
    const { moduleId } = req.query;
    const filter = { status: true, isApproved: true };
    if (moduleId && mongoose.isValidObjectId(moduleId)) filter.moduleId = new mongoose.Types.ObjectId(moduleId);

    const { skip, page, limit } = paginate(req.query);
    const [items, total] = await Promise.all([
      Item.find(filter).sort({ orderCount: -1, avgRating: -1 }).skip(skip).limit(limit).lean(),
      Item.countDocuments(filter),
    ]);
    return paginated(res, items.map(publicItem), total, page, limit);
  } catch (err) { next(err); }
};

// GET /customer/items/discounted?moduleId=&categoryId=&limit=&page=
exports.getDiscounted = async (req, res, next) => {
  try {
    const { moduleId, categoryId } = req.query;
    const filter = { status: true, isApproved: true, discount: { $gt: 0 } };
    if (moduleId && mongoose.isValidObjectId(moduleId)) filter.moduleId = new mongoose.Types.ObjectId(moduleId);
    if (categoryId && mongoose.isValidObjectId(categoryId)) filter.categoryId = new mongoose.Types.ObjectId(categoryId);

    const { skip, page, limit } = paginate(req.query);
    const [items, total] = await Promise.all([
      Item.find(filter).sort({ discount: -1 }).skip(skip).limit(limit).lean(),
      Item.countDocuments(filter),
    ]);
    return paginated(res, items.map(publicItem), total, page, limit);
  } catch (err) { next(err); }
};

// GET /customer/items/search?name=&moduleId=&storeId=&categoryId=&min_price=&max_price=&filter=
exports.search = async (req, res, next) => {
  try {
    if (!req.query.name) return error(res, 'name is required', 400);
    const { name, moduleId, storeId, categoryId, min_price, max_price, filter: filterParam } = req.query;
    const keys = String(name).slice(0, 100).split(' ').filter(Boolean);
    const filter = { status: true, isApproved: true };
    if (moduleId && mongoose.isValidObjectId(moduleId)) filter.moduleId = new mongoose.Types.ObjectId(moduleId);
    if (storeId && mongoose.isValidObjectId(storeId)) filter.storeId = new mongoose.Types.ObjectId(storeId);
    if (categoryId && mongoose.isValidObjectId(categoryId)) filter.categoryId = new mongoose.Types.ObjectId(categoryId);
    if (min_price || max_price) {
      filter.price = {};
      if (min_price) filter.price.$gte = Number(min_price);
      if (max_price) filter.price.$lte = Number(max_price);
    }
    filter.$or = keys.map((k) => ({ name: { $regex: escapeRegex(k), $options: 'i' } }));

    let sortObj = { orderCount: -1 };
    const filters = filterParam ? String(filterParam).split(',') : [];
    if (filters.includes('top_rated')) sortObj = { avgRating: -1 };
    if (filters.includes('high')) sortObj = { price: -1 };
    if (filters.includes('low')) sortObj = { price: 1 };
    if (filters.includes('discounted')) { filter.discount = { $gt: 0 }; sortObj = { discount: -1 }; }

    const { skip, page, limit } = paginate(req.query);
    const [items, total] = await Promise.all([
      Item.find(filter).sort(sortObj).skip(skip).limit(limit).lean(),
      Item.countDocuments(filter),
    ]);
    return paginated(res, items.map(publicItem), total, page, limit);
  } catch (err) { next(err); }
};

// GET /customer/items/search-suggestion?name=&moduleId=
exports.searchSuggestion = async (req, res, next) => {
  try {
    if (!req.query.name) return error(res, 'name is required', 400);
    const keys = String(req.query.name).slice(0, 100).split(' ').filter(Boolean);
    const filter = {
      status: true,
      isApproved: true,
      $or: keys.map((k) => ({ name: { $regex: escapeRegex(k), $options: 'i' } })),
    };
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId)) {
      filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    }
    const items = await Item.find(filter).select('name image').limit(10).lean();
    return success(res, items);
  } catch (err) { next(err); }
};

// GET /customer/items/:id/reviews?limit=&page=
exports.getReviews = async (req, res, next) => {
  try {
    const itemId = req.params.id;
    if (!mongoose.isValidObjectId(itemId)) return error(res, 'Invalid item id', 400);
    const { skip, page, limit } = paginate(req.query);
    const [reviews, total] = await Promise.all([
      Review.find({ itemId, status: true })
        .populate('userId', 'fName lName image')
        .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Review.countDocuments({ itemId, status: true }),
    ]);
    return paginated(res, reviews, total, page, limit);
  } catch (err) { next(err); }
};

// POST /customer/items/reviews/submit  (auth required)
exports.submitReview = async (req, res, next) => {
  try {
    const { item_id, order_id, rating, comment } = req.body;
    if (!item_id || !order_id || !rating) return error(res, 'item_id, order_id and rating are required', 400);
    if (rating < 1 || rating > 5) return error(res, 'Rating must be between 1 and 5', 400);

    const Order = require('../orders/order.model');
    const order = await Order.findOne({ _id: order_id, ownerId: req.user.id });
    if (!order) return error(res, 'Order not found', 404);

    const existing = await Review.findOne({ userId: req.user.id, itemId: item_id, orderId: order_id });
    if (existing) return error(res, 'Review already submitted', 409);

    const review = await Review.create({
      userId: req.user.id,
      itemId: item_id,
      orderId: order_id,
      moduleId: order.moduleId,
      rating: Number(rating),
      comment,
    });

    // Update item avg rating
    const allReviews = await Review.find({ itemId: item_id, status: true }).select('rating').lean();
    const avgRating = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
    await Item.findByIdAndUpdate(item_id, { avgRating: Number(avgRating.toFixed(2)), ratingCount: allReviews.length });

    return success(res, review, 'Review submitted successfully', 201);
  } catch (err) { next(err); }
};

// GET /customer/items/recommended?storeId=&moduleId=
exports.getRecommended = async (req, res, next) => {
  try {
    const filter = { status: true, isApproved: true, recommended: true };
    if (req.query.storeId && mongoose.isValidObjectId(req.query.storeId)) filter.storeId = new mongoose.Types.ObjectId(req.query.storeId);
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId)) filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    const { skip, page, limit } = paginate(req.query);
    const [items, total] = await Promise.all([
      Item.find(filter).sort({ orderCount: -1 }).skip(skip).limit(limit).lean(),
      Item.countDocuments(filter),
    ]);
    return paginated(res, items.map(publicItem), total, page, limit);
  } catch (err) { next(err); }
};

// GET /customer/items/most-reviewed?moduleId=
exports.getMostReviewed = async (req, res, next) => {
  try {
    const filter = { status: true, isApproved: true };
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId)) filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    const { skip, page, limit } = paginate(req.query);
    const [items, total] = await Promise.all([
      Item.find(filter).sort({ ratingCount: -1, avgRating: -1 }).skip(skip).limit(limit).lean(),
      Item.countDocuments(filter),
    ]);
    return paginated(res, items.map(publicItem), total, page, limit);
  } catch (err) { next(err); }
};

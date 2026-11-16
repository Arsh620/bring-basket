const mongoose = require('mongoose');
const Wishlist = require('../../models/catalog/Wishlist');
const Item = require('../../models/catalog/Item');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

// GET /customer/wish-list
exports.list = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const [items, total] = await Promise.all([
      Wishlist.find({ userId: req.user.id })
        .populate('itemId', 'name image price discount discountType stock avgRating')
        .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Wishlist.countDocuments({ userId: req.user.id }),
    ]);
    return paginated(res, items, total, page, limit);
  } catch (err) { next(err); }
};

// POST /customer/wish-list/add  body: { item_id }
exports.add = async (req, res, next) => {
  try {
    const { item_id } = req.body;
    if (!item_id || !mongoose.isValidObjectId(item_id)) return error(res, 'Valid item_id is required', 400);
    const item = await Item.findOne({ _id: item_id, status: true }).lean();
    if (!item) return error(res, 'Item not found', 404);
    const existing = await Wishlist.findOne({ userId: req.user.id, itemId: item_id });
    if (existing) return error(res, 'Item already in wishlist', 409);
    const wish = await Wishlist.create({ userId: req.user.id, itemId: item_id });
    return success(res, wish, 'Added to wishlist', 201);
  } catch (err) { next(err); }
};

// DELETE /customer/wish-list/remove?item_id=
exports.remove = async (req, res, next) => {
  try {
    const item_id = req.query.item_id || req.body.item_id;
    if (!item_id || !mongoose.isValidObjectId(item_id)) return error(res, 'Valid item_id is required', 400);
    const wish = await Wishlist.findOneAndDelete({ userId: req.user.id, itemId: item_id });
    if (!wish) return error(res, 'Item not in wishlist', 404);
    return success(res, null, 'Removed from wishlist');
  } catch (err) { next(err); }
};

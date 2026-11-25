const mongoose = require('mongoose');
const ItemReview = require('../../models/catalog/ItemReview');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getAll = async (query = {}) => {
  const { skip, page, limit } = paginate(query);
  const filter = {};
  if (query.itemId && mongoose.isValidObjectId(query.itemId)) filter.itemId = query.itemId;
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  if (query.search?.trim()) filter.comment = { $regex: esc(query.search.trim()), $options: 'i' };
  const [reviews, total] = await Promise.all([
    ItemReview.find(filter)
      .populate('itemId', 'name image')
      .populate('userId', 'fName lName image')
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    ItemReview.countDocuments(filter),
  ]);
  return { reviews, total, page, limit, pages: Math.ceil(total / limit) };
};

const create = async (userId, body) => {
  const { itemId, orderId, rating, comment } = body;
  if (!mongoose.isValidObjectId(itemId)) throw new AppError('Valid itemId is required', 400);
  if (!rating || rating < 1 || rating > 5) throw new AppError('rating must be 1-5', 400);
  const existing = await ItemReview.findOne({ itemId, userId, ...(orderId ? { orderId } : {}) });
  if (existing) throw new AppError('Review already submitted', 409);
  return ItemReview.create({ itemId, userId, orderId, rating, comment });
};

const toggle = async (id) => {
  const r = await ItemReview.findById(id);
  if (!r) throw new AppError('Review not found', 404);
  r.isActive = !r.isActive;
  await r.save();
  return r;
};

const remove = async (id) => {
  const r = await ItemReview.findByIdAndDelete(id);
  if (!r) throw new AppError('Review not found', 404);
};

module.exports = { getAll, create, toggle, remove };

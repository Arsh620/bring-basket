const mongoose = require('mongoose');
const Category = require('../../models/catalog/Category');
const Item = require('../../models/catalog/Item');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

// GET /customer/categories?moduleId=&parentId=&limit=&page=
exports.getAll = async (req, res, next) => {
  try {
    const filter = { status: true };
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId)) filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    filter.parentId = req.query.parentId && mongoose.isValidObjectId(req.query.parentId)
      ? new mongoose.Types.ObjectId(req.query.parentId)
      : null;

    const { skip, page, limit } = paginate(req.query);
    const [cats, total] = await Promise.all([
      Category.find(filter).sort({ priority: -1, name: 1 }).skip(skip).limit(limit).lean(),
      Category.countDocuments(filter),
    ]);
    return paginated(res, cats, total, page, limit);
  } catch (err) { next(err); }
};

// GET /customer/categories/:id/children
exports.getChildren = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid category id', 400);
    const children = await Category.find({ parentId: req.params.id, status: true }).sort({ priority: -1 }).lean();
    return success(res, children);
  } catch (err) { next(err); }
};

// GET /customer/categories/:id/items?limit=&page=
exports.getItems = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid category id', 400);
    const filter = { categoryId: new mongoose.Types.ObjectId(req.params.id), status: true, isApproved: true };
    const { skip, page, limit } = paginate(req.query);
    const [items, total] = await Promise.all([
      Item.find(filter).sort({ orderCount: -1 }).skip(skip).limit(limit).lean(),
      Item.countDocuments(filter),
    ]);
    return paginated(res, items, total, page, limit);
  } catch (err) { next(err); }
};

// GET /customer/categories/popular?moduleId=
exports.getPopular = async (req, res, next) => {
  try {
    const filter = { status: true, parentId: null };
    if (req.query.moduleId && mongoose.isValidObjectId(req.query.moduleId)) filter.moduleId = new mongoose.Types.ObjectId(req.query.moduleId);
    const cats = await Category.find(filter).sort({ priority: -1 }).limit(20).lean();
    return success(res, cats);
  } catch (err) { next(err); }
};

const Item = require('../../../models/catalog/Item');

exports.getAll = async (req, res, next) => {
  try {
    const { storeId, categoryId, status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (storeId) filter.storeId = storeId;
    if (categoryId) filter.categoryId = categoryId;
    if (status !== undefined) filter.status = status === 'true';
    if (search) filter.name = { $regex: search, $options: 'i' };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Item.find(filter).populate('categoryId brandId unitId').skip(skip).limit(Number(limit)),
      Item.countDocuments(filter),
    ]);
    res.json({ success: true, data: items, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id).populate('categoryId brandId unitId');
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const item = await Item.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
};

exports.updateStock = async (req, res, next) => {
  try {
    const { stock } = req.body;
    const item = await Item.findByIdAndUpdate(req.params.id, { stock }, { new: true });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};

exports.getLowStock = async (req, res, next) => {
  try {
    const { storeId, threshold = 10 } = req.query;
    const filter = { stock: { $lte: Number(threshold) }, status: true };
    if (storeId) filter.storeId = storeId;
    const items = await Item.find(filter).populate('categoryId brandId');
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
};

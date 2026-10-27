const mongoose = require('mongoose');
const ItemBatch = require('../../../models/catalog/ItemBatch');
const Item = require('../../../models/catalog/Item');
const { success, error } = require('../../../utils/response');
const { paginate } = require('../../../utils/pagination');

const isValidId = (id) => mongoose.isValidObjectId(id);

exports.getAll = async (req, res, next) => {
  try {
    const { itemId, storeId, expiredOnly, page, limit: lim } = req.query;
    const filter = {};
    if (itemId) {
      if (!isValidId(itemId)) return error(res, 'Invalid itemId', 400);
      filter.itemId = itemId;
    }
    if (storeId) {
      if (!isValidId(storeId)) return error(res, 'Invalid storeId', 400);
      filter.storeId = storeId;
    }
    if (expiredOnly === 'true') filter.expiryDate = { $lt: new Date() };

    const { skip, page: pg, limit } = paginate({ page, limit: lim });
    const [batches, total] = await Promise.all([
      ItemBatch.find(filter)
        .populate('itemId', 'name sku')
        .populate('storeId', 'name')
        .sort({ expiryDate: 1 })
        .skip(skip).limit(limit),
      ItemBatch.countDocuments(filter),
    ]);
    return res.json({ success: true, data: batches, pagination: { total, page: pg, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid batch ID', 400);
    const batch = await ItemBatch.findById(req.params.id)
      .populate('itemId', 'name sku')
      .populate('storeId', 'name');
    if (!batch) return error(res, 'Not found', 404);
    return success(res, batch);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { itemId, storeId, batchCode, qty, expiryDate } = req.body;
    if (!itemId || !isValidId(itemId)) return error(res, 'Valid itemId is required', 400);
    if (!storeId || !isValidId(storeId)) return error(res, 'Valid storeId is required', 400);
    if (qty === undefined || isNaN(qty) || Number(qty) < 0)
      return error(res, 'qty must be a non-negative number', 400);

    const itemExists = await Item.findById(itemId);
    if (!itemExists) return error(res, 'Item not found', 404);

    const batch = await ItemBatch.create({ itemId, storeId, batchCode, qty: Number(qty), expiryDate });
    return success(res, batch, 'Batch created', 201);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid batch ID', 400);
    const allowed = ['batchCode', 'qty', 'expiryDate'];
    const fields = Object.fromEntries(
      allowed.filter(k => req.body[k] !== undefined).map(k => [k, req.body[k]])
    );
    if (!Object.keys(fields).length) return error(res, 'No valid fields to update', 400);
    if (fields.qty !== undefined && (isNaN(fields.qty) || Number(fields.qty) < 0))
      return error(res, 'qty must be a non-negative number', 400);
    if (fields.qty !== undefined) fields.qty = Number(fields.qty);

    const batch = await ItemBatch.findByIdAndUpdate(req.params.id, fields, { new: true });
    if (!batch) return error(res, 'Not found', 404);
    return success(res, batch);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid batch ID', 400);
    const batch = await ItemBatch.findByIdAndDelete(req.params.id);
    if (!batch) return error(res, 'Not found', 404);
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

exports.getExpiringSoon = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const { storeId } = req.query;
    const filter = {
      expiryDate: { $gte: new Date(), $lte: new Date(Date.now() + days * 86400000) },
    };
    if (storeId) {
      if (!isValidId(storeId)) return error(res, 'Invalid storeId', 400);
      filter.storeId = storeId;
    }
    const batches = await ItemBatch.find(filter)
      .populate('itemId', 'name sku')
      .populate('storeId', 'name')
      .sort({ expiryDate: 1 });
    return success(res, batches);
  } catch (err) { next(err); }
};

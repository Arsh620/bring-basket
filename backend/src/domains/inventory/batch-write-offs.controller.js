const mongoose = require('mongoose');
const BatchWriteOff = require('../../models/catalog/BatchWriteOff');
const storeStockService = require('./store-stock.service');
const catalogItemService = require('../catalog/items.service');
const { success, error } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

const isValidId = (id) => mongoose.isValidObjectId(id);

exports.getAll = async (req, res, next) => {
  try {
    const { itemId, storeId, page, limit: lim } = req.query;
    const filter = {};
    if (itemId) {
      if (!isValidId(itemId)) return error(res, 'Invalid itemId', 400);
      filter.itemId = itemId;
    }
    if (storeId) {
      if (!isValidId(storeId)) return error(res, 'Invalid storeId', 400);
      filter.storeId = storeId;
    }

    const { skip, page: pg, limit } = paginate({ page, limit: lim });
    const [writeOffs, total] = await Promise.all([
      BatchWriteOff.find(filter)
        .populate('itemId', 'name sku barcode')
        .populate('storeId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit),
      BatchWriteOff.countDocuments(filter),
    ]);
    return res.json({ success: true, data: writeOffs, pagination: { total, page: pg, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { itemId, storeId, batchCode, expiryDate, qty, reason } = req.body;
    if (!itemId || !isValidId(itemId)) return error(res, 'Valid itemId is required', 400);
    if (qty === undefined || isNaN(qty) || Number(qty) <= 0)
      return error(res, 'qty must be a positive number', 400);

    const stockContext = await catalogItemService.getStockContext(itemId);
    if (!stockContext) return error(res, 'Item not found', 404);
    await storeStockService.changeStoreItemStock(
      stockContext,
      -Number(qty),
      storeId,
    );

    const writeOff = await BatchWriteOff.create({ itemId, storeId, batchCode, expiryDate, qty: Number(qty), reason });
    return success(res, writeOff, 'Write-off recorded', 201);
  } catch (err) { next(err); }
};

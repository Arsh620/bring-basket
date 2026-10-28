const mongoose = require('mongoose');
const WarehouseStockMovement = require('../../models/warehouse/WarehouseStockMovement');
const { success, error } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

const isValidId = (id) => mongoose.isValidObjectId(id);

// GET /stock-movements
exports.getAll = async (req, res, next) => {
  try {
    const { warehouseId, itemId, storeId, type, from, to, page, limit: lim } = req.query;
    const filter = {};

    if (warehouseId) {
      if (!isValidId(warehouseId)) return error(res, 'Invalid warehouseId', 400);
      filter.warehouseId = warehouseId;
    }
    if (itemId) {
      if (!isValidId(itemId)) return error(res, 'Invalid itemId', 400);
      filter.itemId = itemId;
    }
    if (storeId) {
      if (!isValidId(storeId)) return error(res, 'Invalid storeId', 400);
      filter.storeId = storeId;
    }
    if (type) filter.type = type;
    if (from || to) {
      filter.movedAt = {};
      if (from) filter.movedAt.$gte = new Date(from);
      if (to) filter.movedAt.$lte = new Date(to);
    }

    const { skip, page: pg, limit } = paginate({ page, limit: lim });
    const [movements, total] = await Promise.all([
      WarehouseStockMovement.find(filter)
        .populate('warehouseId', 'name code')
        .populate('itemId', 'name sku barcode')
        .populate('storeId', 'name')
        .sort({ movedAt: -1 })
        .skip(skip).limit(limit),
      WarehouseStockMovement.countDocuments(filter),
    ]);

    return res.json({ success: true, data: movements, pagination: { total, page: pg, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

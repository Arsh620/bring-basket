const mongoose = require('mongoose');
const WarehouseItemStock = require('../../../models/warehouse/WarehouseItemStock');
const WarehouseStockMovement = require('../../../models/warehouse/WarehouseStockMovement');
const Warehouse = require('../../../models/warehouse/Warehouse');
const Item = require('../../../models/catalog/Item');
const { success, error } = require('../../../utils/response');
const { paginate } = require('../../../utils/pagination');

const isValidId = (id) => mongoose.isValidObjectId(id);

// GET /warehouses/:id/stock
exports.getStock = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid warehouse ID', 400);
    const { itemId, status, page, limit: lim } = req.query;
    const filter = { warehouseId: req.params.id };
    if (itemId) {
      if (!isValidId(itemId)) return error(res, 'Invalid itemId', 400);
      filter.itemId = itemId;
    }
    if (status) filter.status = status;

    const { skip, page: pg, limit } = paginate({ page, limit: lim });
    const [stocks, total] = await Promise.all([
      WarehouseItemStock.find(filter)
        .populate('itemId', 'name sku barcode unitId')
        .skip(skip).limit(limit)
        .sort({ createdAt: -1 }),
      WarehouseItemStock.countDocuments(filter),
    ]);
    return res.json({ success: true, data: stocks, pagination: { total, page: pg, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

// PUT /warehouses/:id/stock/:itemId  — set opening/current balance
exports.setStock = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid warehouse ID', 400);
    if (!isValidId(req.params.itemId)) return error(res, 'Invalid item ID', 400);

    const { qty, variant = '', sellingPrice, mrp, status } = req.body;
    if (qty === undefined || isNaN(qty) || Number(qty) < 0)
      return error(res, 'qty must be a non-negative number', 400);

    const [warehouse, item] = await Promise.all([
      Warehouse.findById(req.params.id),
      Item.findById(req.params.itemId),
    ]);
    if (!warehouse) return error(res, 'Warehouse not found', 404);
    if (!item) return error(res, 'Item not found', 404);

    const stock = await WarehouseItemStock.findOneAndUpdate(
      { warehouseId: req.params.id, itemId: req.params.itemId, variant },
      { qty: Number(qty), sellingPrice, mrp, status },
      { new: true, upsert: true }
    );

    // Log movement
    await WarehouseStockMovement.create({
      warehouseId: req.params.id,
      itemId: req.params.itemId,
      qtyChange: Number(qty),
      balanceAfter: Number(qty),
      type: 'opening',
      note: 'Opening stock set',
      actorType: req.user?.role,
      actorId: req.user?.id,
      movedAt: new Date(),
    });

    return success(res, stock);
  } catch (err) { next(err); }
};

// PATCH /warehouses/:id/stock/:itemId/adjust
exports.adjustStock = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid warehouse ID', 400);
    if (!isValidId(req.params.itemId)) return error(res, 'Invalid item ID', 400);

    const { qtyChange, variant = '', note, type = 'adjustment' } = req.body;
    if (qtyChange === undefined || isNaN(qtyChange))
      return error(res, 'qtyChange is required (positive = add, negative = deduct)', 400);

    const stock = await WarehouseItemStock.findOne({
      warehouseId: req.params.id,
      itemId: req.params.itemId,
      variant,
    });
    if (!stock) return error(res, 'Stock record not found. Set opening stock first.', 404);

    const newQty = stock.qty + Number(qtyChange);
    if (newQty < 0) return error(res, 'Insufficient stock. Cannot go below 0.', 400);

    stock.qty = newQty;
    await stock.save();

    await WarehouseStockMovement.create({
      warehouseId: req.params.id,
      itemId: req.params.itemId,
      qtyChange: Number(qtyChange),
      balanceAfter: newQty,
      type,
      note,
      actorType: req.user?.role,
      actorId: req.user?.id,
      movedAt: new Date(),
    });

    return success(res, { stock, balanceAfter: newQty });
  } catch (err) { next(err); }
};

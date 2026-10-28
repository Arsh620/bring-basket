const mongoose = require('mongoose');
const WarehouseItemStock = require('../../models/warehouse/WarehouseItemStock');
const WarehouseStockMovement = require('../../models/warehouse/WarehouseStockMovement');
const Warehouse = require('../../models/warehouse/Warehouse');
const Item = require('../../models/catalog/Item');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

const validateId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${label} ID`, 400);
};

const getStock = async (warehouseId, query) => {
  validateId(warehouseId, 'warehouse');
  const { itemId, status, page, limit: lim } = query;
  const filter = { warehouseId };
  if (itemId) { validateId(itemId, 'item'); filter.itemId = itemId; }
  if (status) filter.status = status;

  const { skip, page: pg, limit } = paginate({ page, limit: lim });
  const [stocks, total] = await Promise.all([
    WarehouseItemStock.find(filter)
      .populate('itemId', 'name sku barcode unitId')
      .skip(skip).limit(limit)
      .sort({ createdAt: -1 }),
    WarehouseItemStock.countDocuments(filter),
  ]);
  return { stocks, pagination: { total, page: pg, limit, pages: Math.ceil(total / limit) } };
};

const setStock = async (warehouseId, itemId, body, actor = {}) => {
  validateId(warehouseId, 'warehouse');
  validateId(itemId, 'item');

  const { qty, variant = '', sellingPrice, mrp, status } = body;
  if (qty === undefined || isNaN(qty) || Number(qty) < 0)
    throw new AppError('qty must be a non-negative number', 400);

  const [warehouse, item] = await Promise.all([
    Warehouse.findById(warehouseId),
    Item.findById(itemId),
  ]);
  if (!warehouse) throw new AppError('Warehouse not found', 404);
  if (!item) throw new AppError('Item not found', 404);

  const stock = await WarehouseItemStock.findOneAndUpdate(
    { warehouseId, itemId, variant },
    { qty: Number(qty), sellingPrice, mrp, status },
    { new: true, upsert: true },
  );

  await WarehouseStockMovement.create({
    warehouseId, itemId,
    qtyChange: Number(qty),
    balanceAfter: Number(qty),
    type: 'opening',
    note: 'Opening stock set',
    actorType: actor.role,
    actorId: actor.id,
    movedAt: new Date(),
  });

  return stock;
};

const adjustStock = async (warehouseId, itemId, body, actor = {}) => {
  validateId(warehouseId, 'warehouse');
  validateId(itemId, 'item');

  const { qtyChange, variant = '', note, type = 'adjustment' } = body;
  if (qtyChange === undefined || isNaN(qtyChange))
    throw new AppError('qtyChange is required (positive = add, negative = deduct)', 400);

  const stock = await WarehouseItemStock.findOne({ warehouseId, itemId, variant });
  if (!stock) throw new AppError('Stock record not found. Set opening stock first.', 404);

  const newQty = stock.qty + Number(qtyChange);
  if (newQty < 0) throw new AppError('Insufficient stock. Cannot go below 0.', 400);

  stock.qty = newQty;
  await stock.save();

  await WarehouseStockMovement.create({
    warehouseId, itemId,
    qtyChange: Number(qtyChange),
    balanceAfter: newQty,
    type, note,
    actorType: actor.role,
    actorId: actor.id,
    movedAt: new Date(),
  });

  return { stock, balanceAfter: newQty };
};

module.exports = { getStock, setStock, adjustStock };

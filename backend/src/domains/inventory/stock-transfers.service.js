const mongoose = require('mongoose');
const WarehouseStockTransfer = require('../../models/warehouse/WarehouseStockTransfer');
const WarehouseItemStock = require('../../models/warehouse/WarehouseItemStock');
const WarehouseStockMovement = require('../../models/warehouse/WarehouseStockMovement');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

const isValidId = (id) => mongoose.isValidObjectId(id);

const validateTransferId = (id) => {
  if (!isValidId(id)) throw new AppError('Invalid transfer ID', 400);
};

const getAll = async ({ status, motherWarehouseId, subWarehouseId, page, limit: lim }) => {
  const filter = {};
  if (status) filter.status = status;
  if (motherWarehouseId) filter.motherWarehouseId = motherWarehouseId;
  if (subWarehouseId) filter.subWarehouseId = subWarehouseId;

  const { skip, page: currentPage, limit } = paginate({ page, limit: lim });
  const [transfers, total] = await Promise.all([
    WarehouseStockTransfer.find(filter)
      .populate('motherWarehouseId', 'name code')
      .populate('subWarehouseId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    WarehouseStockTransfer.countDocuments(filter),
  ]);
  return {
    transfers,
    pagination: { total, page: currentPage, limit, pages: Math.ceil(total / limit) },
  };
};

const getOne = async (id) => {
  validateTransferId(id);
  const transfer = await WarehouseStockTransfer.findById(id)
    .populate('motherWarehouseId', 'name code')
    .populate('subWarehouseId', 'name code')
    .populate('items.itemId', 'name sku barcode');
  if (!transfer) throw new AppError('Not found', 404);
  return transfer;
};

const create = async ({ motherWarehouseId, subWarehouseId, items, notes, type }) => {
  if (!motherWarehouseId || !isValidId(motherWarehouseId)) {
    throw new AppError('Valid motherWarehouseId is required', 400);
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('items array is required', 400);
  }

  const itemIds = items.map((item) => item.itemId?.toString());
  if (new Set(itemIds).size !== itemIds.length) {
    throw new AppError('Duplicate items in transfer', 400);
  }
  for (const item of items) {
    if (!isValidId(item.itemId)) throw new AppError(`Invalid itemId: ${item.itemId}`, 400);
    if (!item.qtyRequested || Number(item.qtyRequested) <= 0) {
      throw new AppError('qtyRequested must be > 0 for all items', 400);
    }
  }

  return WarehouseStockTransfer.create({
    motherWarehouseId,
    subWarehouseId,
    notes,
    type,
    items: items.map((item) => ({
      itemId: item.itemId,
      qtyRequested: Number(item.qtyRequested),
      qtySent: 0,
    })),
  });
};

const dispatch = async (id, { items, challanNumber, notes }, actor = {}) => {
  validateTransferId(id);
  const transfer = await WarehouseStockTransfer.findById(id);
  if (!transfer) throw new AppError('Not found', 404);
  if (transfer.status !== 'requested') {
    throw new AppError(`Cannot dispatch — status is ${transfer.status}`, 400);
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('items with qtySent required', 400);
  }

  for (const sentItem of items) {
    const transferItem = transfer.items.find(
      (item) => item.itemId.toString() === sentItem.itemId?.toString(),
    );
    if (!transferItem) throw new AppError(`Item ${sentItem.itemId} not in transfer`, 400);
    if (Number(sentItem.qtySent) > transferItem.qtyRequested) {
      throw new AppError(`qtySent cannot exceed qtyRequested for item ${sentItem.itemId}`, 400);
    }

    const stock = await WarehouseItemStock.findOne({
      warehouseId: transfer.motherWarehouseId,
      itemId: sentItem.itemId,
      variant: sentItem.variant || '',
    });
    if (!stock || stock.qty < Number(sentItem.qtySent)) {
      throw new AppError(`Insufficient stock in mother warehouse for item ${sentItem.itemId}`, 400);
    }

    stock.qty -= Number(sentItem.qtySent);
    await stock.save();
    await WarehouseStockMovement.create({
      warehouseId: transfer.motherWarehouseId,
      itemId: sentItem.itemId,
      qtyChange: -Number(sentItem.qtySent),
      balanceAfter: stock.qty,
      type: 'transfer_out',
      referenceType: 'WarehouseStockTransfer',
      referenceId: transfer._id,
      otherWarehouseId: transfer.subWarehouseId,
      actorType: actor?.role,
      actorId: actor?.id,
      movedAt: new Date(),
    });
    transferItem.qtySent = Number(sentItem.qtySent);
  }

  transfer.status = 'dispatched';
  transfer.challanNumber = challanNumber;
  if (notes) transfer.notes = notes;
  transfer.dispatchedAt = new Date();
  await transfer.save();
  return transfer;
};

const receive = async (id, actor = {}) => {
  validateTransferId(id);
  const transfer = await WarehouseStockTransfer.findById(id);
  if (!transfer) throw new AppError('Not found', 404);
  if (transfer.status !== 'dispatched') {
    throw new AppError(`Cannot receive — status is ${transfer.status}`, 400);
  }

  for (const transferItem of transfer.items) {
    if (!transferItem.qtySent) continue;

    await WarehouseItemStock.findOneAndUpdate(
      {
        warehouseId: transfer.subWarehouseId,
        itemId: transferItem.itemId,
        variant: '',
      },
      { $inc: { qty: transferItem.qtySent } },
      { upsert: true, new: true },
    );
    const updatedStock = await WarehouseItemStock.findOne({
      warehouseId: transfer.subWarehouseId,
      itemId: transferItem.itemId,
      variant: '',
    });
    await WarehouseStockMovement.create({
      warehouseId: transfer.subWarehouseId,
      itemId: transferItem.itemId,
      qtyChange: transferItem.qtySent,
      balanceAfter: updatedStock?.qty,
      type: 'transfer_in',
      referenceType: 'WarehouseStockTransfer',
      referenceId: transfer._id,
      otherWarehouseId: transfer.motherWarehouseId,
      actorType: actor?.role,
      actorId: actor?.id,
      movedAt: new Date(),
    });
  }

  transfer.status = 'received';
  transfer.receivedAt = new Date();
  await transfer.save();
  return transfer;
};

const reject = async (id, rejectReason) => {
  validateTransferId(id);
  if (!rejectReason?.trim()) throw new AppError('rejectReason is required', 400);

  const transfer = await WarehouseStockTransfer.findById(id);
  if (!transfer) throw new AppError('Not found', 404);
  if (!['requested', 'dispatched'].includes(transfer.status)) {
    throw new AppError(`Cannot reject — status is ${transfer.status}`, 400);
  }
  transfer.status = 'rejected';
  transfer.rejectReason = rejectReason.trim();
  await transfer.save();
  return transfer;
};

module.exports = { getAll, getOne, create, dispatch, receive, reject };

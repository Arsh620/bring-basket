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

  if (!['transfer', 'return'].includes(type || 'transfer')) {
    throw new AppError('type must be transfer or return', 400);
  }

  if (type === 'return') {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (const item of items) {
        const stock = await WarehouseItemStock.findOne({ warehouseId: subWarehouseId, itemId: item.itemId, variant: '' }).session(session);
        if (!stock || stock.qty < Number(item.qtyRequested)) {
          throw new AppError(`Insufficient stock in sub warehouse for item ${item.itemId}`, 400);
        }
      }

      const [transfer] = await WarehouseStockTransfer.create([{
        motherWarehouseId,
        subWarehouseId,
        type: 'return',
        notes,
        status: 'dispatched',
        dispatchedAt: new Date(),
        items: items.map((item) => ({
          itemId: item.itemId,
          qtyRequested: Number(item.qtyRequested),
          qtySent: Number(item.qtyRequested),
        })),
      }], { session });

      for (const item of items) {
        const stock = await WarehouseItemStock.findOne({ warehouseId: subWarehouseId, itemId: item.itemId, variant: '' }).session(session);
        stock.qty -= Number(item.qtyRequested);
        await stock.save({ session });
        await WarehouseStockMovement.create([{
          warehouseId: subWarehouseId,
          itemId: item.itemId,
          qtyChange: -Number(item.qtyRequested),
          balanceAfter: stock.qty,
          type: 'transfer_out',
          referenceType: 'WarehouseStockTransfer',
          referenceId: transfer._id,
          otherWarehouseId: motherWarehouseId,
          movedAt: new Date(),
        }], { session });
      }

      transfer.challanNumber = `RTN-${String(transfer._id).toUpperCase()}`;
      await transfer.save({ session });
      await session.commitTransaction();
      return transfer;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
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
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    for (const sentItem of items) {
      const transferItem = transfer.items.find(
        (item) => item.itemId.toString() === sentItem.itemId?.toString(),
      );
      const stock = await WarehouseItemStock.findOne({
        warehouseId: transfer.motherWarehouseId,
        itemId: sentItem.itemId,
        variant: sentItem.variant || '',
      }).session(session);

      stock.qty -= Number(sentItem.qtySent);
      await stock.save({ session });
      await WarehouseStockMovement.create([{
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
      }], { session });
      transferItem.qtySent = Number(sentItem.qtySent);
    }

    transfer.status = 'dispatched';
    transfer.challanNumber = challanNumber;
    if (notes) transfer.notes = notes;
    transfer.dispatchedAt = new Date();
    await transfer.save({ session });
    await session.commitTransaction();
    return transfer;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const receive = async (id, actor = {}) => {
  validateTransferId(id);
  const transfer = await WarehouseStockTransfer.findById(id);
  if (!transfer) throw new AppError('Not found', 404);
  if (transfer.status !== 'dispatched') {
    throw new AppError(`Cannot receive — status is ${transfer.status}`, 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const destinationWarehouseId = transfer.type === 'return' ? transfer.motherWarehouseId : transfer.subWarehouseId;
    const sourceWarehouseId = transfer.type === 'return' ? transfer.subWarehouseId : transfer.motherWarehouseId;
    for (const transferItem of transfer.items) {
      if (!transferItem.qtySent) continue;

      const updatedStock = await WarehouseItemStock.findOneAndUpdate(
        { warehouseId: destinationWarehouseId, itemId: transferItem.itemId, variant: '', },
        { $inc: { qty: transferItem.qtySent } },
        { upsert: true, new: true, session },
      );
      await WarehouseStockMovement.create([{
        warehouseId: destinationWarehouseId,
        itemId: transferItem.itemId,
        qtyChange: transferItem.qtySent,
        balanceAfter: updatedStock?.qty,
        type: 'transfer_in',
        referenceType: 'WarehouseStockTransfer',
        referenceId: transfer._id,
        otherWarehouseId: sourceWarehouseId,
        actorType: actor?.role,
        actorId: actor?.id,
        movedAt: new Date(),
      }], { session });
    }

    transfer.status = 'received';
    transfer.receivedAt = new Date();
    await transfer.save({ session });
    await session.commitTransaction();
    return transfer;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const reject = async (id, rejectReason) => {
  validateTransferId(id);
  if (!rejectReason?.trim()) throw new AppError('rejectReason is required', 400);

  const transfer = await WarehouseStockTransfer.findById(id);
  if (!transfer) throw new AppError('Not found', 404);
  if (transfer.status !== 'requested') {
    throw new AppError(`Cannot reject — status is ${transfer.status}`, 400);
  }
  transfer.status = 'rejected';
  transfer.rejectReason = rejectReason.trim();
  await transfer.save();
  return transfer;
};

const cancel = async (id) => {
  validateTransferId(id);
  const transfer = await WarehouseStockTransfer.findById(id);
  if (!transfer) throw new AppError('Not found', 404);
  if (transfer.status !== 'requested') throw new AppError('Only requested transfers can be cancelled', 400);
  transfer.status = 'cancelled';
  await transfer.save();
  return transfer;
};

module.exports = { getAll, getOne, create, dispatch, receive, reject, cancel };

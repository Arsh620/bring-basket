const mongoose = require('mongoose');
const Item = require('../../models/catalog/Item');
const Store = require('../../models/store/Store');
const StoreItemStock = require('./store-item-stock.model');
const OrderStockReservation = require('../../models/warehouse/OrderStockReservation');
const StoreStockMovement = require('../../models/store/StoreStockMovement');
const AppError = require('../../utils/AppError');

const validateId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${label}`, 400);
};

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) throw new AppError('items are required', 400);
  const quantities = new Map();
  for (const line of items) {
    if (!mongoose.isValidObjectId(line?.itemId)) throw new AppError('Invalid itemId', 400);
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty <= 0) throw new AppError('Each qty must be a positive number', 400);
    const itemId = String(line.itemId);
    quantities.set(itemId, (quantities.get(itemId) || 0) + qty);
  }
  return [...quantities]
    .map(([itemId, qty]) => ({ itemId, qty }))
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
};

const reserve = async (orderId, storeId, items) => {
  validateId(orderId, 'orderId');
  validateId(storeId, 'storeId');
  const lines = normalizeItems(items);
  const session = await mongoose.startSession();
  let reservation;
  try {
    await session.withTransaction(async () => {
      reservation = await OrderStockReservation.findOne({ orderId }).session(session);
      if (reservation) {
        const sameRequest = reservation.storeId.toString() === storeId
          && JSON.stringify(reservation.items.map((line) => [line.itemId.toString(), line.qty]).sort())
            === JSON.stringify(lines.map((line) => [line.itemId, line.qty]).sort());
        if (!sameRequest) throw new AppError('Order stock reservation conflicts with existing reservation', 409);
        if (reservation.status === 'released') throw new AppError('Order stock reservation has already been released', 409);
        return;
      }

      const store = await Store.findById(storeId).select('legacyId').session(session);
      if (!store) throw new AppError('Store not found', 404);
      const storeReferences = [store._id.toString(), store.legacyId?.toString()].filter(Boolean);

      const reservedItems = [];
      for (const line of lines) {
        const item = await Item.findById(line.itemId).select('name storeId stock status isApproved').session(session);
        if (!item || !item.status || !item.isApproved) throw new AppError('Item is unavailable', 409);
        if (!storeReferences.includes(item.storeId.toString())) {
          throw new AppError(`${item.name} does not belong to this store`, 409);
        }

        const filter = { storeId, itemId: line.itemId, variant: '' };
        let stock = await StoreItemStock.findOneAndUpdate(
          { ...filter, qty: { $gte: line.qty } },
          { $inc: { qty: -line.qty } },
          { new: true, session, runValidators: true },
        );
        if (!stock) {
          const exists = await StoreItemStock.exists(filter).session(session);
          if (exists) throw new AppError(`Insufficient stock for ${item.name}`, 409);
          if (Number(item.stock || 0) < line.qty) throw new AppError(`Insufficient stock for ${item.name}`, 409);
          try {
            [stock] = await StoreItemStock.create([{
              ...filter,
              qty: Number(item.stock || 0) - line.qty,
            }], { session });
          } catch (error) {
            if (error.code === 11000) throw new AppError(`Insufficient stock for ${item.name}`, 409);
            throw error;
          }
        }

        reservedItems.push({ itemId: item._id, qty: line.qty, itemName: item.name, balanceAfter: stock.qty });
      }

      reservation = new OrderStockReservation({
        orderId,
        storeId,
        status: 'reserved',
        items: lines,
      });
      await reservation.save({ session });

      for (const line of reservedItems) {
        await StoreStockMovement.create([{
          storeId,
          itemId: line.itemId,
          qtyChange: -line.qty,
          balanceAfter: line.balanceAfter,
          type: 'order_placed',
          referenceType: 'order',
          referenceId: orderId,
          referenceNo: String(orderId),
          note: `Stock reserved for order ${orderId}`,
          actorType: 'system',
          movedAt: new Date(),
        }], { session });
      }
    });
  } finally {
    await session.endSession();
  }
  return reservation;
};

const commit = async (orderId) => {
  validateId(orderId, 'orderId');
  const reservation = await OrderStockReservation.findOneAndUpdate(
    { orderId, status: 'reserved' },
    { $set: { status: 'committed', committedAt: new Date() } },
    { new: true },
  );
  if (reservation) return reservation;
  const existing = await OrderStockReservation.findOne({ orderId });
  if (existing?.status === 'committed') return existing;
  throw new AppError('Active stock reservation not found', 409);
};

const release = async (orderId) => {
  validateId(orderId, 'orderId');
  const session = await mongoose.startSession();
  let reservation;
  try {
    await session.withTransaction(async () => {
      reservation = await OrderStockReservation.findOne({ orderId }).session(session);
      if (!reservation) throw new AppError('Stock reservation not found', 404);
      if (reservation.status === 'released') return;

      for (const line of reservation.items) {
        const stock = await StoreItemStock.findOneAndUpdate(
          { storeId: reservation.storeId, itemId: line.itemId, variant: '' },
          { $inc: { qty: line.qty } },
          { new: true, session, runValidators: true },
        );
        if (!stock) throw new AppError(`Stock record not found for item ${line.itemId}`, 409);
        await StoreStockMovement.create([{
          storeId: reservation.storeId,
          itemId: line.itemId,
          qtyChange: line.qty,
          balanceAfter: stock.qty,
          type: 'order_canceled',
          referenceType: 'order',
          referenceId: orderId,
          referenceNo: String(orderId),
          note: `Stock restored for canceled order ${orderId}`,
          actorType: 'system',
          movedAt: new Date(),
        }], { session });
      }
      reservation.status = 'released';
      reservation.releasedAt = new Date();
      await reservation.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return reservation;
};

module.exports = { reserve, commit, release };

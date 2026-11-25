const mongoose = require('mongoose');
const Item = require('../../models/catalog/Item');
const Store = require('../../models/store/Store');
const StoreItemStock = require('./store-item-stock.model');
const OrderStockReservation = require('../../models/warehouse/OrderStockReservation');
const StoreStockMovement = require('../../models/store/StoreStockMovement');
const ItemBatch = require('../../models/catalog/ItemBatch');
const AppError = require('../../utils/AppError');

const validateId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${label}`, 400);
};

const indiaStartOfDay = () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  now.setHours(0, 0, 0, 0);
  return now;
};

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) throw new AppError('items are required', 400);
  const quantities = new Map();
  for (const line of items) {
    if (!mongoose.isValidObjectId(line?.itemId)) throw new AppError('Invalid itemId', 400);
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty <= 0) throw new AppError('Each qty must be a positive number', 400);
    const itemId = String(line.itemId);
    const variant = String(line.variant || '').trim();
    const key = `${itemId}\u0000${variant}`;
    const current = quantities.get(key);
    quantities.set(key, { itemId, variant, qty: (current?.qty || 0) + qty });
  }
  return [...quantities.values()].sort((left, right) => left.itemId.localeCompare(right.itemId) || left.variant.localeCompare(right.variant));
};

const asVariants = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  return [];
};

const syncVariantStock = (item, variant, qty) => {
  if (!variant) { item.stock = qty; return; }
  const variants = asVariants(item.variations);
  const selected = variants.find((entry) => entry?.type === variant);
  if (selected) {
    selected.stock = qty;
    item.variations = variants;
  }
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
          && JSON.stringify(reservation.items.map((line) => [line.itemId.toString(), line.variant || '', line.qty]).sort())
            === JSON.stringify(lines.map((line) => [line.itemId, line.variant, line.qty]).sort());
        if (!sameRequest) throw new AppError('Order stock reservation conflicts with existing reservation', 409);
        if (reservation.status === 'released') throw new AppError('Order stock reservation has already been released', 409);
        return;
      }

      const store = await Store.findById(storeId).select('legacyId').session(session);
      if (!store) throw new AppError('Store not found', 404);
      const storeReferences = [store._id.toString(), store.legacyId?.toString()].filter(Boolean);

      const reservedItems = [];
      for (const line of lines) {
        const item = await Item.findById(line.itemId).select('name storeId stock status isApproved trackBatch variations').session(session);
        if (!item || !item.status || !item.isApproved) throw new AppError('Item is unavailable', 409);
        if (!storeReferences.includes(item.storeId.toString())) {
          throw new AppError(`${item.name} does not belong to this store`, 409);
        }

        const filter = { storeId, itemId: line.itemId, variant: line.variant };
        let stock = await StoreItemStock.findOneAndUpdate(
          { ...filter, qty: { $gte: line.qty } },
          { $inc: { qty: -line.qty } },
          { new: true, session, runValidators: true },
        );
        if (!stock) {
          const exists = await StoreItemStock.exists(filter).session(session);
          if (exists) throw new AppError(`Insufficient stock for ${item.name}`, 409);
          let fallbackQty = Number(item.stock || 0);
          if (line.variant) {
            const selectedVariant = asVariants(item.variations).find((entry) => entry?.type === line.variant);
            if (!selectedVariant) throw new AppError(`Variant stock is not configured for ${item.name}`, 409);
            fallbackQty = Number(selectedVariant.stock || 0);
          } else if (item.trackBatch) {
            const today = indiaStartOfDay();
            const batchStock = await ItemBatch.aggregate([
              { $match: { storeId, itemId: line.itemId, qty: { $gt: 0 }, $or: [{ expiryDate: null }, { expiryDate: { $gte: today } }] } },
              { $group: { _id: null, qty: { $sum: '$qty' } } },
            ]).session(session);
            fallbackQty = Number(batchStock[0]?.qty || 0);
          }
          if (fallbackQty < line.qty) throw new AppError(`Insufficient stock for ${item.name}`, 409);
          try {
            [stock] = await StoreItemStock.create([{
              ...filter,
              qty: fallbackQty - line.qty,
            }], { session });
          } catch (error) {
            if (error.code === 11000) throw new AppError(`Insufficient stock for ${item.name}`, 409);
            throw error;
          }
        }

        let allocations = [];
        const batchTracked = Boolean(item.trackBatch && !line.variant);
        if (batchTracked) {
          const today = indiaStartOfDay();
          const batches = await ItemBatch.find({
            storeId,
            itemId: line.itemId,
            qty: { $gt: 0 },
            $or: [{ expiryDate: null }, { expiryDate: { $gte: today } }],
          }).sort({ _id: 1 }).session(session);
          batches.sort((left, right) => {
            if (!left.expiryDate) return right.expiryDate ? 1 : 0;
            if (!right.expiryDate) return -1;
            return new Date(left.expiryDate).getTime() - new Date(right.expiryDate).getTime();
          });
          const sellable = batches.reduce((sum, batch) => sum + Number(batch.qty || 0), 0);
          if (sellable + 0.000001 < line.qty) {
            throw new AppError(`Insufficient unexpired batch stock for ${item.name}`, 409);
          }
          let remaining = line.qty;
          for (const batch of batches) {
            if (remaining <= 0.000001) break;
            const take = Math.min(remaining, Number(batch.qty));
            const updated = await ItemBatch.findOneAndUpdate(
              { _id: batch._id, qty: { $gte: take } },
              { $inc: { qty: -take } },
              { new: true, session, runValidators: true },
            );
            if (!updated) throw new AppError(`Batch stock changed while reserving ${item.name}`, 409);
            allocations.push({ batchId: batch._id, batchCode: batch.batchCode, expiryDate: batch.expiryDate, qty: take });
            remaining -= take;
          }
          const sellableRemainder = await ItemBatch.aggregate([
            { $match: { storeId: item.storeId, itemId: item._id, qty: { $gt: 0 }, $or: [{ expiryDate: null }, { expiryDate: { $gte: today } }] } },
            { $group: { _id: null, qty: { $sum: '$qty' } } },
          ]).session(session);
          item.stock = Number(sellableRemainder[0]?.qty || 0);
        } else {
          syncVariantStock(item, line.variant, Number(stock.qty));
        }
        await item.save({ session });

        reservedItems.push({ itemId: item._id, variant: line.variant, qty: line.qty, itemName: item.name, balanceAfter: stock.qty, batchTracked, allocations });
      }

      reservation = new OrderStockReservation({
        orderId,
        storeId,
        status: 'reserved',
        items: reservedItems.map((line) => ({ itemId: line.itemId, variant: line.variant, qty: line.qty, batchTracked: line.batchTracked, allocations: line.allocations })),
      });
      await reservation.save({ session });

      for (const line of reservedItems) {
        await StoreStockMovement.create([{
          storeId,
          itemId: line.itemId,
          variant: line.variant,
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
          { storeId: reservation.storeId, itemId: line.itemId, variant: line.variant || '' },
          { $inc: { qty: line.qty } },
          { new: true, session, runValidators: true },
        );
        if (!stock) throw new AppError(`Stock record not found for item ${line.itemId}`, 409);
        if (line.batchTracked && Array.isArray(line.allocations)) {
          for (const allocation of line.allocations) {
            let batch = await ItemBatch.findById(allocation.batchId).session(session);
            if (batch) {
              batch.qty = Number(batch.qty || 0) + Number(allocation.qty || 0);
              await batch.save({ session });
            } else {
              [batch] = await ItemBatch.create([{
                storeId: reservation.storeId,
                itemId: line.itemId,
                batchCode: allocation.batchCode,
                expiryDate: allocation.expiryDate,
                qty: allocation.qty,
              }], { session });
            }
          }
        }
        const catalogItem = await Item.findById(line.itemId).select('stock trackBatch variations').session(session);
        if (catalogItem) {
          if (line.batchTracked && !line.variant) {
            const now = indiaStartOfDay();
            const batches = await ItemBatch.aggregate([
              { $match: { storeId: reservation.storeId, itemId: line.itemId, qty: { $gt: 0 }, $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }] } },
              { $group: { _id: null, qty: { $sum: '$qty' } } },
            ]).session(session);
            catalogItem.stock = Number(batches[0]?.qty || 0);
          } else {
            syncVariantStock(catalogItem, line.variant || '', Number(stock.qty));
          }
          await catalogItem.save({ session });
        }
        await StoreStockMovement.create([{
          storeId: reservation.storeId,
          itemId: line.itemId,
          variant: line.variant || '',
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

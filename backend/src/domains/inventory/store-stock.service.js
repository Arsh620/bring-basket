const mongoose = require('mongoose');
const StoreItemStock = require('./store-item-stock.model');
const AppError = require('../../utils/AppError');

const DEFAULT_VARIANT = '';

const toStockValue = (value) => {
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty < 0) {
    throw new AppError('stock must be a non-negative number', 400);
  }
  return qty;
};

const getStoreStocks = async (items) => {
  if (!items.length) return [];

  const records = await StoreItemStock.find({
    itemId: { $in: items.map((item) => item._id) },
    variant: DEFAULT_VARIANT,
  }).lean();
  const stockByItem = new Map(records.map((record) => [
    `${record.storeId.toString()}:${record.itemId.toString()}`,
    record.qty,
  ]));

  return items.map((item) => {
    const data = typeof item.toObject === 'function' ? item.toObject() : { ...item };
    const stockKey = item.storeId
      ? `${item.storeId.toString()}:${item._id.toString()}`
      : null;
    const stock = stockKey ? stockByItem.get(stockKey) : undefined;
    return { ...data, stock: stock ?? data.stock ?? 0 };
  });
};

const setStoreItemStock = async ({ itemId, storeId, qty: value }) => {
  if (!mongoose.isValidObjectId(itemId)) throw new AppError('Invalid item ID', 400);
  if (!mongoose.isValidObjectId(storeId)) throw new AppError('Invalid store ID', 400);
  const qty = toStockValue(value);

  const stockRecord = await StoreItemStock.findOneAndUpdate(
    { storeId, itemId, variant: DEFAULT_VARIANT },
    { $set: { qty } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await StoreItemStock.deleteMany({
    itemId,
    storeId: { $ne: storeId },
  });
  return stockRecord;
};

const changeStoreItemStock = async ({ itemId, storeId, legacyQty = 0 }, change, expectedStoreId) => {
  if (!mongoose.isValidObjectId(itemId)) throw new AppError('Invalid item ID', 400);
  if (!mongoose.isValidObjectId(storeId)) throw new AppError('Invalid store ID', 400);
  if (!Number.isFinite(Number(change))) throw new AppError('qtyChange must be a number', 400);
  const qtyChange = Number(change);
  if (expectedStoreId && storeId.toString() !== expectedStoreId.toString()) {
    throw new AppError('Item does not belong to the requested store', 400);
  }

  const filter = { storeId, itemId, variant: DEFAULT_VARIANT };
  const stock = await StoreItemStock.findOne(filter);

  if (stock) {
    const updated = await StoreItemStock.findOneAndUpdate(
      { _id: stock._id, ...(qtyChange < 0 ? { qty: { $gte: -qtyChange } } : {}) },
      { $inc: { qty: qtyChange } },
      { new: true, runValidators: true },
    );
    if (!updated) throw new AppError('Insufficient store stock', 400);
    return updated;
  }

  const initialQty = toStockValue(legacyQty);
  const nextQty = initialQty + qtyChange;
  if (nextQty < 0) throw new AppError('Insufficient store stock', 400);

  try {
    return await StoreItemStock.create({ ...filter, qty: nextQty });
  } catch (err) {
    if (err.code !== 11000) throw err;
    return changeExistingStoreItemStock(filter, qtyChange);
  }
};

const changeExistingStoreItemStock = async (filter, qtyChange) => {
  const updated = await StoreItemStock.findOneAndUpdate(
    { ...filter, ...(qtyChange < 0 ? { qty: { $gte: -qtyChange } } : {}) },
    { $inc: { qty: qtyChange } },
    { new: true, runValidators: true },
  );
  if (!updated) throw new AppError('Insufficient store stock', 400);
  return updated;
};

const deleteStoreItemStock = (itemId) => StoreItemStock.deleteMany({ itemId });

module.exports = {
  getStoreStocks,
  setStoreItemStock,
  changeStoreItemStock,
  deleteStoreItemStock,
  toStockValue,
};

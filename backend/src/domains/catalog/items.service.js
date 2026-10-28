const Item = require('../../models/catalog/Item');
const StoreItemStock = require('../inventory/store-item-stock.model');
const storeStockService = require('../inventory/store-stock.service');

exports.getAll = async ({ storeId, categoryId, status, search, page = 1, limit = 20 }) => {
  const filter = {};
  if (storeId) filter.storeId = storeId;
  if (categoryId) filter.categoryId = categoryId;
  if (status !== undefined) filter.status = status === 'true';
  if (search) filter.name = { $regex: search, $options: 'i' };

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Item.find(filter).populate('categoryId brandId unitId').skip(skip).limit(Number(limit)),
    Item.countDocuments(filter),
  ]);
  return {
    items: await storeStockService.getStoreStocks(items),
    total,
    page: Number(page),
    limit: Number(limit),
  };
};

exports.getOne = async (id) => {
  const item = await Item.findById(id).populate('categoryId brandId unitId');
  if (!item) return null;
  const [withStock] = await storeStockService.getStoreStocks([item]);
  return withStock;
};

exports.getStockContext = async (id) => {
  const item = await Item.findById(id).select('storeId stock');
  if (!item) return null;
  return {
    itemId: item._id,
    storeId: item.storeId,
    legacyQty: item.stock ?? 0,
  };
};

exports.create = async (body) => {
  const { stock = 0, ...itemData } = body;
  const qty = storeStockService.toStockValue(stock);
  const item = await Item.create({ ...itemData, stock: 0 });
  const stockRecord = await storeStockService.setStoreItemStock({
    itemId: item._id,
    storeId: item.storeId,
    qty,
  });
  return { ...item.toObject(), stock: stockRecord.qty };
};

exports.update = async (id, body) => {
  const { stock, ...itemData } = body;
  const previousItem = await Item.findById(id);
  if (!previousItem) return null;
  const item = await Item.findByIdAndUpdate(id, itemData, { new: true });
  const storeChanged = previousItem.storeId.toString() !== item.storeId.toString();
  if (stock === undefined && !storeChanged) {
    const [withStock] = await storeStockService.getStoreStocks([item]);
    return withStock;
  }
  let stockToSet = stock;
  if (stockToSet === undefined) {
    const [previousWithStock] = await storeStockService.getStoreStocks([previousItem]);
    stockToSet = previousWithStock.stock;
  }
  const stockRecord = await storeStockService.setStoreItemStock({
    itemId: item._id,
    storeId: item.storeId,
    qty: stockToSet,
  });
  return { ...item.toObject(), stock: stockRecord.qty };
};

exports.remove = async (id) => {
  const item = await Item.findByIdAndDelete(id);
  if (item) await storeStockService.deleteStoreItemStock(item._id);
  return item;
};

exports.updateStock = async (id, stock) => {
  const item = await Item.findById(id);
  if (!item) return null;
  const stockRecord = await storeStockService.setStoreItemStock({
    itemId: item._id,
    storeId: item.storeId,
    qty: stock,
  });
  return { ...item.toObject(), stock: stockRecord.qty };
};

exports.updateStatus = (id, status) => Item.findByIdAndUpdate(id, { status }, { new: true });

exports.getLowStock = async ({ storeId, threshold = 10 }) => {
  const lowStockThreshold = Number(threshold);
  const filter = { status: true };
  if (storeId) filter.storeId = storeId;
  const legacyFilter = { ...filter, stock: { $lte: lowStockThreshold } };
  const stockFilter = { variant: '', qty: { $lte: lowStockThreshold } };
  if (storeId) stockFilter.storeId = storeId;

  const [legacyItems, stockRecords] = await Promise.all([
    Item.find(legacyFilter).select('_id'),
    StoreItemStock.find(stockFilter).select('itemId'),
  ]);
  const itemIds = new Set([
    ...legacyItems.map((item) => item._id.toString()),
    ...stockRecords.map((record) => record.itemId.toString()),
  ]);
  if (!itemIds.size) return [];

  const items = await Item.find({ ...filter, _id: { $in: [...itemIds] } })
    .populate('categoryId brandId');
  const itemsWithStock = await storeStockService.getStoreStocks(items);
  return itemsWithStock.filter((item) => item.stock <= lowStockThreshold);
};

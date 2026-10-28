const mongoose = require('mongoose');
const ItemBatch = require('../../models/catalog/ItemBatch');
const Item = require('../../models/catalog/Item');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

const isValidId = (id) => mongoose.isValidObjectId(id);

const getAll = async ({ itemId, storeId, expiredOnly, page, limit: lim }) => {
  const filter = {};
  if (itemId) {
    if (!isValidId(itemId)) throw new AppError('Invalid itemId', 400);
    filter.itemId = itemId;
  }
  if (storeId) {
    if (!isValidId(storeId)) throw new AppError('Invalid storeId', 400);
    filter.storeId = storeId;
  }
  if (expiredOnly === 'true') filter.expiryDate = { $lt: new Date() };

  const { skip, page: currentPage, limit } = paginate({ page, limit: lim });
  const [batches, total] = await Promise.all([
    ItemBatch.find(filter)
      .populate('itemId', 'name sku')
      .populate('storeId', 'name')
      .sort({ expiryDate: 1 })
      .skip(skip)
      .limit(limit),
    ItemBatch.countDocuments(filter),
  ]);

  return {
    batches,
    pagination: {
      total,
      page: currentPage,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

const getById = async (id) => {
  if (!isValidId(id)) throw new AppError('Invalid batch ID', 400);

  const batch = await ItemBatch.findById(id)
    .populate('itemId', 'name sku')
    .populate('storeId', 'name');
  if (!batch) throw new AppError('Not found', 404);
  return batch;
};

const create = async ({ itemId, storeId, batchCode, qty, expiryDate }) => {
  if (!itemId || !isValidId(itemId)) throw new AppError('Valid itemId is required', 400);
  if (!storeId || !isValidId(storeId)) throw new AppError('Valid storeId is required', 400);
  if (qty === undefined || isNaN(qty) || Number(qty) < 0) {
    throw new AppError('qty must be a non-negative number', 400);
  }

  const itemExists = await Item.findById(itemId);
  if (!itemExists) throw new AppError('Item not found', 404);

  return ItemBatch.create({
    itemId,
    storeId,
    batchCode,
    qty: Number(qty),
    expiryDate,
  });
};

const update = async (id, body) => {
  if (!isValidId(id)) throw new AppError('Invalid batch ID', 400);

  const allowed = ['batchCode', 'qty', 'expiryDate'];
  const fields = Object.fromEntries(
    allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]),
  );
  if (!Object.keys(fields).length) throw new AppError('No valid fields to update', 400);
  if (fields.qty !== undefined && (isNaN(fields.qty) || Number(fields.qty) < 0)) {
    throw new AppError('qty must be a non-negative number', 400);
  }
  if (fields.qty !== undefined) fields.qty = Number(fields.qty);

  const batch = await ItemBatch.findByIdAndUpdate(id, fields, { new: true });
  if (!batch) throw new AppError('Not found', 404);
  return batch;
};

const remove = async (id) => {
  if (!isValidId(id)) throw new AppError('Invalid batch ID', 400);

  const batch = await ItemBatch.findByIdAndDelete(id);
  if (!batch) throw new AppError('Not found', 404);
};

const getExpiringSoon = async ({ days: rawDays, storeId }) => {
  const days = parseInt(rawDays) || 30;
  const filter = {
    expiryDate: { $gte: new Date(), $lte: new Date(Date.now() + days * 86400000) },
  };
  if (storeId) {
    if (!isValidId(storeId)) throw new AppError('Invalid storeId', 400);
    filter.storeId = storeId;
  }

  return ItemBatch.find(filter)
    .populate('itemId', 'name sku')
    .populate('storeId', 'name')
    .sort({ expiryDate: 1 });
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  getExpiringSoon,
};

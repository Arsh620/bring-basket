const mongoose = require('mongoose');
const StoreStockRequest = require('../../models/warehouse/StoreStockRequest');
const WarehouseItemStock = require('../../models/warehouse/WarehouseItemStock');
const WarehouseStockMovement = require('../../models/warehouse/WarehouseStockMovement');
const AppError = require('../../utils/AppError');
const storeStockService = require('./store-stock.service');
const catalogItemService = require('../catalog/items.service');
const { paginate } = require('../../utils/pagination');

const isValidId = (id) => mongoose.isValidObjectId(id);

const genPoNumber = () => `SSR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const getAll = async ({ storeId, motherWarehouseId, status, page, limit: lim }) => {
  const filter = {};
  if (storeId) filter.storeId = storeId;
  if (motherWarehouseId) filter.motherWarehouseId = motherWarehouseId;
  if (status) filter.status = status;

  const { skip, page: pg, limit } = paginate({ page, limit: lim });

  const [requests, total] = await Promise.all([
    StoreStockRequest.find(filter)
      .populate('storeId', 'name')
      .populate('motherWarehouseId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    StoreStockRequest.countDocuments(filter),
  ]);

  return {
    requests,
    total,
    page: pg,
    limit,
    pages: Math.ceil(total / limit),
  };
};

const getById = async (id) => {
  if (!isValidId(id)) throw new AppError('Invalid request ID', 400);

  const request = await StoreStockRequest.findById(id)
    .populate('storeId', 'name')
    .populate('motherWarehouseId', 'name code')
    .populate('items.itemId', 'name sku barcode');

  if (!request) throw new AppError('Not found', 404);
  return request;
};

const createRequest = async ({ storeId, motherWarehouseId, items, notes, source, billType }) => {
  if (!storeId || !isValidId(storeId)) throw new AppError('Valid storeId is required', 400);
  if (!motherWarehouseId || !isValidId(motherWarehouseId)) throw new AppError('Valid motherWarehouseId is required', 400);
  if (!Array.isArray(items) || items.length === 0) throw new AppError('items array is required', 400);

  const itemIds = items.map((item) => item.itemId?.toString());
  if (new Set(itemIds).size !== itemIds.length) throw new AppError('Duplicate items in request', 400);

  for (const item of items) {
    if (!isValidId(item.itemId)) throw new AppError(`Invalid itemId: ${item.itemId}`, 400);
    if (!item.qtyRequested || Number(item.qtyRequested) <= 0) {
      throw new AppError('qtyRequested must be > 0 for all items', 400);
    }
  }

  return StoreStockRequest.create({
    poNumber: genPoNumber(),
    storeId,
    motherWarehouseId,
    notes,
    source,
    billType,
    items: items.map((item) => ({
      itemId: item.itemId,
      qtyRequested: Number(item.qtyRequested),
    })),
  });
};

const approveRequest = async (id) => {
  if (!isValidId(id)) throw new AppError('Invalid request ID', 400);

  const request = await StoreStockRequest.findById(id);
  if (!request) throw new AppError('Not found', 404);
  if (request.status !== 'requested') {
    throw new AppError(`Cannot approve — status is ${request.status}`, 400);
  }

  request.status = 'approved';
  await request.save();
  return request;
};

const dispatchRequest = async (id, items, actor = {}) => {
  if (!isValidId(id)) throw new AppError('Invalid request ID', 400);

  const request = await StoreStockRequest.findById(id);
  if (!request) throw new AppError('Not found', 404);
  if (!['approved', 'requested'].includes(request.status)) {
    throw new AppError(`Cannot dispatch — status is ${request.status}`, 400);
  }

  if (!Array.isArray(items) || items.length === 0) throw new AppError('items with qtySent required', 400);

  for (const sentItem of items) {
    const reqItem = request.items.find((item) => item.itemId.toString() === sentItem.itemId?.toString());
    if (!reqItem) throw new AppError(`Item ${sentItem.itemId} not in request`, 400);
    if (Number(sentItem.qtySent) > reqItem.qtyRequested) {
      throw new AppError(`qtySent cannot exceed qtyRequested for item ${sentItem.itemId}`, 400);
    }

    const stock = await WarehouseItemStock.findOne({
      warehouseId: request.motherWarehouseId,
      itemId: sentItem.itemId,
      variant: '',
    });

    if (!stock || stock.qty < Number(sentItem.qtySent)) {
      throw new AppError(`Insufficient warehouse stock for item ${sentItem.itemId}`, 400);
    }

    stock.qty -= Number(sentItem.qtySent);
    await stock.save();

    await WarehouseStockMovement.create({
      warehouseId: request.motherWarehouseId,
      itemId: sentItem.itemId,
      qtyChange: -Number(sentItem.qtySent),
      balanceAfter: stock.qty,
      type: 'store_dispatch',
      referenceType: 'StoreStockRequest',
      referenceId: request._id,
      referenceNo: request.poNumber,
      storeId: request.storeId,
      actorType: actor?.role,
      actorId: actor?.id,
      movedAt: new Date(),
    });

    reqItem.qtySent = Number(sentItem.qtySent);
  }

  request.status = 'dispatched';
  request.dispatchedAt = new Date();
  await request.save();
  return request;
};

const receiveRequest = async (id, items, grnNumber, grnPath) => {
  if (!isValidId(id)) throw new AppError('Invalid request ID', 400);

  const request = await StoreStockRequest.findById(id);
  if (!request) throw new AppError('Not found', 404);
  if (request.status !== 'dispatched') throw new AppError(`Cannot receive — status is ${request.status}`, 400);

  if (!Array.isArray(items) || items.length === 0) throw new AppError('items with qtyReceived required', 400);

  for (const recItem of items) {
    const reqItem = request.items.find((item) => item.itemId.toString() === recItem.itemId?.toString());
    if (!reqItem) throw new AppError(`Item ${recItem.itemId} not in request`, 400);
    if (!Number.isFinite(Number(recItem.qtyReceived)) || Number(recItem.qtyReceived) < 0) {
      throw new AppError('qtyReceived must be a non-negative number', 400);
    }
    if (Number(recItem.qtyReceived) > reqItem.qtySent) {
      throw new AppError(`qtyReceived cannot exceed qtySent for item ${recItem.itemId}`, 400);
    }

    const stockContext = await catalogItemService.getStockContext(recItem.itemId);
    if (!stockContext) throw new AppError('Item not found', 404);
    await storeStockService.changeStoreItemStock(
      stockContext,
      Number(recItem.qtyReceived),
      request.storeId,
    );
    reqItem.qtyReceived = Number(recItem.qtyReceived);
  }

  request.status = 'received';
  request.receivedAt = new Date();
  if (grnNumber) request.grnNumber = grnNumber;
  if (grnPath) request.grnPath = grnPath;
  await request.save();
  return request;
};

const rejectRequest = async (id, rejectReason) => {
  if (!isValidId(id)) throw new AppError('Invalid request ID', 400);
  if (!rejectReason?.trim()) throw new AppError('rejectReason is required', 400);

  const request = await StoreStockRequest.findById(id);
  if (!request) throw new AppError('Not found', 404);
  if (!['requested', 'approved'].includes(request.status)) {
    throw new AppError(`Cannot reject — status is ${request.status}`, 400);
  }

  request.status = 'rejected';
  request.rejectReason = rejectReason.trim();
  await request.save();
  return request;
};

module.exports = {
  getAll,
  getById,
  createRequest,
  approveRequest,
  dispatchRequest,
  receiveRequest,
  rejectRequest,
};

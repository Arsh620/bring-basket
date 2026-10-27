const mongoose = require('mongoose');
const StoreStockRequest = require('../../../models/warehouse/StoreStockRequest');
const WarehouseItemStock = require('../../../models/warehouse/WarehouseItemStock');
const WarehouseStockMovement = require('../../../models/warehouse/WarehouseStockMovement');
const Item = require('../../../models/catalog/Item');
const { success, error } = require('../../../utils/response');
const { paginate } = require('../../../utils/pagination');

const isValidId = (id) => mongoose.isValidObjectId(id);

const genPoNumber = () => `SSR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

exports.getAll = async (req, res, next) => {
  try {
    const { storeId, motherWarehouseId, status, page, limit: lim } = req.query;
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
        .skip(skip).limit(limit),
      StoreStockRequest.countDocuments(filter),
    ]);
    return res.json({ success: true, data: requests, pagination: { total, page: pg, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid request ID', 400);
    const request = await StoreStockRequest.findById(req.params.id)
      .populate('storeId', 'name')
      .populate('motherWarehouseId', 'name code')
      .populate('items.itemId', 'name sku barcode');
    if (!request) return error(res, 'Not found', 404);
    return success(res, request);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { storeId, motherWarehouseId, items, notes, source, billType } = req.body;
    if (!storeId || !isValidId(storeId)) return error(res, 'Valid storeId is required', 400);
    if (!motherWarehouseId || !isValidId(motherWarehouseId)) return error(res, 'Valid motherWarehouseId is required', 400);
    if (!Array.isArray(items) || items.length === 0) return error(res, 'items array is required', 400);

    const itemIds = items.map(i => i.itemId?.toString());
    if (new Set(itemIds).size !== itemIds.length) return error(res, 'Duplicate items in request', 400);

    for (const item of items) {
      if (!isValidId(item.itemId)) return error(res, `Invalid itemId: ${item.itemId}`, 400);
      if (!item.qtyRequested || Number(item.qtyRequested) <= 0)
        return error(res, 'qtyRequested must be > 0 for all items', 400);
    }

    const request = await StoreStockRequest.create({
      poNumber: genPoNumber(),
      storeId, motherWarehouseId, notes, source, billType,
      items: items.map(i => ({ itemId: i.itemId, qtyRequested: Number(i.qtyRequested) })),
    });
    return success(res, request, 'Request created', 201);
  } catch (err) { next(err); }
};

exports.approve = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid request ID', 400);
    const request = await StoreStockRequest.findById(req.params.id);
    if (!request) return error(res, 'Not found', 404);
    if (request.status !== 'requested') return error(res, `Cannot approve — status is ${request.status}`, 400);

    request.status = 'approved';
    await request.save();
    return success(res, request, 'Approved');
  } catch (err) { next(err); }
};

exports.dispatch = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid request ID', 400);
    const request = await StoreStockRequest.findById(req.params.id);
    if (!request) return error(res, 'Not found', 404);
    if (!['approved', 'requested'].includes(request.status))
      return error(res, `Cannot dispatch — status is ${request.status}`, 400);

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return error(res, 'items with qtySent required', 400);

    for (const sentItem of items) {
      const reqItem = request.items.find(i => i.itemId.toString() === sentItem.itemId?.toString());
      if (!reqItem) return error(res, `Item ${sentItem.itemId} not in request`, 400);
      if (Number(sentItem.qtySent) > reqItem.qtyRequested)
        return error(res, `qtySent cannot exceed qtyRequested for item ${sentItem.itemId}`, 400);

      // Deduct from warehouse
      const stock = await WarehouseItemStock.findOne({
        warehouseId: request.motherWarehouseId,
        itemId: sentItem.itemId,
        variant: '',
      });
      if (!stock || stock.qty < Number(sentItem.qtySent))
        return error(res, `Insufficient warehouse stock for item ${sentItem.itemId}`, 400);

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
        actorType: req.user?.role,
        actorId: req.user?.id,
        movedAt: new Date(),
      });

      reqItem.qtySent = Number(sentItem.qtySent);
    }

    request.status = 'dispatched';
    request.dispatchedAt = new Date();
    await request.save();
    return success(res, request, 'Dispatched');
  } catch (err) { next(err); }
};

exports.receive = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid request ID', 400);
    const request = await StoreStockRequest.findById(req.params.id);
    if (!request) return error(res, 'Not found', 404);
    if (request.status !== 'dispatched') return error(res, `Cannot receive — status is ${request.status}`, 400);

    const { items, grnNumber, grnPath } = req.body;
    if (!Array.isArray(items) || items.length === 0) return error(res, 'items with qtyReceived required', 400);

    for (const recItem of items) {
      const reqItem = request.items.find(i => i.itemId.toString() === recItem.itemId?.toString());
      if (!reqItem) return error(res, `Item ${recItem.itemId} not in request`, 400);
      if (Number(recItem.qtyReceived) > reqItem.qtySent)
        return error(res, `qtyReceived cannot exceed qtySent for item ${recItem.itemId}`, 400);

      // Update store item stock
      await Item.findByIdAndUpdate(recItem.itemId, { $inc: { stock: Number(recItem.qtyReceived) } });

      reqItem.qtyReceived = Number(recItem.qtyReceived);
    }

    request.status = 'received';
    request.receivedAt = new Date();
    if (grnNumber) request.grnNumber = grnNumber;
    if (grnPath) request.grnPath = grnPath;
    await request.save();
    return success(res, request, 'Received');
  } catch (err) { next(err); }
};

exports.reject = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid request ID', 400);
    const { rejectReason } = req.body;
    if (!rejectReason?.trim()) return error(res, 'rejectReason is required', 400);

    const request = await StoreStockRequest.findById(req.params.id);
    if (!request) return error(res, 'Not found', 404);
    if (!['requested', 'approved'].includes(request.status))
      return error(res, `Cannot reject — status is ${request.status}`, 400);

    request.status = 'rejected';
    request.rejectReason = rejectReason.trim();
    await request.save();
    return success(res, request, 'Rejected');
  } catch (err) { next(err); }
};

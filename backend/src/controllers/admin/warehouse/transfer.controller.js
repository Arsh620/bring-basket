const mongoose = require('mongoose');
const WarehouseStockTransfer = require('../../../models/warehouse/WarehouseStockTransfer');
const WarehouseItemStock = require('../../../models/warehouse/WarehouseItemStock');
const WarehouseStockMovement = require('../../../models/warehouse/WarehouseStockMovement');
const { success, error } = require('../../../utils/response');
const { paginate } = require('../../../utils/pagination');

const isValidId = (id) => mongoose.isValidObjectId(id);

const VALID_STATUSES = ['requested', 'dispatched', 'received', 'rejected'];

exports.getAll = async (req, res, next) => {
  try {
    const { status, motherWarehouseId, subWarehouseId, page, limit: lim } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (motherWarehouseId) filter.motherWarehouseId = motherWarehouseId;
    if (subWarehouseId) filter.subWarehouseId = subWarehouseId;

    const { skip, page: pg, limit } = paginate({ page, limit: lim });
    const [transfers, total] = await Promise.all([
      WarehouseStockTransfer.find(filter)
        .populate('motherWarehouseId', 'name code')
        .populate('subWarehouseId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit),
      WarehouseStockTransfer.countDocuments(filter),
    ]);
    return res.json({ success: true, data: transfers, pagination: { total, page: pg, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid transfer ID', 400);
    const transfer = await WarehouseStockTransfer.findById(req.params.id)
      .populate('motherWarehouseId', 'name code')
      .populate('subWarehouseId', 'name code')
      .populate('items.itemId', 'name sku barcode');
    if (!transfer) return error(res, 'Not found', 404);
    return success(res, transfer);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { motherWarehouseId, subWarehouseId, items, notes, type } = req.body;
    if (!motherWarehouseId || !isValidId(motherWarehouseId))
      return error(res, 'Valid motherWarehouseId is required', 400);
    if (!Array.isArray(items) || items.length === 0)
      return error(res, 'items array is required', 400);

    // Validate items — no duplicates
    const itemIds = items.map(i => i.itemId?.toString());
    if (new Set(itemIds).size !== itemIds.length)
      return error(res, 'Duplicate items in transfer', 400);

    for (const item of items) {
      if (!isValidId(item.itemId)) return error(res, `Invalid itemId: ${item.itemId}`, 400);
      if (!item.qtyRequested || Number(item.qtyRequested) <= 0)
        return error(res, 'qtyRequested must be > 0 for all items', 400);
    }

    const transfer = await WarehouseStockTransfer.create({
      motherWarehouseId, subWarehouseId, notes, type,
      items: items.map(i => ({ itemId: i.itemId, qtyRequested: Number(i.qtyRequested), qtySent: 0 })),
    });
    return success(res, transfer, 'Transfer created', 201);
  } catch (err) { next(err); }
};

exports.dispatch = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid transfer ID', 400);
    const transfer = await WarehouseStockTransfer.findById(req.params.id);
    if (!transfer) return error(res, 'Not found', 404);
    if (transfer.status !== 'requested') return error(res, `Cannot dispatch — status is ${transfer.status}`, 400);

    const { items, challanNumber, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0)
      return error(res, 'items with qtySent required', 400);

    // Validate qtySent <= qtyRequested and deduct from mother warehouse
    for (const sentItem of items) {
      const transferItem = transfer.items.find(i => i.itemId.toString() === sentItem.itemId?.toString());
      if (!transferItem) return error(res, `Item ${sentItem.itemId} not in transfer`, 400);
      if (Number(sentItem.qtySent) > transferItem.qtyRequested)
        return error(res, `qtySent cannot exceed qtyRequested for item ${sentItem.itemId}`, 400);

      // Deduct from mother warehouse
      const stock = await WarehouseItemStock.findOne({
        warehouseId: transfer.motherWarehouseId,
        itemId: sentItem.itemId,
        variant: sentItem.variant || '',
      });
      if (!stock || stock.qty < Number(sentItem.qtySent))
        return error(res, `Insufficient stock in mother warehouse for item ${sentItem.itemId}`, 400);

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
        actorType: req.user?.role,
        actorId: req.user?.id,
        movedAt: new Date(),
      });

      transferItem.qtySent = Number(sentItem.qtySent);
    }

    transfer.status = 'dispatched';
    transfer.challanNumber = challanNumber;
    if (notes) transfer.notes = notes;
    transfer.dispatchedAt = new Date();
    await transfer.save();

    return success(res, transfer, 'Dispatched');
  } catch (err) { next(err); }
};

exports.receive = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid transfer ID', 400);
    const transfer = await WarehouseStockTransfer.findById(req.params.id);
    if (!transfer) return error(res, 'Not found', 404);
    if (transfer.status !== 'dispatched') return error(res, `Cannot receive — status is ${transfer.status}`, 400);

    // Add received qty to sub warehouse
    for (const transferItem of transfer.items) {
      if (!transferItem.qtySent) continue;

      await WarehouseItemStock.findOneAndUpdate(
        { warehouseId: transfer.subWarehouseId, itemId: transferItem.itemId, variant: '' },
        { $inc: { qty: transferItem.qtySent } },
        { upsert: true, new: true }
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
        actorType: req.user?.role,
        actorId: req.user?.id,
        movedAt: new Date(),
      });
    }

    transfer.status = 'received';
    transfer.receivedAt = new Date();
    await transfer.save();

    return success(res, transfer, 'Received');
  } catch (err) { next(err); }
};

exports.reject = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid transfer ID', 400);
    const { rejectReason } = req.body;
    if (!rejectReason?.trim()) return error(res, 'rejectReason is required', 400);

    const transfer = await WarehouseStockTransfer.findById(req.params.id);
    if (!transfer) return error(res, 'Not found', 404);
    if (!['requested', 'dispatched'].includes(transfer.status))
      return error(res, `Cannot reject — status is ${transfer.status}`, 400);

    transfer.status = 'rejected';
    transfer.rejectReason = rejectReason.trim();
    await transfer.save();

    return success(res, transfer, 'Rejected');
  } catch (err) { next(err); }
};

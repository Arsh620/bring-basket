const crypto = require('node:crypto');
const mongoose = require('mongoose');
const PurchaseOrder = require('../../models/purchase/PurchaseOrder');
const PurchaseVendor = require('../../models/purchase/PurchaseVendor');
const Warehouse = require('../../models/warehouse/Warehouse');
const Store = require('../../models/store/Store');
const Zone = require('../../models/store/Zone');
const Item = require('../../models/catalog/Item');
const UnitGroup = require('../../models/catalog/UnitGroup');
const Sequence = require('../../models/purchase/Sequence');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

const WRITABLE_FIELDS = [
  'reference', 'poDate', 'expectedDeliveryDate', 'terms', 'taxType', 'notes',
  'items',
];
const LINE_FIELDS = [
  'itemId', 'itemName', 'description', 'hsnSac', 'qty', 'schemeBuyQty',
  'schemeGetQty', 'unit', 'baseUnit', 'conversionFactor', 'unitGroupId',
  'rate', 'mrp', 'sellingPrice', 'taxPercent',
];
const STATUSES = ['draft', 'open', 'partially_billed', 'billed', 'cancelled'];

const validateId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${label} ID`, 400);
};

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one purchase order item is required', 400);
  }

  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AppError(`items[${index}] must be an object`, 400);
    }
    const fields = Object.fromEntries(
      LINE_FIELDS.filter((field) => item[field] !== undefined)
        .map((field) => [field, item[field]]),
    );
    if (typeof fields.itemName !== 'string' || !fields.itemName.trim()) {
      throw new AppError(`items[${index}].itemName is required`, 400);
    }
    fields.itemName = fields.itemName.trim();
    for (const field of ['qty', 'rate']) {
      if (fields[field] === undefined || !Number.isFinite(Number(fields[field]))
        || Number(fields[field]) < 0 || (field === 'qty' && Number(fields[field]) === 0)) {
        throw new AppError(`items[${index}].${field} must be a positive number`, 400);
      }
      fields[field] = Number(fields[field]);
    }
    for (const field of ['taxPercent', 'conversionFactor', 'schemeBuyQty', 'schemeGetQty', 'mrp', 'sellingPrice']) {
      if (fields[field] !== undefined
        && (!Number.isFinite(Number(fields[field])) || Number(fields[field]) < 0)) {
        throw new AppError(`items[${index}].${field} must be a non-negative number`, 400);
      }
      if (fields[field] !== undefined) fields[field] = Number(fields[field]);
    }
    if (fields.taxPercent !== undefined && fields.taxPercent > 100) {
      throw new AppError(`items[${index}].taxPercent cannot exceed 100`, 400);
    }
    if (fields.conversionFactor !== undefined && fields.conversionFactor <= 0) {
      throw new AppError(`items[${index}].conversionFactor must be greater than 0`, 400);
    }
    if (fields.itemId) validateId(fields.itemId, `items[${index}].item`);
    if (fields.unitGroupId) validateId(fields.unitGroupId, `items[${index}].unit group`);
    if (fields.mrp && fields.sellingPrice && fields.sellingPrice > fields.mrp) {
      throw new AppError(`items[${index}].sellingPrice cannot exceed mrp`, 400);
    }

    const qty = fields.qty;
    const rate = fields.rate;
    const taxPercent = fields.taxPercent || 0;
    const freeQty = fields.schemeBuyQty > 0 && fields.schemeGetQty > 0
      ? Math.floor(qty / fields.schemeBuyQty) * fields.schemeGetQty
      : 0;
    const baseQty = Number(((qty + freeQty) * (fields.conversionFactor || 1)).toFixed(4));
    const subtotal = Number((qty * rate).toFixed(2));
    const taxAmount = Number((subtotal * taxPercent / 100).toFixed(2));

    return {
      ...fields,
      sortOrder: index,
      qtyBilled: 0,
      freeQty,
      unit: fields.unit || 'pcs',
      conversionFactor: fields.conversionFactor || 1,
      baseQty,
      unitCost: baseQty > 0 ? Number((subtotal / baseQty).toFixed(6)) : 0,
      taxPercent,
      taxAmount,
      amount: Number((subtotal + taxAmount).toFixed(2)),
    };
  });
};

const calculateTotals = (items) => {
  const subTotal = Number(items.reduce((sum, item) => sum + item.qty * item.rate, 0).toFixed(2));
  const taxTotal = Number(items.reduce((sum, item) => sum + item.taxAmount, 0).toFixed(2));
  return { subTotal, taxTotal, total: Number((subTotal + taxTotal).toFixed(2)) };
};

const getNextPoNumber = async () => {
  const sequenceId = 'purchaseOrder';
  const sequenceExists = await Sequence.exists({ _id: sequenceId });
  if (!sequenceExists) {
    const [existing] = await PurchaseOrder.aggregate([
      {
        $project: {
          suffix: {
            $regexFind: { input: { $ifNull: ['$poNumber', ''] }, regex: /(\d+)\s*$/ },
          },
        },
      },
      {
        $project: {
          value: {
            $convert: {
              input: { $arrayElemAt: [{ $ifNull: ['$suffix.captures', []] }, 0] },
              to: 'int',
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      { $group: { _id: null, value: { $max: '$value' } } },
    ]);
    try {
      await Sequence.updateOne(
        { _id: sequenceId },
        { $setOnInsert: { value: existing?.value || 0 } },
        { upsert: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  try {
    const counter = await Sequence.findOneAndUpdate(
      { _id: sequenceId },
      { $inc: { value: 1 } },
      { new: true },
    );
    return `PO-${String(counter.value).padStart(5, '0')}`;
  } catch (error) {
    if (error.code !== 11000) throw error;
    const counter = await Sequence.findOneAndUpdate(
      { _id: sequenceId },
      { $inc: { value: 1 } },
      { new: true },
    );
    return `PO-${String(counter.value).padStart(5, '0')}`;
  }
};

const getAll = async (query) => {
  const { page, limit, skip } = paginate(query);
  const filter = {};
  if (query.status) {
    if (!STATUSES.includes(query.status)) throw new AppError('Invalid purchase order status', 400);
    filter.status = query.status;
  }
  for (const field of ['purchaseVendorId', 'warehouseId', 'storeId']) {
    if (query[field]) {
      validateId(query[field], field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`));
      filter[field] = query[field];
    }
  }
  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.poNumber = new RegExp(escaped, 'i');
  }
  const [orders, total] = await Promise.all([
    PurchaseOrder.find(filter)
      .populate('purchaseVendorId', 'displayName legalName')
      .populate('warehouseId', 'name code')
      .populate('storeId', 'name')
      .sort({ poDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    PurchaseOrder.countDocuments(filter),
  ]);
  return { orders, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
};

const getOne = async (id) => {
  validateId(id, 'purchase order');
  const order = await PurchaseOrder.findById(id)
    .populate('purchaseVendorId', 'displayName legalName email mobile addresses')
    .populate('warehouseId', 'name code state')
    .populate('storeId', 'name');
  if (!order) throw new AppError('Purchase order not found', 404);
  return order;
};

const validateRelations = async ({ purchaseVendorId, warehouseId, storeId, items }) => {
  validateId(purchaseVendorId, 'purchase vendor');
  validateId(warehouseId, 'warehouse');
  if (storeId) validateId(storeId, 'store');

  const [vendor, warehouse, store] = await Promise.all([
    PurchaseVendor.findById(purchaseVendorId),
    Warehouse.findOne({ _id: warehouseId, type: 'mother', status: 'active' }),
    storeId ? Store.findOne({ _id: storeId, status: true }).populate('zoneId', 'state') : null,
  ]);
  if (!vendor || vendor.approvalStatus !== 'approved' || !vendor.status) {
    throw new AppError('Purchase vendor must be approved and active', 400);
  }
  if (!warehouse) throw new AppError('An active mother warehouse is required', 400);
  if (storeId && !store) throw new AppError('Store must be active', 400);
  if (storeId) {
    const zone = store.zoneId && typeof store.zoneId === 'object'
      ? store.zoneId
      : await Zone.findById(store.zoneId).select('state');
    const storeState = zone?.state?.trim().toLowerCase();
    const warehouseState = warehouse.state?.trim().toLowerCase();
    if (storeState && warehouseState && storeState !== warehouseState) {
      throw new AppError('Store and warehouse must be in the same state', 400);
    }
  }

  for (const item of items) {
    if (item.itemId) {
      const catalogItem = await Item.findById(item.itemId);
      if (!catalogItem) throw new AppError(`Item not found: ${item.itemId}`, 404);
      if (storeId && String(catalogItem.storeId) !== String(storeId)) {
        throw new AppError(`Item ${item.itemName} does not belong to the selected store`, 400);
      }
    }
    if (item.unitGroupId && !await UnitGroup.exists({ _id: item.unitGroupId })) {
      throw new AppError(`Unit group not found: ${item.unitGroupId}`, 404);
    }
  }
};

const getEditableOrder = async (id) => {
  validateId(id, 'purchase order');
  const order = await PurchaseOrder.findById(id);
  if (!order) throw new AppError('Purchase order not found', 404);
  if (['partially_billed', 'billed', 'cancelled'].includes(order.status)) {
    throw new AppError('This purchase order can no longer be edited', 409);
  }
  if (order.items.some((item) => item.qtyBilled > 0)) {
    throw new AppError('Purchase order items cannot be edited after billing starts', 409);
  }
  return order;
};

const create = async (body) => {
  const items = normalizeItems(body.items);
  const warehouseId = body.warehouseId;
  const purchaseVendorId = body.purchaseVendorId;
  const storeId = body.storeId || undefined;
  const poDate = body.poDate ? new Date(body.poDate) : new Date();
  const expectedDeliveryDate = body.expectedDeliveryDate
    ? new Date(body.expectedDeliveryDate)
    : undefined;
  if (!isValidDate(poDate)) throw new AppError('poDate must be a valid date', 400);
  if (body.expectedDeliveryDate && !isValidDate(expectedDeliveryDate)) {
    throw new AppError('expectedDeliveryDate must be a valid date', 400);
  }
  const taxType = body.taxType || 'igst';
  if (!['igst', 'cgst_sgst'].includes(taxType)) throw new AppError('taxType is invalid', 400);

  await validateRelations({ purchaseVendorId, warehouseId, storeId, items });
  const totals = calculateTotals(items);
  const poNumber = await getNextPoNumber();
  const order = await PurchaseOrder.create({
    purchaseVendorId,
    warehouseId,
    storeId,
    poNumber,
    reference: body.reference,
    poDate,
    expectedDeliveryDate,
    terms: body.terms,
    notes: body.notes,
    status: 'draft',
    approvalToken: crypto.randomBytes(24).toString('hex'),
    approvalRequestedAt: new Date(),
    approvedBy: undefined,
    taxType,
    ...totals,
    items,
  });
  order.approvalToken = undefined;
  return order;
};

const update = async (id, body) => {
  const order = await getEditableOrder(id);
  const fields = Object.fromEntries(
    WRITABLE_FIELDS.filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );
  if (!Object.keys(fields).length) throw new AppError('No valid fields to update', 400);

  if (fields.items !== undefined) {
    fields.items = normalizeItems(fields.items);
  }
  const items = fields.items || order.items;
  const purchaseVendorId = body.purchaseVendorId || order.purchaseVendorId;
  const warehouseId = body.warehouseId || order.warehouseId;
  const storeId = body.storeId === null ? undefined : (body.storeId || order.storeId);
  await validateRelations({ purchaseVendorId, warehouseId, storeId, items });

  if (body.poDate !== undefined) {
    fields.poDate = new Date(body.poDate);
    if (!isValidDate(fields.poDate)) throw new AppError('poDate must be a valid date', 400);
  }
  if (body.expectedDeliveryDate !== undefined) {
    fields.expectedDeliveryDate = body.expectedDeliveryDate
      ? new Date(body.expectedDeliveryDate)
      : undefined;
    if (fields.expectedDeliveryDate && !isValidDate(fields.expectedDeliveryDate)) {
      throw new AppError('expectedDeliveryDate must be a valid date', 400);
    }
  }
  if (body.taxType !== undefined) {
    if (!['igst', 'cgst_sgst'].includes(body.taxType)) throw new AppError('taxType is invalid', 400);
    fields.taxType = body.taxType;
  }
  for (const field of ['purchaseVendorId', 'warehouseId']) {
    if (body[field] !== undefined) fields[field] = body[field];
  }
  if (body.storeId !== undefined) fields.storeId = body.storeId || undefined;
  if (fields.items) Object.assign(fields, calculateTotals(fields.items));

  Object.assign(order, fields);
  await order.save();
  return order;
};

const issue = async (id, actorId) => {
  validateId(id, 'purchase order');
  const order = await PurchaseOrder.findById(id);
  if (!order) throw new AppError('Purchase order not found', 404);
  if (order.status === 'open') return order;
  if (order.status !== 'draft') throw new AppError('Only draft purchase orders can be issued', 409);

  order.status = 'open';
  order.approvedAt = new Date();
  order.approvedBy = String(actorId || 'admin');
  await order.save();
  return order;
};

const cancel = async (id) => {
  validateId(id, 'purchase order');
  const order = await PurchaseOrder.findById(id);
  if (!order) throw new AppError('Purchase order not found', 404);
  if (['billed', 'cancelled'].includes(order.status)) {
    throw new AppError('This purchase order cannot be cancelled', 409);
  }
  if (order.items.some((item) => item.qtyBilled > 0)) {
    throw new AppError('Purchase orders with bills cannot be cancelled', 409);
  }
  order.status = 'cancelled';
  await order.save();
  return order;
};

module.exports = { getAll, getOne, create, update, issue, cancel };

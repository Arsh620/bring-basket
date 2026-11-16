const mongoose = require('mongoose');
const PurchaseReturn = require('../../models/purchase/PurchaseReturn');
const Sequence = require('../../models/purchase/Sequence');
const WarehouseStockMovement = require('../../models/warehouse/WarehouseStockMovement');
const StoreStockMovement = require('../../models/store/StoreStockMovement');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

const REASONS = ['damaged', 'expired', 'wrong_item', 'excess', 'defective', 'overstock', 'other'];
const STATUSES = ['draft', 'completed', 'void', 'cancelled'];
const asNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const truthy = (value) => value === true || value === 1 || value === '1' || value === 'true';
const rounded = (value, places = 2) => Number(Number(value).toFixed(places));
const text = (value) => (value === undefined || value === null ? '' : String(value));
const plainObjectId = (value) => value?._id?.toString?.() || text(value);

const getCollection = (name) => {
  if (!mongoose.connection.db) throw new AppError('Database is not connected', 503);
  return mongoose.connection.db.collection(name);
};

const requireObjectId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${label} ID`, 400);
};

const resolveDocument = async (collectionName, id, session) => {
  if (id === undefined || id === null || id === '') return null;
  const collection = getCollection(collectionName);
  const queryOptions = session ? { session } : {};
  if (mongoose.isValidObjectId(id)) {
    const found = await collection.findOne(
      { _id: new mongoose.Types.ObjectId(String(id)) },
      queryOptions,
    );
    if (found) return found;
  }
  const numericId = Number(id);
  if (Number.isSafeInteger(numericId) && numericId > 0) {
    return collection.findOne({ legacyId: numericId }, queryOptions);
  }
  return null;
};

const referenceValues = (document) => {
  if (!document) return [];
  return [document._id, document.legacyId].filter((value) => value !== undefined && value !== null);
};

const referenceMatches = (left, right) => (
  left !== undefined && left !== null
  && right !== undefined && right !== null
  && String(left) === String(right)
);

const findDocumentsForReference = async (collectionName, field, document, session) => {
  const candidates = referenceValues(document);
  if (!candidates.length) return [];
  const options = session ? { session } : {};
  return getCollection(collectionName).find({ [field]: { $in: candidates } }, options).toArray();
};

const getReturnItems = async (record, session) => {
  if (Array.isArray(record.items)) return record.items;
  const candidates = [record.legacyId, record._id].filter((value) => value !== undefined && value !== null);
  if (!candidates.length) return [];
  const options = session ? { session } : {};
  return getCollection('purchasereturnitems')
    .find({ purchaseReturnId: { $in: candidates } }, options)
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
};

const getBillItems = async (bill, session) => {
  if (Array.isArray(bill.items)) return bill.items;
  const candidates = [bill.legacyId, bill._id].filter((value) => value !== undefined && value !== null);
  if (!candidates.length) return [];
  const options = session ? { session } : {};
  return getCollection('purchasebillitems')
    .find({ purchaseBillId: { $in: candidates } }, options)
    .sort({ sortOrder: 1, _id: 1 })
    .toArray();
};

const resolveReferenceDocument = async (collectionName, value, session) => {
  if (value === undefined || value === null || value === '') return null;
  return resolveDocument(collectionName, value, session);
};

const returnQuantityIndex = async (bill, session) => {
  const index = new Map();
  const returns = await findDocumentsForReference('purchasereturns', 'purchaseBillId', bill, session);
  for (const record of returns) {
    if (record.status === 'void') continue;
    for (const line of await getReturnItems(record, session)) {
      const billLineId = line.purchaseBillItemId ?? line.purchase_bill_item_id;
      if (billLineId === undefined || billLineId === null || billLineId === '') continue;
      const key = String(billLineId);
      index.set(key, rounded((index.get(key) || 0) + asNumber(line.returnedQty ?? line.returned_qty), 4));
    }
  }
  return index;
};

const formatBillLine = async (line, returnedByLine, session) => {
  const id = line._id;
  const legacyId = line.legacyId;
  const billedQty = asNumber(line.qty) + asNumber(line.freeQty ?? line.free_qty);
  const returnedQty = (returnedByLine.get(String(id)) || 0)
    + (legacyId === undefined ? 0 : returnedByLine.get(String(legacyId)) || 0);
  const remainingQty = Math.max(0, rounded(billedQty - returnedQty, 3));
  const item = await resolveReferenceDocument('items', line.itemId ?? line.item_id, session);
  return {
    _id: plainObjectId(id),
    legacyId,
    purchaseBillItemId: plainObjectId(id),
    itemId: item?._id?.toString() || null,
    itemName: line.itemName ?? line.item_name ?? item?.name ?? 'Item',
    unitName: line.unit ?? line.unitName ?? line.unit_name ?? 'pcs',
    qty: remainingQty,
    maxQty: remainingQty,
    billedQty,
    returnedQty,
    rate: asNumber(line.rate),
    taxPercent: asNumber(line.taxPercent ?? line.tax_percent),
    conversionFactor: Math.max(0.0001, asNumber(line.conversionFactor ?? line.conversion_factor, 1)),
  };
};

const getBillReturnableItems = async (bill, session) => {
  const returnedByLine = await returnQuantityIndex(bill, session);
  const rows = [];
  for (const line of await getBillItems(bill, session)) {
    const formatted = await formatBillLine(line, returnedByLine, session);
    if (formatted.maxQty > 0) rows.push(formatted);
  }
  return rows;
};

const formatReturnItem = async (line, bill, session) => {
  const item = await resolveReferenceDocument('items', line.itemId ?? line.item_id, session);
  const billLines = bill ? await getBillItems(bill, session) : [];
  const billLine = billLines.find((candidate) => (
    referenceMatches(candidate._id, line.purchaseBillItemId ?? line.purchase_bill_item_id)
    || referenceMatches(candidate.legacyId, line.purchaseBillItemId ?? line.purchase_bill_item_id)
  ));
  const returnedQty = asNumber(line.returnedQty ?? line.returned_qty);
  const rate = asNumber(line.rate);
  const taxRate = asNumber(line.taxRate ?? line.tax_rate);
  const subTotal = asNumber(line.subTotal ?? line.sub_total, rounded(returnedQty * rate));
  const taxAmount = asNumber(line.taxAmount ?? line.tax_amount, rounded(subTotal * taxRate / 100));
  return {
    _id: plainObjectId(line._id),
    purchaseBillItemId: line.purchaseBillItemId ?? line.purchase_bill_item_id ?? null,
    itemId: item?._id?.toString() || null,
    itemName: line.itemName ?? line.item_name ?? item?.name ?? 'Item',
    unitName: line.unitName ?? line.unit_name ?? 'pcs',
    returnedQty,
    billedQty: billLine ? asNumber(billLine.qty) + asNumber(billLine.freeQty ?? billLine.free_qty) : null,
    rate,
    taxRate,
    taxAmount,
    subTotal,
    totalAmount: asNumber(line.totalAmount ?? line.total_amount, rounded(subTotal + taxAmount)),
    reason: line.reason || null,
  };
};

const formatReturn = async (record, includeItems, session) => {
  const [vendor, bill, store, warehouse] = await Promise.all([
    resolveReferenceDocument('purchasevendors', record.purchaseVendorId, session),
    resolveReferenceDocument('purchasebills', record.purchaseBillId, session),
    resolveReferenceDocument('stores', record.storeId, session),
    resolveReferenceDocument('warehouses', record.warehouseId, session),
  ]);
  const result = {
    _id: record._id.toString(),
    legacyId: record.legacyId,
    returnNumber: record.returnNumber,
    purchaseVendorId: vendor ? {
      _id: vendor._id.toString(),
      displayName: vendor.displayName ?? vendor.display_name ?? vendor.name ?? '—',
      legalName: vendor.legalName ?? vendor.legal_name,
    } : null,
    purchaseBillId: bill ? {
      _id: bill._id.toString(),
      billNumber: bill.billNumber ?? bill.bill_number ?? null,
      billDate: bill.billDate ?? bill.bill_date ?? null,
      total: asNumber(bill.total),
      status: bill.status,
    } : null,
    storeId: store ? { _id: store._id.toString(), name: store.name } : null,
    warehouseId: warehouse ? { _id: warehouse._id.toString(), name: warehouse.name } : null,
    returnDate: record.returnDate ?? record.return_date,
    reason: record.reason || 'damaged',
    status: record.status || 'draft',
    subTotal: asNumber(record.subTotal ?? record.sub_total),
    taxTotal: asNumber(record.taxTotal ?? record.tax_total),
    totalAmount: asNumber(record.totalAmount ?? record.total_amount),
    notes: record.notes || '',
    stockDeducted: truthy(record.stockDeducted ?? record.stock_deducted),
    stockDeductedAt: record.stockDeductedAt ?? record.stock_deducted_at ?? null,
    stockDeductedFrom: record.stockDeductedFrom ?? record.stock_deducted_from ?? null,
    createdAt: record.createdAt ?? record.created_at,
  };
  if (includeItems) {
    result.items = [];
    for (const line of await getReturnItems(record, session)) {
      result.items.push(await formatReturnItem(line, bill, session));
    }
  }
  return result;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getAll = async (query = {}) => {
  const { page, limit, skip } = paginate(query);
  if (query.status && !STATUSES.includes(query.status)) {
    throw new AppError(`status must be one of: ${STATUSES.join(', ')}`, 400);
  }
  const filter = {};
  if (query.status) filter.status = query.status;
  for (const [field, collectionName, input] of [
    ['purchaseVendorId', 'purchasevendors', query.purchaseVendorId],
    ['storeId', 'stores', query.storeId],
  ]) {
    if (input) {
      const entity = await resolveDocument(collectionName, input);
      if (!entity) throw new AppError(`${field === 'storeId' ? 'Store' : 'Purchase vendor'} not found`, 404);
      filter[field] = { $in: referenceValues(entity) };
    }
  }
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const [vendors, bills] = await Promise.all([
      getCollection('purchasevendors').find({
        $or: [{ displayName: pattern }, { display_name: pattern }, { legalName: pattern }],
      }).project({ _id: 1, legacyId: 1 }).toArray(),
      getCollection('purchasebills').find({
        $or: [{ billNumber: pattern }, { bill_number: pattern }],
      }).project({ _id: 1, legacyId: 1 }).toArray(),
    ]);
    filter.$or = [
      { returnNumber: pattern },
      ...(vendors.length ? [{ purchaseVendorId: { $in: vendors.flatMap(referenceValues) } }] : []),
      ...(bills.length ? [{ purchaseBillId: { $in: bills.flatMap(referenceValues) } }] : []),
    ];
  }
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    throw new AppError('from and to must be valid dates', 400);
  }
  if (from && to && from > to) throw new AppError('from must be on or before to', 400);
  const dateFilter = {};
  if (from) dateFilter.$gte = from;
  if (to) dateFilter.$lte = new Date(to.getTime() + 86399999);
  const recordsResult = await getCollection('purchasereturns').aggregate([
    { $match: filter },
    {
      $addFields: {
        returnDateSort: {
          $convert: {
            input: { $ifNull: ['$returnDate', { $ifNull: ['$return_date', '$createdAt'] }] },
            to: 'date',
            onError: null,
            onNull: null,
          },
        },
      },
    },
    ...(Object.keys(dateFilter).length ? [{ $match: { returnDateSort: dateFilter } }] : []),
    { $sort: { returnDateSort: -1, createdAt: -1, _id: -1 } },
    {
      $facet: {
        records: [{ $skip: skip }, { $limit: limit }, { $project: { returnDateSort: 0 } }],
        count: [{ $count: 'total' }],
      },
    },
  ]).toArray();
  const records = recordsResult[0]?.records || [];
  const total = recordsResult[0]?.count?.[0]?.total || 0;
  const data = [];
  for (const record of records) {
    data.push(await formatReturn(record, false));
  }
  return {
    returns: data,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

const getOne = async (id) => {
  requireObjectId(id, 'purchase return');
  const record = await resolveDocument('purchasereturns', id);
  if (!record) throw new AppError('Purchase return not found', 404);
  return formatReturn(record, true);
};

const getBills = async (query = {}) => {
  let vendor = null;
  if (query.purchaseVendorId) {
    vendor = await resolveDocument('purchasevendors', query.purchaseVendorId);
    if (!vendor) throw new AppError('Purchase vendor not found', 404);
  }
  const filter = { status: { $nin: ['draft', 'void'] } };
  if (vendor) filter.purchaseVendorId = { $in: referenceValues(vendor) };
  const bills = await getCollection('purchasebills')
    .find(filter)
    .sort({ billDate: -1, _id: -1 })
    .limit(200)
    .toArray();
  return Promise.all(bills.map(async (bill) => {
    const billVendor = await resolveReferenceDocument('purchasevendors', bill.purchaseVendorId);
    return {
      _id: bill._id.toString(),
      billNumber: bill.billNumber ?? bill.bill_number ?? null,
      billDate: bill.billDate ?? bill.bill_date,
      status: bill.status,
      total: asNumber(bill.total),
      balanceDue: asNumber(bill.balanceDue ?? bill.balance_due),
      purchaseVendorId: billVendor ? {
        _id: billVendor._id.toString(),
        displayName: billVendor.displayName ?? billVendor.display_name ?? billVendor.name ?? '—',
      } : null,
    };
  }));
};

const getBillReturnableItemsById = async (id) => {
  requireObjectId(id, 'purchase bill');
  const bill = await resolveDocument('purchasebills', id);
  if (!bill) throw new AppError('Purchase bill not found', 404);
  const rows = await getBillReturnableItems(bill);
  return {
    bill: {
      _id: bill._id.toString(),
      billNumber: bill.billNumber ?? bill.bill_number ?? null,
      purchaseVendorId: (await resolveReferenceDocument('purchasevendors', bill.purchaseVendorId))?._id?.toString() || null,
      storeId: (await resolveReferenceDocument('stores', bill.storeId))?._id?.toString() || null,
      warehouseId: (await resolveReferenceDocument('warehouses', bill.warehouseId))?._id?.toString() || null,
      status: bill.status,
    },
    fullyReturned: rows.length === 0,
    items: rows,
  };
};

const nextReturnNumber = async (session) => {
  const year = new Date().getFullYear();
  const prefix = `DN-${year}-`;
  const latest = await getCollection('purchasereturns').find({
    returnNumber: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  }, { session }).sort({ returnNumber: -1 }).limit(1).next();
  const maximum = latest ? Number(String(latest.returnNumber).slice(prefix.length)) || 0 : 0;
  const sequenceId = `purchaseReturn:${year}`;
  await Sequence.updateOne(
    { _id: sequenceId },
    { $max: { value: maximum } },
    { upsert: true, session },
  );
  const sequence = await Sequence.findOneAndUpdate(
    { _id: sequenceId },
    { $inc: { value: 1 } },
    { new: true, session },
  );
  return `${prefix}${String(sequence.value).padStart(4, '0')}`;
};

const lockBillForReturn = async (bill, session) => {
  const key = `purchaseReturnBill:${bill._id.toString()}`;
  await Sequence.updateOne({ _id: key }, { $inc: { value: 1 } }, { upsert: true, session });
};

const normalizeDraftItems = async (body, bill, session) => {
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new AppError('At least one return item is required', 400);
  }
  const billLines = bill ? await getBillItems(bill, session) : [];
  const available = bill ? await getBillReturnableItems(bill, session) : [];
  const normalized = [];
  const requestedByBillLine = new Map();
  for (const [index, raw] of body.items.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new AppError(`items[${index}] must be an object`, 400);
    }
    const returnedQty = Number(raw.returnedQty ?? raw.qty);
    const rate = Number(raw.rate);
    const taxRate = Number(raw.taxRate ?? raw.taxPercent ?? 0);
    if (!Number.isFinite(returnedQty) || returnedQty <= 0) {
      throw new AppError(`items[${index}].returnedQty must be a positive number`, 400);
    }
    if (!Number.isFinite(rate) || rate < 0) throw new AppError(`items[${index}].rate must be non-negative`, 400);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      throw new AppError(`items[${index}].taxRate must be between 0 and 100`, 400);
    }
    const billLineId = raw.purchaseBillItemId ?? raw.purchase_bill_item_id;
    let billLine = null;
    if (billLineId !== undefined && billLineId !== null && billLineId !== '') {
      billLine = billLines.find((line) => (
        referenceMatches(line._id, billLineId) || referenceMatches(line.legacyId, billLineId)
      ));
      if (!bill || !billLine) throw new AppError(`items[${index}] does not belong to the selected bill`, 400);
      const lineKey = String(billLine._id);
      requestedByBillLine.set(lineKey, (requestedByBillLine.get(lineKey) || 0) + returnedQty);
      const remainingLine = available.find((line) => (
        line._id === String(billLine._id)
        || (billLine.legacyId !== undefined && String(line.legacyId) === String(billLine.legacyId))
      ));
      const remaining = remainingLine?.maxQty || 0;
      if (requestedByBillLine.get(lineKey) - remaining > 0.0005) {
        throw new AppError(`Return quantity exceeds the remaining bill quantity (${remaining})`, 400);
      }
    }
    const item = await resolveReferenceDocument(
      'items',
      billLine?.itemId ?? billLine?.item_id ?? raw.itemId,
      session,
    );
    if (!item && (billLine?.itemId ?? raw.itemId)) {
      throw new AppError(`items[${index}].itemId was not found`, 404);
    }
    const itemName = text(raw.itemName ?? raw.item_name ?? billLine?.itemName ?? billLine?.item_name ?? item?.name).trim();
    if (!itemName || itemName.length > 500) throw new AppError(`items[${index}].itemName is required and must be at most 500 characters`, 400);
    const subTotal = rounded(returnedQty * rate);
    const taxAmount = rounded(subTotal * taxRate / 100);
    normalized.push({
      itemId: item?._id,
      purchaseBillItemId: billLine?._id || (billLineId || undefined),
      sourceType: truthy(bill?.stockSuppliedToStore ?? bill?.stock_supplied_to_store)
        || !(bill?.warehouseId ?? bill?.warehouse_id) ? 'store' : 'warehouse',
      sourceId: truthy(bill?.stockSuppliedToStore ?? bill?.stock_supplied_to_store)
        || !(bill?.warehouseId ?? bill?.warehouse_id)
        ? (bill?.storeId ?? bill?.store_id)
        : (bill?.warehouseId ?? bill?.warehouse_id),
      itemName,
      unitName: text(raw.unitName ?? raw.unit_name ?? billLine?.unit ?? billLine?.unitName ?? 'pcs').trim() || 'pcs',
      returnedQty,
      rate,
      taxRate,
      taxAmount,
      subTotal,
      totalAmount: rounded(subTotal + taxAmount),
      reason: raw.reason ? text(raw.reason) : undefined,
    });
  }
  return normalized;
};

const create = async (body = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('Return details must be an object', 400);
  }
  const vendorInput = body.purchaseVendorId ?? body.purchase_vendor_id;
  if (!vendorInput) throw new AppError('purchaseVendorId is required', 400);
  const returnDate = new Date(body.returnDate ?? body.return_date ?? new Date());
  if (Number.isNaN(returnDate.getTime())) throw new AppError('returnDate must be a valid date', 400);
  const reason = body.reason || 'damaged';
  if (!REASONS.includes(reason)) throw new AppError(`reason must be one of: ${REASONS.join(', ')}`, 400);
  if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 2000)) {
    throw new AppError('notes must be a string no longer than 2000 characters', 400);
  }

  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      const vendor = await resolveDocument('purchasevendors', vendorInput, session);
      if (!vendor) throw new AppError('Purchase vendor not found', 404);
      const billInput = body.purchaseBillId ?? body.purchase_bill_id;
      const bill = billInput ? await resolveDocument('purchasebills', billInput, session) : null;
      if (billInput && !bill) throw new AppError('Purchase bill not found', 404);
      if (bill) {
        if (['draft', 'void'].includes(bill.status)) {
          throw new AppError('Draft or void bills cannot be returned', 409);
        }
        if (!referenceMatches(bill.purchaseVendorId, vendor._id)
          && !referenceMatches(bill.purchaseVendorId, vendor.legacyId)) {
          throw new AppError('Purchase bill does not belong to the selected vendor', 400);
        }
        await lockBillForReturn(bill, session);
      }
      const items = await normalizeDraftItems(body, bill, session);
      const subTotal = rounded(items.reduce((sum, item) => sum + item.subTotal, 0));
      const taxTotal = rounded(items.reduce((sum, item) => sum + item.taxAmount, 0));
      [created] = await PurchaseReturn.create([{
        returnNumber: await nextReturnNumber(session),
        purchaseVendorId: vendor._id,
        purchaseBillId: bill?._id,
        storeId: bill
          ? (await resolveReferenceDocument('stores', bill.storeId, session))?._id
          : (body.storeId ? (await resolveDocument('stores', body.storeId, session))?._id : undefined),
        warehouseId: bill
          ? (await resolveReferenceDocument('warehouses', bill.warehouseId, session))?._id
          : (body.warehouseId ? (await resolveDocument('warehouses', body.warehouseId, session))?._id : undefined),
        returnDate,
        reason,
        status: 'draft',
        subTotal,
        taxTotal,
        totalAmount: rounded(subTotal + taxTotal),
        notes: body.notes?.trim() || undefined,
        items,
      }], { session });
    });
  } finally {
    await session.endSession();
  }
  return getOne(created._id.toString());
};

const setQty = (current, value) => (typeof current === 'string' ? value.toFixed(4) : value);

const stockCandidates = (document) => referenceValues(document);

const findStockRow = async (collectionName, locationField, location, item, session) => {
  const filter = {
    [locationField]: { $in: stockCandidates(location) },
    itemId: { $in: stockCandidates(item) },
  };
  if (collectionName === 'storeitemstocks') filter.variant = '';
  return getCollection(collectionName).findOne(filter, { session });
};

const stockQuantity = (stockRow, item) => (
  stockRow ? asNumber(stockRow.qty) : asNumber(item.stock)
);

const resolveReturnLines = async (record, session) => {
  const bill = await resolveReferenceDocument('purchasebills', record.purchaseBillId, session);
  const rawLines = await getReturnItems(record, session);
  const billLines = bill ? await getBillItems(bill, session) : [];
  const lines = [];
  for (const rawLine of rawLines) {
    const item = await resolveReferenceDocument('items', rawLine.itemId ?? rawLine.item_id, session);
    const billLineId = rawLine.purchaseBillItemId ?? rawLine.purchase_bill_item_id;
    const billLine = billLines.find((line) => (
      referenceMatches(line._id, billLineId) || referenceMatches(line.legacyId, billLineId)
    ));
    lines.push({
      raw: rawLine,
      item,
      qty: rounded(
        asNumber(rawLine.returnedQty ?? rawLine.returned_qty)
        * Math.max(0.0001, asNumber(billLine?.conversionFactor ?? billLine?.conversion_factor, 1)),
        4,
      ),
    });
  }
  return { bill, lines };
};

const determineStockTarget = async (record, bill, session) => {
  if (bill) {
    if (!truthy(bill.stockReceived ?? bill.stock_received)) {
      throw new AppError('Bill stock has not been received; it cannot be returned', 409);
    }
    const warehouse = await resolveReferenceDocument('warehouses', bill.warehouseId, session);
    const store = await resolveReferenceDocument('stores', bill.storeId, session);
    if (truthy(bill.stockSuppliedToStore ?? bill.stock_supplied_to_store) || !warehouse) {
      if (!store) throw new AppError('The bill has no valid stock location', 409);
      return { type: 'store', location: store };
    }
    if (!['active', '1', 1, true].includes(warehouse.status)) {
      throw new AppError('The bill warehouse is inactive', 409);
    }
    return { type: 'warehouse', location: warehouse };
  }
  if (record.warehouseId) {
    const warehouse = await resolveReferenceDocument('warehouses', record.warehouseId, session);
    if (!warehouse) throw new AppError('Return warehouse not found', 404);
    return { type: 'warehouse', location: warehouse };
  }
  const store = await resolveReferenceDocument('stores', record.storeId, session);
  if (!store) throw new AppError('Return store not found', 404);
  return { type: 'store', location: store };
};

const verifyStockAndMove = async (record, target, lines, sign, session) => {
  const grouped = new Map();
  for (const line of lines) {
    if (!line.item || line.qty <= 0) continue;
    const key = line.item._id.toString();
    const existing = grouped.get(key);
    grouped.set(key, {
      item: line.item,
      qty: rounded((existing?.qty || 0) + line.qty, 4),
      lines: [...(existing?.lines || []), line],
    });
  }

  const stockCollection = target.type === 'warehouse' ? 'warehouseitemstocks' : 'storeitemstocks';
  const locationField = target.type === 'warehouse' ? 'warehouseId' : 'storeId';
  const itemCollection = getCollection('items');
  const deltas = [];
  for (const { item, qty, lines: groupedLines } of grouped.values()) {
    const stockRow = await findStockRow(stockCollection, locationField, target.location, item, session);
    const currentItem = await itemCollection.findOne({ _id: item._id }, { session });
    if (!currentItem) throw new AppError(`Item not found: ${item.name || item._id}`, 404);
    if (target.type === 'store') {
      const itemStore = await resolveReferenceDocument('stores', currentItem.storeId, session);
      if (itemStore && itemStore._id.toString() !== target.location._id.toString()) {
        throw new AppError(`${item.name || 'Item'} does not belong to the target store`, 409);
      }
    }
    if (target.type === 'warehouse' && !stockRow) {
      throw new AppError(`No warehouse stock record exists for ${item.name || 'item'}`, 409);
    }
    if (target.type === 'store' && !stockRow && !currentItem) {
      throw new AppError(`No store stock record exists for ${item.name || 'item'}`, 409);
    }
    const current = stockQuantity(stockRow, currentItem);
    const next = rounded(current + sign * qty, 4);
    if (next < -0.0005) {
      throw new AppError(
        `${item.name || 'Item'}: available ${rounded(current, 3)}, returning ${rounded(qty, 3)}`,
        409,
      );
    }
    deltas.push({ item, stockRow, currentItem, current, qty, next: Math.max(0, next), lines: groupedLines });
  }

  for (const delta of deltas) {
    await adjustBatches(target, delta.item, delta.qty, sign, session);
    if (delta.stockRow) {
      await getCollection(stockCollection).updateOne(
        { _id: delta.stockRow._id },
        { $set: { qty: setQty(delta.stockRow.qty, delta.next), updatedAt: new Date() } },
        { session },
      );
    } else {
      await itemCollection.updateOne(
        { _id: delta.currentItem._id },
        { $set: { stock: setQty(delta.currentItem.stock, delta.next), updatedAt: new Date() } },
        { session },
      );
    }
    const movement = {
      itemId: delta.item._id,
      qtyChange: sign * delta.qty,
      balanceAfter: delta.next,
      type: sign < 0 ? 'vendor_return' : 'vendor_return_void',
      referenceType: 'purchase_return',
      referenceId: record._id,
      referenceNo: record.returnNumber,
      note: `Purchase return ${record.returnNumber}`,
      movedAt: new Date(),
    };
    if (target.type === 'warehouse') {
      await WarehouseStockMovement.create([{
        ...movement,
        warehouseId: target.location._id,
        storeId: (await resolveReferenceDocument('stores', record.storeId, session))?._id,
      }], { session });
    } else {
      await StoreStockMovement.create([{
        ...movement,
        storeId: target.location._id,
      }], { session });
    }
  }
};

const adjustBatches = async (target, item, qty, sign, session) => {
  if (!truthy(item.trackBatch ?? item.track_batch) && !truthy(item.isPerishable ?? item.is_perishable)) return;
  const collectionName = target.type === 'warehouse' ? 'warehouseitembatches' : 'itembatches';
  const locationField = target.type === 'warehouse' ? 'warehouseId' : 'storeId';
  const batches = await getCollection(collectionName).find({
    [locationField]: { $in: stockCandidates(target.location) },
    itemId: { $in: stockCandidates(item) },
  }, { session }).sort({ expiryDate: 1, _id: 1 }).toArray();
  if (!batches.length) return;

  const available = batches.reduce((sum, batch) => sum + asNumber(batch.qty), 0);
  if (sign < 0 && available - qty < -0.0005) {
    throw new AppError(`${item.name || 'Item'} has insufficient batch stock`, 409);
  }
  let remaining = qty;
  for (const batch of batches) {
    if (remaining <= 0.00005) break;
    const batchQty = asNumber(batch.qty);
    const change = sign < 0 ? -Math.min(batchQty, remaining) : remaining;
    if (change === 0) continue;
    await getCollection(collectionName).updateOne(
      { _id: batch._id },
      { $set: { qty: setQty(batch.qty, Math.max(0, rounded(batchQty + change, 4))), updatedAt: new Date() } },
      { session },
    );
    if (sign < 0) remaining = rounded(remaining + change, 4);
    else remaining = 0;
  }
};

const refreshBillBalance = async (bill, session) => {
  if (!bill || ['draft', 'void'].includes(bill.status)) return;
  const billRefs = referenceValues(bill);
  const paymentRows = await getCollection('purchasepayments')
    .find({ purchaseBillId: { $in: billRefs } }, { session })
    .toArray();
  const returns = await getCollection('purchasereturns')
    .find({ purchaseBillId: { $in: billRefs }, status: 'completed' }, { session })
    .toArray();
  const amountPaid = rounded(paymentRows.reduce((sum, row) => sum + asNumber(row.amount), 0));
  const returned = rounded(returns.reduce((sum, row) => sum + asNumber(row.totalAmount ?? row.total_amount), 0));
  const total = asNumber(bill.total);
  const settled = amountPaid + returned;
  const balanceDue = settled + 0.009 >= total ? 0 : Math.max(0, rounded(total - settled));
  const status = settled <= 0 ? 'open' : balanceDue === 0 ? 'paid' : 'partially_paid';
  await getCollection('purchasebills').updateOne(
    { _id: bill._id },
    {
      $set: {
        amountPaid: setQty(bill.amountPaid ?? bill.amount_paid ?? 0, amountPaid),
        balanceDue: setQty(bill.balanceDue ?? bill.balance_due ?? 0, balanceDue),
        status,
        updatedAt: new Date(),
      },
    },
    { session },
  );
};

const approve = async (id) => {
  requireObjectId(id, 'purchase return');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const record = await resolveDocument('purchasereturns', id, session);
      if (!record) throw new AppError('Purchase return not found', 404);
      if (['completed', 'void'].includes(record.status)) return;
      const { bill, lines } = await resolveReturnLines(record, session);
      let target = null;
      if (!truthy(record.stockDeducted ?? record.stock_deducted)) {
        target = await determineStockTarget(record, bill, session);
        await verifyStockAndMove(record, target, lines, -1, session);
        const update = {
          stockDeducted: true,
          stockDeductedAt: new Date(),
          stockDeductedFrom: target.type,
          status: 'completed',
          updatedAt: new Date(),
        };
        if (target.type === 'store') update.storeId = target.location._id;
        else update.warehouseId = target.location._id;
        await getCollection('purchasereturns').updateOne({ _id: record._id }, { $set: update }, { session });
      } else {
        await getCollection('purchasereturns').updateOne(
          { _id: record._id },
          { $set: { status: 'completed', updatedAt: new Date() } },
          { session },
        );
      }
      await refreshBillBalance(bill, session);
    });
  } finally {
    await session.endSession();
  }
  return getOne(id);
};

const voidReturn = async (id) => {
  requireObjectId(id, 'purchase return');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const record = await resolveDocument('purchasereturns', id, session);
      if (!record) throw new AppError('Purchase return not found', 404);
      if (record.status === 'void') return;
      const { bill, lines } = await resolveReturnLines(record, session);
      if (truthy(record.stockDeducted ?? record.stock_deducted)) {
        const locationType = record.stockDeductedFrom
          ?? record.stock_deducted_from
          ?? (record.warehouseId || record.warehouse_id ? 'warehouse' : 'store');
        const locationId = locationType === 'warehouse'
          ? record.warehouseId ?? record.warehouse_id
          : record.storeId ?? record.store_id;
        const location = await resolveReferenceDocument(
          locationType === 'warehouse' ? 'warehouses' : 'stores',
          locationId,
          session,
        );
        if (!location) throw new AppError('Original stock location could not be found', 409);
        await verifyStockAndMove(record, { type: locationType, location }, lines, 1, session);
      }
      await getCollection('purchasereturns').updateOne(
        { _id: record._id },
        {
          $set: {
            status: 'void',
            stockDeducted: false,
            stockDeductedAt: null,
            stockDeductedFrom: null,
            updatedAt: new Date(),
          },
        },
        { session },
      );
      await refreshBillBalance(bill, session);
    });
  } finally {
    await session.endSession();
  }
  return getOne(id);
};

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const toCsv = (rows) => rows.map((row) => row.map(csvCell).join(',')).join('\r\n');

const exportBillItems = async (id) => {
  const result = await getBillReturnableItemsById(id);
  const rows = [[
    'purchase_bill_item_id', 'item_id', 'item_name', 'billed_qty', 'remaining_qty',
    'unit_name', 'rate', 'tax_percent', 'returned_qty',
  ]];
  for (const item of result.items) {
    rows.push([
      item._id, item.itemId || '', item.itemName, item.billedQty, item.maxQty,
      item.unitName, item.rate, item.taxPercent, 0,
    ]);
  }
  return {
    content: `\uFEFF${toCsv(rows)}`,
    filename: `bill_${String(result.bill.billNumber || result.bill._id).replace(/[^\w.-]/g, '_')}_return_template.csv`,
  };
};

const parseCsv = (content) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = content.replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (quoted) throw new AppError('CSV contains an unclosed quoted field', 400);
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
};

const importCsv = async (id, content) => {
  if (typeof content !== 'string' || content.length > 10 * 1024 * 1024) {
    throw new AppError('CSV content is required and must be under 10 MB', 400);
  }
  const rows = parseCsv(content);
  if (rows.length < 2) throw new AppError('CSV must include a header and at least one item', 400);
  const normalizedHeaders = rows[0].map((header) => header.toLowerCase().replace(/[\s_-]/g, ''));
  const column = (...names) => names.map((name) => normalizedHeaders.indexOf(name)).find((index) => index >= 0);
  const idIndex = column('purchasebillitemid');
  const qtyIndex = column('returnedqty', 'returnqty');
  if (idIndex === undefined || qtyIndex === undefined) {
    throw new AppError('CSV requires purchase_bill_item_id and returned_qty columns', 400);
  }
  const choices = await getBillReturnableItemsById(id);
  const available = new Map(choices.items.flatMap((item) => [
    [item._id, item],
    ...(item.legacyId === undefined ? [] : [[String(item.legacyId), item]]),
  ]));
  const items = [];
  for (const row of rows.slice(1)) {
    const qty = Number(row[qtyIndex]);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const selected = available.get(row[idIndex]);
    if (!selected) throw new AppError(`Bill item ${row[idIndex]} is no longer returnable`, 409);
    if (qty - selected.maxQty > 0.0005) {
      throw new AppError(`Return quantity exceeds the remaining bill quantity for ${selected.itemName}`, 400);
    }
    items.push({
      purchaseBillItemId: selected._id,
      itemId: selected.itemId,
      itemName: selected.itemName,
      unitName: selected.unitName,
      returnedQty: qty,
      rate: selected.rate,
      taxRate: selected.taxPercent,
    });
  }
  if (!items.length) throw new AppError('No return items found with returned_qty greater than zero', 400);
  return { count: items.length, items };
};

const exportReturns = async (query = {}) => {
  const returns = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const result = await getAll({ ...query, page, limit: 100 });
    returns.push(...result.returns);
    pages = result.pagination.pages;
    page += 1;
  }
  const rows = [['return_number', 'vendor', 'bill_number', 'return_date', 'status', 'total_amount']];
  for (const item of returns) {
    rows.push([
      item.returnNumber,
      item.purchaseVendorId?.displayName || '—',
      item.purchaseBillId?.billNumber || '',
      item.returnDate,
      item.status,
      item.totalAmount,
    ]);
  }
  return { content: `\uFEFF${toCsv(rows)}`, filename: 'purchase_returns.csv' };
};

module.exports = {
  getAll,
  getOne,
  getBills,
  getBillReturnableItemsById,
  create,
  approve,
  voidReturn,
  exportBillItems,
  importCsv,
  exportReturns,
  parseCsv,
  getBillReturnableItems,
  formatReturn,
};

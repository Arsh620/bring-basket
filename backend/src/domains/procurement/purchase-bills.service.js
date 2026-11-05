const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const mongoose = require('mongoose');
const path = require('node:path');
const PurchaseBill = require('../../models/purchase/PurchaseBill');
const PurchaseOrder = require('../../models/purchase/PurchaseOrder');
const PurchasePayment = require('../../models/purchase/PurchasePayment');
const PurchaseReturn = require('../../models/purchase/PurchaseReturn');
const { refreshBillPaymentStatus } = require('./purchase-payments.service');
const Sequence = require('../../models/purchase/Sequence');
const Warehouse = require('../../models/warehouse/Warehouse');
const WarehouseItemStock = require('../../models/warehouse/WarehouseItemStock');
const WarehouseStockMovement = require('../../models/warehouse/WarehouseStockMovement');
const WarehouseItemBatch = require('../../models/warehouse/WarehouseItemBatch');
const Store = require('../../models/store/Store');
const Zone = require('../../models/store/Zone');
const Item = require('../../models/catalog/Item');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

const INVOICE_DIRECTORY = path.resolve(__dirname, '../../../storage/purchase-bill-invoices');
const INVOICE_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const validateId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${label} ID`, 400);
};

const validDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

const validateInvoiceFile = (file) => {
  const extension = INVOICE_TYPES[file?.mimetype];
  if (!file?.buffer || !extension) {
    throw new AppError('Invoice must be a PDF, JPEG, PNG, or WebP file', 400);
  }
  const signatureMatches = file.mimetype === 'application/pdf'
    ? file.buffer.subarray(0, 5).toString() === '%PDF-'
    : file.mimetype === 'image/png'
      ? file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : file.mimetype === 'image/jpeg'
        ? file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff
        : file.buffer.subarray(0, 4).toString() === 'RIFF'
          && file.buffer.subarray(8, 12).toString() === 'WEBP';
  const originalExtension = path.extname(file.originalname || '').toLowerCase();
  const allowedExtensions = file.mimetype === 'image/jpeg' ? ['.jpg', '.jpeg'] : [extension];
  if (!signatureMatches || !allowedExtensions.includes(originalExtension)) {
    throw new AppError('Invoice file contents do not match its file type', 400);
  }
  return { extension, mimeType: file.mimetype };
};

const saveInvoiceFile = async (file) => {
  assertLocalInvoiceStorage();
  const { extension } = validateInvoiceFile(file);
  await fs.mkdir(INVOICE_DIRECTORY, { recursive: true });
  const filename = `${crypto.randomUUID()}${extension}`;
  const filePath = path.join(INVOICE_DIRECTORY, filename);
  try {
    await fs.writeFile(filePath, file.buffer, { flag: 'wx' });
  } catch (error) {
    try {
      await fs.unlink(filePath);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') {
        console.error('Failed to clean up an incomplete GRN invoice file', cleanupError);
      }
    }
    throw error;
  }
  return filename;
};

const removeInvoiceFile = async (filename) => {
  if (!filename || path.basename(filename) !== filename) return;
  try {
    await fs.unlink(path.join(INVOICE_DIRECTORY, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

const assertLocalInvoiceStorage = () => {
  if (process.env.NODE_ENV === 'production') {
    throw new AppError(
      'Local GRN invoice storage is development-only; configure private object storage before production',
      503,
    );
  }
};

const getInvoiceFile = async (id) => {
  validateId(id, 'purchase bill');
  assertLocalInvoiceStorage();
  const bill = await PurchaseBill.findById(id).select(
    'grnInvoicePath grnInvoiceOriginalName grnInvoiceMimeType',
  );
  if (!bill) throw new AppError('Purchase bill not found', 404);
  if (!bill.grnInvoicePath || path.basename(bill.grnInvoicePath) !== bill.grnInvoicePath) {
    throw new AppError('GRN invoice not found', 404);
  }
  const filePath = path.join(INVOICE_DIRECTORY, bill.grnInvoicePath);
  try {
    await fs.access(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') throw new AppError('GRN invoice file is missing', 404);
    throw error;
  }
  return {
    filePath,
    originalName: bill.grnInvoiceOriginalName,
    mimeType: bill.grnInvoiceMimeType,
  };
};

const getNextBillNumber = async (session) => {
  const sequenceId = 'purchaseBill';
  if (!await Sequence.exists({ _id: sequenceId }).session(session)) {
    const [existing] = await PurchaseBill.aggregate([
      { $group: { _id: null, value: { $max: '$billNumber' } } },
    ]).session(session);
    try {
      await Sequence.updateOne(
        { _id: sequenceId },
        { $setOnInsert: { value: existing?.value || 0 } },
        { upsert: true, session },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  const counter = await Sequence.findOneAndUpdate(
    { _id: sequenceId },
    { $inc: { value: 1 } },
    { new: true, session },
  );
  return counter.value;
};

const expectedPhysicalQty = (item) => Number(item.qty || 0) + Number(item.freeQty || 0);

const buildBillItems = (order, requestedItems) => {
  const orderItems = order.items;
  const selections = requestedItems === undefined
    ? orderItems
      .map((item) => ({
        purchaseOrderItemId: item._id,
        qty: Number(item.qty) - Number(item.qtyBilled || 0),
      }))
      .filter((item) => item.qty > 0)
    : requestedItems;

  if (!Array.isArray(selections) || selections.length === 0) {
    throw new AppError('At least one unbilled purchase order item is required', 400);
  }

  const seen = new Set();
  return selections.map((selection, index) => {
    if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
      throw new AppError(`items[${index}] must be an object`, 400);
    }
    validateId(selection.purchaseOrderItemId, `items[${index}].purchaseOrderItem`);
    const selectionId = String(selection.purchaseOrderItemId);
    if (seen.has(selectionId)) throw new AppError('Duplicate purchase order item', 400);
    seen.add(selectionId);

    const source = orderItems.id(selectionId);
    if (!source) throw new AppError(`Purchase order item not found: ${selectionId}`, 404);
    const qty = Number(selection.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new AppError(`items[${index}].qty must be a positive number`, 400);
    }
    const remaining = Math.max(0, Number(source.qty) - Number(source.qtyBilled || 0));
    if (qty - remaining > 0.0001) {
      throw new AppError(`items[${index}].qty exceeds the unbilled quantity (${remaining})`, 400);
    }

    const schemeBuyQty = Number(source.schemeBuyQty || 0);
    const schemeGetQty = Number(source.schemeGetQty || 0);
    const freeQty = schemeBuyQty > 0 && schemeGetQty > 0
      ? Math.floor(qty / schemeBuyQty) * schemeGetQty
      : 0;
    const conversionFactor = Number(source.conversionFactor) || 1;
    const baseQty = Number(((qty + freeQty) * conversionFactor).toFixed(4));
    const rate = Number(source.rate) || 0;
    const taxPercent = Number(source.taxPercent) || 0;
    const subTotal = Number((qty * rate).toFixed(2));
    const taxAmount = Number((subTotal * taxPercent / 100).toFixed(2));
    return {
      purchaseOrderItemId: source._id,
      itemId: source.itemId,
      sortOrder: index,
      itemName: source.itemName,
      description: source.description,
      hsnSac: source.hsnSac,
      qty,
      schemeBuyQty: source.schemeBuyQty,
      schemeGetQty: source.schemeGetQty,
      freeQty,
      billedQty: Number((qty + freeQty).toFixed(4)),
      qtyReceived: 0,
      unit: source.unit,
      baseUnit: source.baseUnit,
      conversionFactor,
      baseQty,
      unitGroupId: source.unitGroupId,
      rate,
      mrp: source.mrp,
      sellingPrice: source.sellingPrice,
      unitCost: baseQty > 0 ? Number((subTotal / baseQty).toFixed(6)) : 0,
      taxPercent,
      taxAmount,
      amount: Number((subTotal + taxAmount).toFixed(2)),
    };
  });
};

const calculateTotals = (items) => {
  const subTotal = Number(items.reduce((sum, item) => sum + item.qty * item.rate, 0).toFixed(2));
  const taxTotal = Number(items.reduce((sum, item) => sum + item.taxAmount, 0).toFixed(2));
  return { subTotal, taxTotal, total: Number((subTotal + taxTotal).toFixed(2)) };
};

const getAll = async (query) => {
  const { page, limit, skip } = paginate(query);
  const filter = {};
  for (const field of ['purchaseVendorId', 'purchaseOrderId', 'warehouseId', 'storeId']) {
    if (query[field]) {
      validateId(query[field], field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`));
      filter[field] = query[field];
    }
  }
  if (query.status) {
    if (!['draft', 'open', 'partially_paid', 'paid', 'void'].includes(query.status)) {
      throw new AppError('Invalid purchase bill status', 400);
    }
    filter.status = query.status;
  }
  if (query.stockReceived !== undefined) {
    if (!['true', 'false'].includes(query.stockReceived)) {
      throw new AppError('stockReceived must be true or false', 400);
    }
    filter.stockReceived = query.stockReceived === 'true';
  }
  if (query.search) {
    const search = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const alternatives = [{ poNumber: new RegExp(search, 'i') }];
    if (/^\d+$/.test(query.search)) alternatives.push({ billNumber: Number(query.search) });
    filter.$or = alternatives;
  }
  const [bills, total] = await Promise.all([
    PurchaseBill.find(filter)
      .populate('purchaseVendorId', 'displayName legalName')
      .populate('purchaseOrderId', 'poNumber status')
      .populate('warehouseId', 'name code')
      .populate('storeId', 'name')
      .sort({ billDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    PurchaseBill.countDocuments(filter),
  ]);
  return { bills, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
};

const getOne = async (id) => {
  validateId(id, 'purchase bill');
  const bill = await PurchaseBill.findById(id)
    .populate('purchaseVendorId', 'displayName legalName email mobile')
    .populate('purchaseOrderId', 'poNumber status')
    .populate('warehouseId', 'name code state')
    .populate('storeId', 'name');
  if (!bill) throw new AppError('Purchase bill not found', 404);
  return bill;
};

const updateBill = async (id, body) => {
  validateId(id, 'purchase bill');
  const writableFields = ['billDate', 'dueDate', 'terms', 'notes', 'poNumber'];
  const fields = Object.fromEntries(
    writableFields
      .filter((field) => Object.prototype.hasOwnProperty.call(body || {}, field))
      .map((field) => [field, body[field]]),
  );
  if (!Object.keys(fields).length) throw new AppError('No valid fields to update', 400);
  if (fields.billDate !== undefined) {
    fields.billDate = new Date(fields.billDate);
    if (!validDate(fields.billDate)) throw new AppError('billDate must be a valid date', 400);
  }
  if (fields.dueDate !== undefined) {
    fields.dueDate = fields.dueDate ? new Date(fields.dueDate) : null;
    if (fields.dueDate && !validDate(fields.dueDate)) {
      throw new AppError('dueDate must be a valid date', 400);
    }
  }
  for (const field of ['terms', 'notes', 'poNumber']) {
    if (fields[field] !== undefined && typeof fields[field] !== 'string') {
      throw new AppError(`${field} must be a string`, 400);
    }
  }
  for (const [field, maximum] of Object.entries({ terms: 100, notes: 2000, poNumber: 100 })) {
    if (fields[field] !== undefined && fields[field].length > maximum) {
      throw new AppError(`${field} cannot exceed ${maximum} characters`, 400);
    }
  }

  const session = await mongoose.startSession();
  let updatedBill;
  try {
    await session.withTransaction(async () => {
      const bill = await PurchaseBill.findById(id).session(session);
      if (!bill) throw new AppError('Purchase bill not found', 404);
      if (bill.status === 'void') throw new AppError('A void bill cannot be edited', 409);
      if (bill.stockReceived) throw new AppError('A bill cannot be edited after stock is received', 409);
      if (Number(bill.amountPaid) > 0
        || await PurchasePayment.exists({ purchaseBillId: id }).session(session)) {
        throw new AppError('A bill with payments cannot be edited', 409);
      }
      if (await PurchaseReturn.exists({
        purchaseBillId: id,
        status: 'completed',
      }).session(session)) {
        throw new AppError('A bill with completed returns cannot be edited', 409);
      }
      Object.assign(bill, fields);
      await bill.save({ session });
      updatedBill = bill;
    });
  } finally {
    await session.endSession();
  }
  return updatedBill;
};

const voidBill = async (id) => {
  validateId(id, 'purchase bill');
  const session = await mongoose.startSession();
  let voidedBill;
  try {
    await session.withTransaction(async () => {
      const bill = await PurchaseBill.findById(id).session(session);
      if (!bill) throw new AppError('Purchase bill not found', 404);
      if (bill.status === 'void') {
        voidedBill = bill;
        return;
      }
      if (Number(bill.amountPaid) > 0
        || await PurchasePayment.exists({ purchaseBillId: id }).session(session)) {
        throw new AppError('A bill with payments cannot be voided', 409);
      }
      if (await PurchaseReturn.exists({
        purchaseBillId: id,
        status: 'completed',
      }).session(session)) {
        throw new AppError('Void completed vendor returns before voiding this bill', 409);
      }
      if (bill.stockReceived) {
        throw new AppError('Reverse received stock before voiding this bill', 409);
      }

      bill.status = 'void';
      bill.balanceDue = 0;
      await bill.save({ session });

      if (bill.purchaseOrderId) {
        const order = await PurchaseOrder.findById(bill.purchaseOrderId).session(session);
        if (order) {
          for (const billItem of bill.items) {
            const orderItem = billItem.purchaseOrderItemId
              ? order.items.id(billItem.purchaseOrderItemId)
              : null;
            if (orderItem) {
              orderItem.qtyBilled = Math.max(
                0,
                Number(orderItem.qtyBilled || 0) - Number(billItem.qty || 0),
              );
            }
          }
          order.status = order.items.every(
            (item) => Number(item.qtyBilled || 0) >= Number(item.qty) - 0.0001,
          )
            ? 'billed'
            : order.items.some((item) => Number(item.qtyBilled || 0) > 0)
              ? 'partially_billed'
              : 'open';
          await order.save({ session });
        }
      }
      voidedBill = bill;
    });
  } finally {
    await session.endSession();
  }
  return voidedBill;
};

const createFromPurchaseOrder = async (id, body) => {
  validateId(id, 'purchase order');
  if (body.dueDate && !validDate(new Date(body.dueDate))) {
    throw new AppError('dueDate must be a valid date', 400);
  }
  if (body.billDate && !validDate(new Date(body.billDate))) {
    throw new AppError('billDate must be a valid date', 400);
  }

  const session = await mongoose.startSession();
  let createdBill;
  try {
    await session.withTransaction(async () => {
      const order = await PurchaseOrder.findById(id).session(session);
      if (!order) throw new AppError('Purchase order not found', 404);
      if (!['open', 'partially_billed'].includes(order.status)) {
        throw new AppError('Only issued purchase orders can be converted to a bill', 409);
      }

      const billItems = buildBillItems(order, body.items);
      const totals = calculateTotals(billItems);
      const billNumber = await getNextBillNumber(session);
      const [bill] = await PurchaseBill.create([{
        purchaseVendorId: order.purchaseVendorId,
        purchaseOrderId: order._id,
        warehouseId: order.warehouseId,
        storeId: order.storeId,
        billNumber,
        poNumber: order.poNumber,
        billDate: body.billDate ? new Date(body.billDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        terms: body.terms ?? order.terms,
        status: 'open',
        taxType: order.taxType,
        ...totals,
        amountPaid: 0,
        balanceDue: totals.total,
        notes: body.notes ?? order.notes,
        stockReceived: false,
        items: billItems,
      }], { session });

      for (const billItem of billItems) {
        const orderItem = order.items.id(billItem.purchaseOrderItemId);
        orderItem.qtyBilled = Number(orderItem.qtyBilled || 0) + billItem.qty;
      }
      const fullyBilled = order.items.every(
        (item) => Number(item.qtyBilled || 0) >= Number(item.qty) - 0.0001,
      );
      order.status = fullyBilled ? 'billed' : 'partially_billed';
      await order.save({ session });
      createdBill = bill;
    });
  } finally {
    await session.endSession();
  }
  return createdBill;
};

const normalizeReceiptItems = (bill, receiptItems) => {
  if (receiptItems === undefined) {
    return bill.items.map((item) => ({
      item,
      qtyReceived: expectedPhysicalQty(item),
      batchCode: item.batchCode,
      expiryDate: item.expiryDate,
    }));
  }
  if (!Array.isArray(receiptItems) || receiptItems.length !== bill.items.length) {
    throw new AppError('GRN items must include every purchase bill item', 400);
  }

  const byId = new Map(bill.items.map((item) => [String(item._id), item]));
  const seen = new Set();
  return receiptItems.map((receiptItem, index) => {
    if (!receiptItem || typeof receiptItem !== 'object' || Array.isArray(receiptItem)) {
      throw new AppError(`items[${index}] must be an object`, 400);
    }
    validateId(receiptItem.billItemId, `items[${index}].billItem`);
    const billItemId = String(receiptItem.billItemId);
    const item = byId.get(billItemId);
    if (!item || seen.has(billItemId)) {
      throw new AppError(`Invalid or duplicate bill item at items[${index}]`, 400);
    }
    seen.add(billItemId);
    const qtyReceived = Number(receiptItem.qtyReceived);
    if (!Number.isFinite(qtyReceived) || qtyReceived < 0) {
      throw new AppError(`items[${index}].qtyReceived must be a non-negative number`, 400);
    }
    if (qtyReceived - expectedPhysicalQty(item) > 0.0001) {
      throw new AppError(`GRN quantity exceeds billed quantity for ${item.itemName}`, 400);
    }
    if (receiptItem.batchCode !== undefined
      && (typeof receiptItem.batchCode !== 'string' || receiptItem.batchCode.length > 64)) {
      throw new AppError(`items[${index}].batchCode must be a string of at most 64 characters`, 400);
    }
    let expiryDate;
    if (receiptItem.expiryDate) {
      expiryDate = new Date(receiptItem.expiryDate);
      if (!validDate(expiryDate)) {
        throw new AppError(`items[${index}].expiryDate must be a valid date`, 400);
      }
    }
    return {
      item,
      qtyReceived,
      batchCode: receiptItem.batchCode,
      expiryDate,
    };
  });
};

const receiveStock = async (id, body, actor = {}, invoiceFile) => {
  validateId(id, 'purchase bill');
  if (body.warehouseId) validateId(body.warehouseId, 'warehouse');

  const savedFilename = invoiceFile ? await saveInvoiceFile(invoiceFile) : null;
  let previousFilename;
  let transactionSucceeded = false;
  let session;
  let receivedBill;
  let alreadyReceived = false;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const bill = await PurchaseBill.findById(id).session(session);
      if (!bill) throw new AppError('Purchase bill not found', 404);
      if (bill.stockReceived) {
        if (savedFilename) {
          previousFilename = bill.grnInvoicePath;
          bill.grnInvoicePath = savedFilename;
          bill.grnInvoiceOriginalName = invoiceFile.originalname.slice(0, 255);
          bill.grnInvoiceMimeType = invoiceFile.mimetype;
          bill.grnInvoiceUploadedAt = new Date();
          await bill.save({ session });
        }
        receivedBill = bill;
        alreadyReceived = true;
        return;
      }
      if (['draft', 'void'].includes(bill.status)) {
        throw new AppError('Stock cannot be received for a draft or void bill', 409);
      }

      const warehouseId = body.warehouseId || bill.warehouseId;
      validateId(warehouseId, 'warehouse');
      const warehouse = await Warehouse.findOne({
        _id: warehouseId,
        type: 'mother',
        status: 'active',
      }).session(session);
      if (!warehouse) throw new AppError('An active mother warehouse is required for GRN', 400);
      if (bill.storeId) {
        const store = await Store.findById(bill.storeId).session(session);
        if (!store) throw new AppError('Purchase bill store not found', 404);
        const zone = store.zoneId
          ? await Zone.findById(store.zoneId).select('state').session(session)
          : null;
        const storeState = zone?.state?.trim().toLowerCase();
        const warehouseState = warehouse.state?.trim().toLowerCase();
        if (storeState && warehouseState && storeState !== warehouseState) {
          throw new AppError('Store and warehouse must be in the same state', 400);
        }
      }

      const receiptItems = normalizeReceiptItems(bill, body.items);
      if (!receiptItems.some(({ qtyReceived }) => qtyReceived > 0)) {
        throw new AppError('At least one item must be received', 400);
      }
      const itemIds = receiptItems.map(({ item }) => item.itemId);
      if (itemIds.some((itemId) => !itemId)) {
        throw new AppError('Every bill line must be linked to a catalog item before receiving stock', 400);
      }
      const catalogItems = await Item.find({ _id: { $in: itemIds } }).session(session);
      const catalogItemIds = new Set(catalogItems.map((item) => String(item._id)));
      const catalogItemById = new Map(catalogItems.map((item) => [String(item._id), item]));
      for (const { item } of receiptItems) {
        if (!catalogItemIds.has(String(item.itemId))) {
          throw new AppError(`Catalog item not found for ${item.itemName}`, 404);
        }
      }

      const oldPaidQtyByOrderLine = new Map();
      for (const receipt of receiptItems) {
        const { item, qtyReceived, batchCode, expiryDate } = receipt;
        const oldPaidQty = Number(item.qty);
        const schemeBuyQty = Number(item.schemeBuyQty || 0);
        const schemeGetQty = Number(item.schemeGetQty || 0);
        const freeQty = schemeBuyQty > 0 && schemeGetQty > 0
          ? Math.floor(qtyReceived / (schemeBuyQty + schemeGetQty)) * schemeGetQty
          : 0;
        const paidQty = Math.max(0, qtyReceived - freeQty);
        const subtotal = Number((paidQty * Number(item.rate)).toFixed(2));
        const taxAmount = Number((subtotal * Number(item.taxPercent || 0) / 100).toFixed(2));
        const conversionFactor = Number(item.conversionFactor) || 1;
        const qtyChange = Number((qtyReceived * (Number(item.conversionFactor) || 1)).toFixed(4));

        if (qtyChange > 0) {
          const stock = await WarehouseItemStock.findOneAndUpdate(
            { warehouseId, itemId: item.itemId, variant: '' },
            {
              $inc: { qty: qtyChange },
              $set: {
                ...(item.sellingPrice !== undefined ? { sellingPrice: item.sellingPrice } : {}),
                ...(item.mrp !== undefined ? { mrp: item.mrp } : {}),
                status: 'listed',
              },
              $setOnInsert: { warehouseId, itemId: item.itemId, variant: '' },
            },
            { new: true, upsert: true, runValidators: true, session },
          );

          await WarehouseStockMovement.create([{
            warehouseId,
            itemId: item.itemId,
            qtyChange,
            balanceAfter: stock.qty,
            type: 'grn_in',
            referenceType: 'purchase_bill',
            referenceId: bill._id,
            referenceNo: `GRN-${String(bill.billNumber).padStart(5, '0')}`,
            storeId: bill.storeId,
            note: `Goods received from purchase bill #${bill.billNumber}`,
            actorType: actor.role || 'admin',
            ...(mongoose.isValidObjectId(actor.id) ? { actorId: actor.id } : {}),
            movedAt: new Date(),
          }], { session });

          const catalogItem = catalogItemById.get(String(item.itemId));
          if (batchCode || expiryDate || catalogItem.trackBatch || catalogItem.isPerishable) {
            const batchExpiry = expiryDate || (catalogItem.defaultShelfLifeDays
              ? new Date(Date.now() + catalogItem.defaultShelfLifeDays * 86400000)
              : null);
            const batchFilter = {
              warehouseId,
              itemId: item.itemId,
              batchCode: batchCode || '',
              expiryDate: batchExpiry,
            };
            await WarehouseItemBatch.findOneAndUpdate(
              batchFilter,
              {
                $inc: { qty: qtyChange },
                $setOnInsert: {
                  ...batchFilter,
                  sourceType: 'grn',
                  sourceId: bill.billNumber,
                },
              },
              { new: true, upsert: true, runValidators: true, session },
            );
          }
        }
        item.qtyReceived = qtyReceived;
        item.qty = paidQty;
        item.freeQty = freeQty;
        item.baseQty = Number(((paidQty + freeQty) * conversionFactor).toFixed(4));
        item.unitCost = item.baseQty > 0 ? Number((subtotal / item.baseQty).toFixed(6)) : 0;
        item.taxAmount = taxAmount;
        item.amount = Number((subtotal + taxAmount).toFixed(2));
        if (batchCode !== undefined) item.batchCode = batchCode;
        if (expiryDate !== undefined) item.expiryDate = expiryDate;
        if (item.purchaseOrderItemId) {
          oldPaidQtyByOrderLine.set(String(item.purchaseOrderItemId), {
            oldPaidQty,
            newPaidQty: paidQty,
          });
        }
      }

      if (bill.purchaseOrderId && oldPaidQtyByOrderLine.size) {
        const order = await PurchaseOrder.findById(bill.purchaseOrderId).session(session);
        if (!order) throw new AppError('Linked purchase order not found', 404);
        for (const [lineId, { oldPaidQty, newPaidQty }] of oldPaidQtyByOrderLine) {
          const orderItem = order.items.id(lineId);
          if (!orderItem) throw new AppError('Linked purchase order item not found', 409);
          orderItem.qtyBilled = Math.max(
            0,
            Number(orderItem.qtyBilled || 0) - oldPaidQty + newPaidQty,
          );
        }
        order.status = order.items.every(
          (item) => Number(item.qtyBilled || 0) >= Number(item.qty) - 0.0001,
        )
          ? 'billed'
          : order.items.some((item) => Number(item.qtyBilled || 0) > 0)
            ? 'partially_billed'
            : 'open';
        await order.save({ session });
      }

      const totals = calculateTotals(bill.items);
      bill.subTotal = totals.subTotal;
      bill.taxTotal = totals.taxTotal;
      bill.total = totals.total;
      bill.warehouseId = warehouseId;
      if (savedFilename) {
        bill.grnInvoicePath = savedFilename;
        bill.grnInvoiceOriginalName = invoiceFile.originalname.slice(0, 255);
        bill.grnInvoiceMimeType = invoiceFile.mimetype;
        bill.grnInvoiceUploadedAt = new Date();
      }
      bill.stockReceived = true;
      bill.stockReceivedAt = new Date();
      await bill.save({ session });
      await refreshBillPaymentStatus(bill, session);
      receivedBill = bill;
    });
    transactionSucceeded = true;
  } finally {
    try {
      if (session) await session.endSession();
    } finally {
      if (!transactionSucceeded && savedFilename) {
        try {
          await removeInvoiceFile(savedFilename);
        } catch (cleanupError) {
          console.error('Failed to remove an uncommitted GRN invoice file', cleanupError);
        }
      }
    }
  }
  if (previousFilename && previousFilename !== savedFilename) {
    try {
      await removeInvoiceFile(previousFilename);
    } catch (cleanupError) {
      console.error('Failed to remove a replaced GRN invoice file', cleanupError);
    }
  }
  return { bill: receivedBill, alreadyReceived };
};

module.exports = {
  getAll,
  getOne,
  getInvoiceFile,
  updateBill,
  voidBill,
  createFromPurchaseOrder,
  receiveStock,
  buildBillItems,
  calculateTotals,
  normalizeReceiptItems,
  validateInvoiceFile,
};

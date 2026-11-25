const test = require('node:test');
const assert = require('node:assert/strict');
const supplierPortal = require('../src/domains/procurement/supplier-portal.service');
const requireActiveSupplier = require('../src/domains/procurement/supplier-portal.middleware');
const PurchaseOrder = require('../src/models/purchase/PurchaseOrder');
const PurchaseVendor = require('../src/models/purchase/PurchaseVendor');
const PurchaseBill = require('../src/models/purchase/PurchaseBill');
const path = require('path');
const fs = require('fs/promises');

test('supplier order lists and details are scoped to the authenticated supplier', async (t) => {
  const originalFind = PurchaseOrder.find;
  const originalFindOne = PurchaseOrder.findOne;
  const originalCountDocuments = PurchaseOrder.countDocuments;
  t.after(() => {
    PurchaseOrder.find = originalFind;
    PurchaseOrder.findOne = originalFindOne;
    PurchaseOrder.countDocuments = originalCountDocuments;
  });

  let listFilter;
  PurchaseOrder.find = (filter) => {
    listFilter = filter;
    return {
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      async lean() { return [{ _id: 'order-a' }]; },
    };
  };
  PurchaseOrder.countDocuments = async (filter) => {
    assert.deepEqual(filter, listFilter);
    return 1;
  };

  const result = await supplierPortal.getOrders('supplier-a', { page: '2', limit: '5' });
  assert.deepEqual(listFilter, {
    purchaseVendorId: 'supplier-a',
    status: { $ne: 'draft' },
  });
  assert.deepEqual(result.data, [{ _id: 'order-a' }]);
  assert.equal(result.page, 2);

  let detailFilter;
  PurchaseOrder.findOne = (filter) => {
    detailFilter = filter;
    return { async lean() { return null; } };
  };
  await assert.rejects(supplierPortal.getOrder('supplier-a', 'order-b'), (error) => {
    assert.equal(error.statusCode, 404);
    return true;
  });
  assert.deepEqual(detailFilter, {
    _id: 'order-b',
    purchaseVendorId: 'supplier-a',
    status: { $ne: 'draft' },
  });
});

test('supplier portal access requires an approved, enabled supplier account', async (t) => {
  const originalFindOne = PurchaseVendor.findOne;
  t.after(() => { PurchaseVendor.findOne = originalFindOne; });

  let supplierFilter;
  PurchaseVendor.findOne = (filter) => {
    supplierFilter = filter;
    return {
      select() { return this; },
      async lean() { return null; },
    };
  };

  const request = { user: { id: 'supplier-a' } };
  let nextError;
  await requireActiveSupplier(request, {}, (error) => { nextError = error; });

  assert.deepEqual(supplierFilter, {
    _id: 'supplier-a',
    status: true,
    approvalStatus: 'approved',
    portalStatus: 'enabled',
  });
  assert.equal(nextError.statusCode, 403);
});

test('supplier dashboard returns open order count, outstanding balance, and latest payment', async (t) => {
  const PurchasePayment = require('../src/models/purchase/PurchasePayment');
  const originals = {
    findOrders: PurchaseOrder.find,
    countOrders: PurchaseOrder.countDocuments,
    findBills: PurchaseBill.find,
    aggregateBills: PurchaseBill.aggregate,
    findPayment: PurchasePayment.findOne,
  };
  t.after(() => {
    PurchaseOrder.find = originals.findOrders;
    PurchaseOrder.countDocuments = originals.countOrders;
    PurchaseBill.find = originals.findBills;
    PurchaseBill.aggregate = originals.aggregateBills;
    PurchasePayment.findOne = originals.findPayment;
  });

  const supplierId = '507f1f77bcf86cd799439011';
  const orderFilter = { purchaseVendorId: supplierId, status: { $in: ['open', 'partially_billed'] } };
  let billAggregate;
  PurchaseOrder.find = (filter) => {
    assert.deepEqual(filter, orderFilter);
    return { sort() { return this; }, limit() { return this; }, async lean() { return []; } };
  };
  PurchaseOrder.countDocuments = async (filter) => {
    assert.deepEqual(filter, orderFilter);
    return 2;
  };
  PurchaseBill.find = () => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    async lean() { return []; },
  });
  PurchaseBill.aggregate = async (pipeline) => {
    billAggregate = pipeline;
    return [{ balance: 125.5 }];
  };
  PurchasePayment.findOne = () => ({
    sort(sort) {
      assert.deepEqual(sort, { paymentDate: -1, _id: -1 });
      return this;
    },
    async lean() { return { amount: 25 }; },
  });

  const result = await supplierPortal.getDashboard(supplierId);
  assert.equal(result.openPoCount, 2);
  assert.equal(result.openBillsBalance, 125.5);
  assert.deepEqual(result.lastPayment, { amount: 25 });
  assert.deepEqual(billAggregate[0].$match.status, { $in: ['open', 'partially_paid'] });
});

test('supplier invoice upload stores a validated file and scopes download to its owner', async (t) => {
  const originalFindOne = PurchaseBill.findOne;
  t.after(() => { PurchaseBill.findOne = originalFindOne; });

  const supplierId = '507f1f77bcf86cd799439011';
  const billId = '507f1f77bcf86cd799439012';
  const bill = {
    vendorInvoicePath: undefined,
    async save() {},
  };
  PurchaseBill.findOne = async (filter) => {
    assert.deepEqual(filter, { _id: billId, purchaseVendorId: supplierId });
    return bill;
  };

  const file = {
    originalname: '../../invoice.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\ninvoice'),
  };
  const uploaded = await supplierPortal.uploadInvoice(supplierId, billId, file);
  t.after(async () => {
    await fs.unlink(path.resolve(__dirname, '../storage/supplier-registration/supplier-invoices', bill.vendorInvoicePath)).catch(() => {});
  });

  assert.equal(uploaded.originalName, 'invoice.pdf');
  assert.match(bill.vendorInvoicePath, /^[a-f\d-]+\.pdf$/i);
  assert.equal(bill.vendorInvoiceMimeType, 'application/pdf');
  assert.deepEqual(
    await fs.readFile(path.resolve(__dirname, '../storage/supplier-registration/supplier-invoices', bill.vendorInvoicePath)),
    file.buffer,
  );

  PurchaseBill.findOne = (filter) => {
    assert.deepEqual(filter, { _id: billId, purchaseVendorId: supplierId });
    return { select: async () => bill };
  };
  const attachment = await supplierPortal.getInvoiceAttachment(supplierId, billId);
  assert.equal(attachment.originalName, 'invoice.pdf');
  assert.equal(attachment.mimeType, 'application/pdf');

  await assert.rejects(
    supplierPortal.uploadInvoice(supplierId, billId, { ...file, buffer: Buffer.from('not a pdf') }),
    (error) => error.statusCode === 400,
  );
});

test('supplier PO templates and uploads preserve the Laravel quantity columns and ownership scope', async (t) => {
  const originalFindOne = PurchaseOrder.findOne;
  t.after(() => { PurchaseOrder.findOne = originalFindOne; });

  const supplierId = '507f1f77bcf86cd799439011';
  const orderId = '507f1f77bcf86cd799439012';
  const itemId = '507f1f77bcf86cd799439013';
  const order = {
    poNumber: 'PO/2026-7',
    items: [{ _id: itemId, itemName: 'Steel, Spoon', qty: 8, qtyBilled: 3 }],
  };
  let filter;
  PurchaseOrder.findOne = (query) => {
    filter = query;
    return { async lean() { return order; } };
  };

  const template = await supplierPortal.downloadOrderProcessTemplate(supplierId, orderId, 'csv');
  assert.deepEqual(filter, {
    _id: orderId,
    purchaseVendorId: supplierId,
    status: { $ne: 'draft' },
  });
  assert.equal(template.filename, 'PO-2026-7-process-template.csv');
  assert.match(template.content.toString('utf8'), /^\uFEFF"item_id","item_name","ordered","remaining","processing_now"/);
  assert.match(template.content.toString('utf8'), /"Steel, Spoon","8","5","0"/);

  const quantities = await supplierPortal.parseOrderProcessUpload(supplierId, orderId, {
    originalname: 'processing.csv',
    buffer: Buffer.from(`item_id,item_name,processing_now\r\n${itemId},,4\r\n`),
  });
  assert.deepEqual(filter, {
    _id: orderId,
    purchaseVendorId: supplierId,
    status: { $in: ['open', 'partially_billed'] },
  });
  assert.deepEqual(quantities, { [itemId]: 4 });

  await assert.rejects(
    supplierPortal.parseOrderProcessUpload(supplierId, orderId, {
      originalname: 'processing.csv',
      buffer: Buffer.from(`item_id,processing_now\r\n${itemId},6\r\n`),
    }),
    (error) => error.statusCode === 400 && /exceeds the remaining quantity/.test(error.message),
  );
});

test('supplier PO processing delegates to transactional bill creation with supplier scope', async (t) => {
  const purchaseBillsService = require('../src/domains/procurement/purchase-bills.service');
  const originalCreate = purchaseBillsService.createFromPurchaseOrder;
  t.after(() => { purchaseBillsService.createFromPurchaseOrder = originalCreate; });

  let call;
  purchaseBillsService.createFromPurchaseOrder = async (...args) => {
    call = args;
    return { billNumber: 14 };
  };
  const quantities = { '507f1f77bcf86cd799439013': 2 };
  const result = await supplierPortal.processOrder(
    '507f1f77bcf86cd799439011',
    '507f1f77bcf86cd799439012',
    quantities,
  );

  assert.deepEqual(result, { billNumber: 14 });
  assert.deepEqual(call, [
    '507f1f77bcf86cd799439012',
    { quantities },
    { supplierId: '507f1f77bcf86cd799439011', fromVendorPortal: true },
  ]);
});

test('supplier PO challan is generated as a PDF from the supplier-owned order', async (t) => {
  const BusinessSetting = require('../src/models/store/BusinessSetting');
  const originals = { findOrder: PurchaseOrder.findOne, findSettings: BusinessSetting.find };
  t.after(() => {
    PurchaseOrder.findOne = originals.findOrder;
    BusinessSetting.find = originals.findSettings;
  });

  const supplierId = '507f1f77bcf86cd799439011';
  const orderId = '507f1f77bcf86cd799439012';
  let orderFilter;
  PurchaseOrder.findOne = (filter) => {
    orderFilter = filter;
    return {
      populate() { return this; },
      lean: async () => ({
        poNumber: 'PO-10',
        poDate: '2026-11-18T00:00:00.000Z',
        purchaseVendorId: { displayName: 'Supplier', addresses: [] },
        warehouseId: { name: 'Main warehouse' },
        items: [{ itemName: 'Item one', qty: 3, unit: 'pcs' }],
      }),
    };
  };
  BusinessSetting.find = () => ({ lean: async () => [{ key: 'app_name', value: 'BringBasket' }] });

  const file = await supplierPortal.createOrderChallan(supplierId, orderId);
  assert.deepEqual(orderFilter, {
    _id: orderId,
    purchaseVendorId: supplierId,
    status: { $ne: 'draft' },
  });
  assert.equal(file.filename, 'challan-PO-10.pdf');
  assert.equal(file.content.subarray(0, 5).toString(), '%PDF-');
});

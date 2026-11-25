const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const procurementRoutes = require('../src/routes/v1/procurement');
const purchaseVendorsService = require('../src/domains/procurement/purchase-vendors.service');
const purchaseBillsService = require('../src/domains/procurement/purchase-bills.service');
const purchasePaymentsService = require('../src/domains/procurement/purchase-payments.service');
const purchaseReturnsService = require('../src/domains/procurement/purchase-returns.service');
const PurchaseReturn = require('../src/models/purchase/PurchaseReturn');
const PurchaseOrder = require('../src/models/purchase/PurchaseOrder');
const PurchaseBill = require('../src/models/purchase/PurchaseBill');
const Sequence = require('../src/models/purchase/Sequence');
const WarehouseItemBatch = require('../src/models/warehouse/WarehouseItemBatch');
const { adminAuth } = require('../src/middleware/auth');

const routeEntries = (router) => router.stack
  .filter((layer) => layer.route)
  .map(({ route }) => [Object.keys(route.methods)[0].toUpperCase(), route.path]);

test('procurement endpoints are admin-authenticated under the purchases route group', () => {
  assert.deepEqual(routeEntries(procurementRoutes), [
    ['GET', '/purchases/vendors'],
    ['GET', '/purchases/vendors/:id'],
    ['POST', '/purchases/vendors'],
    ['PUT', '/purchases/vendors/:id'],
    ['PATCH', '/purchases/vendors/:id/status'],
    ['PATCH', '/purchases/vendors/:id/approval'],
    ['DELETE', '/purchases/vendors/:id'],
    ['GET', '/purchases/vendors/:vendorId/products'],
    ['POST', '/purchases/vendors/:vendorId/products'],
    ['GET', '/purchases/vendors/:vendorId/products/:id'],
    ['PUT', '/purchases/vendors/:vendorId/products/:id'],
    ['PATCH', '/purchases/vendors/:vendorId/products/:id/toggle'],
    ['DELETE', '/purchases/vendors/:vendorId/products/:id'],
    ['GET', '/supplier/products'],
    ['POST', '/supplier/products'],
    ['GET', '/supplier/products/:id'],
    ['PUT', '/supplier/products/:id'],
    ['PATCH', '/supplier/products/:id/toggle'],
    ['DELETE', '/supplier/products/:id'],
    ['GET', '/purchases/orders'],
    ['GET', '/purchases/orders/:id'],
    ['POST', '/purchases/orders'],
    ['PUT', '/purchases/orders/:id'],
    ['POST', '/purchases/orders/:id/issue'],
    ['POST', '/purchases/orders/:id/cancel'],
    ['POST', '/purchases/orders/:id/convert-to-bill'],
    ['GET', '/purchases/bills'],
    ['GET', '/purchases/bills/:id'],
    ['PUT', '/purchases/bills/:id'],
    ['POST', '/purchases/bills/:id/void'],
    ['GET', '/purchases/bills/:id/grn-invoice'],
    ['POST', '/purchases/bills/:id/mark-stock-received'],
    ['GET', '/purchases/payments'],
    ['POST', '/purchases/payments'],
    ['DELETE', '/purchases/payments/:id'],
    ['GET', '/purchases/returns'],
    ['GET', '/purchases/returns/bills'],
    ['GET', '/purchases/returns/bills/:id/items'],
    ['GET', '/purchases/returns/bills/:id/template.csv'],
    ['GET', '/purchases/returns/export.csv'],
    ['POST', '/purchases/returns/import'],
    ['POST', '/purchases/returns'],
    ['GET', '/purchases/returns/:id'],
    ['POST', '/purchases/returns/:id/approve'],
    ['POST', '/purchases/returns/:id/void'],
  ]);
  for (const layer of procurementRoutes.stack.filter((entry) => entry.route)) {
    if (layer.route.path.startsWith('/supplier/')) continue; // supplier routes use supplierAuth
    assert.equal(layer.route.stack[0].handle, adminAuth, `${layer.route.path} must require admin authentication`);
  }
});

test('purchase return APIs validate status, required vendor, and CSV input', async () => {
  await assert.rejects(
    purchaseReturnsService.getAll({ status: 'pending' }),
    { message: 'status must be one of: draft, completed, void, cancelled' },
  );
  await assert.rejects(
    purchaseReturnsService.create({ items: [] }),
    { message: 'purchaseVendorId is required' },
  );
  await assert.rejects(
    purchaseReturnsService.importCsv('507f1f77bcf86cd799439011', ''),
    { message: 'CSV must include a header and at least one item' },
  );
  assert.deepEqual(
    purchaseReturnsService.parseCsv('item_name,returned_qty\r\n"Soap, 100g",2\r\n"Bar ""A""",1'),
    [['item_name', 'returned_qty'], ['Soap, 100g', '2'], ['Bar "A"', '1']],
  );
  assert.ok(PurchaseReturn.schema.path('status').enumValues.includes('void'));
  assert.ok(PurchaseReturn.schema.path('reason').enumValues.includes('defective'));
});

test('purchase vendor create validates the required Laravel profile fields', async () => {
  await assert.rejects(
    purchaseVendorsService.create({ displayName: '   ', state: 'Delhi' }),
    { message: 'displayName is required' },
  );
  await assert.rejects(
    purchaseVendorsService.create({ displayName: 'Vendor' }),
    { message: 'state is required' },
  );
});

test('purchase vendor approval rejects unsupported decisions', async () => {
  await assert.rejects(
    purchaseVendorsService.updateApproval('507f1f77bcf86cd799439011', 'pending'),
    { message: 'approvalStatus must be approved or rejected' },
  );
});

test('supplier PO conversion checks owner in the transaction and records vendor processing metadata', async (t) => {
  const originals = {
    startSession: mongoose.startSession,
    findOrder: PurchaseOrder.findById,
    sequenceExists: Sequence.exists,
    nextSequence: Sequence.findOneAndUpdate,
    createBill: PurchaseBill.create,
  };
  t.after(() => {
    mongoose.startSession = originals.startSession;
    PurchaseOrder.findById = originals.findOrder;
    Sequence.exists = originals.sequenceExists;
    Sequence.findOneAndUpdate = originals.nextSequence;
    PurchaseBill.create = originals.createBill;
  });

  const orderId = new mongoose.Types.ObjectId();
  const supplierId = new mongoose.Types.ObjectId();
  const itemId = new mongoose.Types.ObjectId();
  const orderItem = {
    _id: itemId,
    itemId: new mongoose.Types.ObjectId(),
    itemName: 'Apples',
    qty: 5,
    qtyBilled: 1,
    rate: 10,
    taxPercent: 0,
    unit: 'kg',
  };
  const order = {
    _id: orderId,
    purchaseVendorId: supplierId,
    poNumber: 'PO-10',
    status: 'open',
    taxType: 'igst',
    items: [orderItem],
    async save() {},
  };
  order.items.id = (id) => order.items.find((item) => String(item._id) === String(id));
  let billInput;
  let sessionsEnded = 0;
  mongoose.startSession = async () => ({
    withTransaction: async (operation) => operation(),
    endSession: async () => { sessionsEnded += 1; },
  });
  PurchaseOrder.findById = (id) => {
    assert.equal(String(id), String(orderId));
    return { session: async () => order };
  };
  Sequence.exists = () => ({ session: async () => true });
  Sequence.findOneAndUpdate = async () => ({ value: 41 });
  PurchaseBill.create = async (documents) => {
    billInput = documents[0];
    return [{ _id: new mongoose.Types.ObjectId(), ...documents[0] }];
  };

  const bill = await purchaseBillsService.createFromPurchaseOrder(
    String(orderId),
    { quantities: { [String(itemId)]: 2 } },
    { supplierId: String(supplierId), fromVendorPortal: true },
  );
  assert.equal(bill.billNumber, 41);
  assert.equal(billInput.stockReceived, false);
  assert.equal(billInput.fromVendorPortal, true);
  assert.equal(billInput.adminNotificationSeen, false);
  assert.equal(billInput.items[0].qty, 2);
  assert.equal(orderItem.qtyBilled, 3);
  assert.equal(order.status, 'partially_billed');
  assert.ok(order.vendorLastProcessedAt instanceof Date);
  assert.equal(sessionsEnded, 1);

  PurchaseOrder.findById = () => ({
    session: async () => ({ ...order, purchaseVendorId: new mongoose.Types.ObjectId() }),
  });
  await assert.rejects(
    purchaseBillsService.createFromPurchaseOrder(
      String(orderId),
      { quantities: { [String(itemId)]: 1 } },
      { supplierId: String(supplierId), fromVendorPortal: true },
    ),
    (error) => error.statusCode === 404,
  );
});

test('purchase order routes require admin authentication', () => {
  for (const layer of procurementRoutes.stack.filter((entry) => entry.route)) {
    if (layer.route.path.startsWith('/supplier/')) continue;
    assert.equal(layer.route.stack[0].handle, adminAuth, `${layer.route.path} must require admin authentication`);
  }
});

test('purchase order APIs validate line items and filter values before database access', async () => {
  const purchaseOrdersService = require('../src/domains/procurement/purchase-orders.service');

  await assert.rejects(
    purchaseOrdersService.create({ items: [] }),
    { message: 'At least one purchase order item is required' },
  );
  await assert.rejects(
    purchaseOrdersService.create({
      purchaseVendorId: '507f1f77bcf86cd799439011',
      warehouseId: '507f1f77bcf86cd799439012',
      items: [{ itemName: 'Apples', qty: 0, rate: 10 }],
    }),
    { message: 'items[0].qty must be a positive number' },
  );
  await assert.rejects(
    purchaseOrdersService.getAll({ status: 'unknown' }),
    { message: 'Invalid purchase order status' },
  );
});

test('purchase order conversion bills remaining quantity and calculates tax and free stock', () => {
  const order = new PurchaseOrder({
    items: [{
      itemName: 'Apples',
      qty: 10,
      qtyBilled: 3,
      rate: 10,
      taxPercent: 18,
      schemeBuyQty: 2,
      schemeGetQty: 1,
      conversionFactor: 2,
    }],
  });
  const [billItem] = purchaseBillsService.buildBillItems(order);
  const totals = purchaseBillsService.calculateTotals([billItem]);

  assert.equal(billItem.qty, 7);
  assert.equal(billItem.freeQty, 3);
  assert.equal(billItem.billedQty, 10);
  assert.equal(billItem.baseQty, 20);
  assert.equal(billItem.qtyReceived, 0);
  assert.deepEqual(totals, { subTotal: 70, taxTotal: 12.6, total: 82.6 });
});

test('purchase bill conversion rejects quantities above the remaining PO quantity', () => {
  const order = new PurchaseOrder({
    items: [{
      itemName: 'Apples',
      qty: 5,
      qtyBilled: 2,
      rate: 10,
    }],
  });
  const orderItemId = order.items[0]._id;
  assert.throws(
    () => purchaseBillsService.buildBillItems(order, [{
      purchaseOrderItemId: String(orderItemId),
      qty: 4,
    }]),
    { message: 'items[0].qty exceeds the unbilled quantity (3)' },
  );
});

test('GRN accepts short receipts but rejects quantities exceeding the bill', () => {
  const billItemId = '507f1f77bcf86cd799439011';
  const bill = { items: [{ _id: billItemId, itemName: 'Apples', qty: 5, freeQty: 1 }] };
  const [shortReceipt] = purchaseBillsService.normalizeReceiptItems(bill, [{
    billItemId,
    qtyReceived: 4,
  }]);

  assert.equal(shortReceipt.qtyReceived, 4);
  assert.throws(
    () => purchaseBillsService.normalizeReceiptItems(bill, [{
      billItemId,
      qtyReceived: 6.1,
    }]),
    { message: 'GRN quantity exceeds billed quantity for Apples' },
  );
  assert.throws(
    () => purchaseBillsService.normalizeReceiptItems(bill, []),
    { message: 'GRN items must include every purchase bill item' },
  );
  const [unreceivedLine] = purchaseBillsService.normalizeReceiptItems(bill, [{
    billItemId,
    qtyReceived: 0,
  }]);
  assert.equal(unreceivedLine.qtyReceived, 0);
});

test('warehouse GRN batch model uses the canonical warehouse batch collection and item reference', () => {
  assert.equal(WarehouseItemBatch.collection.collectionName, 'warehouseitembatches');
  assert.equal(WarehouseItemBatch.schema.path('itemId').options.ref, 'Item');
});

test('purchase bill and GRN APIs reject invalid IDs before database access', async () => {
  await assert.rejects(
    purchaseBillsService.createFromPurchaseOrder('invalid', {}),
    { message: 'Invalid purchase order ID' },
  );
  await assert.rejects(
    purchaseBillsService.receiveStock('invalid', {}),
    { message: 'Invalid purchase bill ID' },
  );
  await assert.rejects(
    purchaseBillsService.updateBill('invalid', { notes: 'Updated' }),
    { message: 'Invalid purchase bill ID' },
  );
  await assert.rejects(
    purchaseBillsService.voidBill('invalid'),
    { message: 'Invalid purchase bill ID' },
  );
  await assert.rejects(
    purchaseBillsService.getInvoiceFile('invalid'),
    { message: 'Invalid purchase bill ID' },
  );
});

test('purchase payment input validates vendor or bill, amount, date, and mode', () => {
  const vendorId = '507f1f77bcf86cd799439011';
  const billId = '507f1f77bcf86cd799439012';
  const payment = purchasePaymentsService.normalizePayment({
    purchaseVendorId: vendorId,
    purchaseBillId: billId,
    paymentDate: '2026-11-03',
    amount: '125.50',
    mode: 'upi',
    reference: '  UPI-123  ',
  });
  assert.equal(payment.purchaseVendorId, vendorId);
  assert.equal(payment.purchaseBillId, billId);
  assert.equal(payment.amount, 125.5);
  assert.equal(payment.reference, 'UPI-123');

  assert.throws(
    () => purchasePaymentsService.normalizePayment({ paymentDate: '2026-11-03', amount: 10 }),
    { message: 'purchaseVendorId is required for an unallocated payment' },
  );
  assert.throws(
    () => purchasePaymentsService.normalizePayment(null),
    { message: 'Payment details must be an object' },
  );
  assert.throws(
    () => purchasePaymentsService.normalizePayment({
      purchaseVendorId: vendorId,
      paymentDate: '2026-11-03',
      amount: 0,
    }),
    { message: 'amount must be a positive number with at most two decimal places' },
  );
  assert.throws(
    () => purchasePaymentsService.normalizePayment({
      purchaseVendorId: vendorId,
      paymentDate: 'invalid',
      amount: 10,
    }),
    { message: 'paymentDate must be a valid date' },
  );
  assert.throws(
    () => purchasePaymentsService.normalizePayment({
      purchaseVendorId: vendorId,
      paymentDate: '2026-11-03',
      amount: 10,
      mode: 'crypto',
    }),
    { message: 'mode must be one of: bank_transfer, cash, upi, cheque, other' },
  );
});

test('purchase payment filters reject invalid IDs and date ranges before database access', async () => {
  await assert.rejects(
    purchasePaymentsService.getAll({ purchaseVendorId: 'invalid' }),
    { message: 'Invalid purchase vendor ID' },
  );
  await assert.rejects(
    purchasePaymentsService.getAll({ purchaseBillId: 'invalid' }),
    { message: 'Invalid purchase bill ID' },
  );
  await assert.rejects(
    purchasePaymentsService.getAll({ from: 'not-a-date' }),
    { message: 'from must be a valid date' },
  );
  await assert.rejects(
    purchasePaymentsService.getAll({ from: '2026-11-04', to: '2026-11-03' }),
    { message: 'from must be on or before to' },
  );
});

test('payment settlement recalculates partial, paid, and return-adjusted balances', () => {
  assert.deepEqual(
    purchasePaymentsService.calculateSettlement(100, 25, 0),
    { amountPaid: 25, balanceDue: 75, status: 'partially_paid' },
  );
  assert.deepEqual(
    purchasePaymentsService.calculateSettlement(100, 90, 10),
    { amountPaid: 90, balanceDue: 0, status: 'paid' },
  );
  assert.deepEqual(
    purchasePaymentsService.calculateSettlement(100, 0, 0),
    { amountPaid: 0, balanceDue: 100, status: 'open' },
  );
});

test('bill metadata updates reject invalid dates and unsupported fields before database access', async () => {
  const billId = '507f1f77bcf86cd799439011';
  await assert.rejects(
    purchaseBillsService.updateBill(billId, { billDate: 'not-a-date' }),
    { message: 'billDate must be a valid date' },
  );
  await assert.rejects(
    purchaseBillsService.updateBill(billId, { notes: 'x'.repeat(2001) }),
    { message: 'notes cannot exceed 2000 characters' },
  );
  await assert.rejects(
    purchaseBillsService.updateBill(billId, { items: [] }),
    { message: 'No valid fields to update' },
  );
  await assert.rejects(
    purchaseBillsService.updateBill(billId, { taxType: 'cgst_sgst' }),
    { message: 'No valid fields to update' },
  );
});

test('GRN invoice validation checks the MIME type, extension, and file signature', () => {
  assert.deepEqual(
    purchaseBillsService.validateInvoiceFile({
      mimetype: 'application/pdf',
      originalname: 'invoice.pdf',
      buffer: Buffer.from('%PDF-1.7'),
    }),
    { extension: '.pdf', mimeType: 'application/pdf' },
  );
  assert.throws(
    () => purchaseBillsService.validateInvoiceFile({
      mimetype: 'application/pdf',
      originalname: 'invoice.pdf',
      buffer: Buffer.from('not a PDF'),
    }),
    { message: 'Invoice file contents do not match its file type' },
  );
  assert.throws(
    () => purchaseBillsService.validateInvoiceFile({
      mimetype: 'text/plain',
      originalname: 'invoice.txt',
      buffer: Buffer.from('invoice'),
    }),
    { message: 'Invoice must be a PDF, JPEG, PNG, or WebP file' },
  );
});

test('local GRN invoice downloads are disabled in production', async () => {
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await assert.rejects(
      purchaseBillsService.getInvoiceFile('507f1f77bcf86cd799439011'),
      { message: 'Local GRN invoice storage is development-only; configure private object storage before production' },
    );
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});

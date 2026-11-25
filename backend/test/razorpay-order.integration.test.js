const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac, randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const controller = require('../src/domains/store/razorpay.controller');
const { orderModel } = require('../src/domains/orders/order-data');
const Payment = require('../src/models/store/Payment');

async function invoke(handler, request) {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler(request, response, (error) => { throw error; });
  return response;
}

test('Razorpay checkout charges the canonical order total and updates that order on capture', {
  skip: !process.env.ORDER_INTEGRATION_MONGO_URI,
}, async (t) => {
  const suffix = randomUUID().replaceAll('-', '');
  const paymentsDb = `bb_rzp_payment_it_${suffix}`;
  const ordersDb = `bb_rzp_order_it_${suffix}`;
  const uri = new URL(process.env.ORDER_INTEGRATION_MONGO_URI);
  uri.pathname = `/${paymentsDb}`;
  const env = { ORDER_DATABASE: ordersDb, RAZORPAY_KEY_ID: 'rzp_test_fixture', RAZORPAY_KEY_SECRET: 'fixture-secret' };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  await mongoose.connect(uri.toString());
  const Orders = orderModel();
  t.after(async () => {
    if (Orders.db.name === ordersDb) await Orders.db.dropDatabase();
    if (mongoose.connection.name === paymentsDb) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([Orders.init(), Payment.init()]);
  const user = { id: String(new mongoose.Types.ObjectId()) };
  const order = await Orders.create({
    ownerId: user.id, isGuest: false, orderNumber: 'RZP-INTEGRATION',
    storeId: String(new mongoose.Types.ObjectId()), storeName: 'Payment fixture', moduleId: String(new mongoose.Types.ObjectId()),
    orderType: 'take_away', orderStatus: 'pending', paymentMethod: 'digital_payment', paymentStatus: 'unpaid',
    items: [], itemSubtotal: 125.5, taxAmount: 0, deliveryCharge: 0, orderAmount: 125.5,
  });
  const providerOrders = [];
  let capturedAmount = 100;
  t.mock.method(Razorpay.prototype, 'addResources', function () {
    this.orders = { create: async (data) => { providerOrders.push(data); return { id: 'order_fixture', ...data }; } };
    this.payments = { fetch: async () => ({ order_id: 'order_fixture', status: 'captured', amount: capturedAmount, currency: 'INR' }) };
  });
  const canceledOrder = await Orders.create({
    ...order.toObject(), _id: new mongoose.Types.ObjectId(), orderNumber: 'RZP-CANCELED', orderStatus: 'canceled',
  });
  const canceled = await invoke(controller.createOrder, { user, body: { purpose: 'order', order_id: String(canceledOrder._id) } });
  assert.equal(canceled.statusCode, 409);
  assert.match(canceled.body.message, /order was canceled/i);
  assert.equal(providerOrders.length, 0);

  const created = await invoke(controller.createOrder, { user, body: { purpose: 'order', order_id: String(order._id), amount: 1 } });
  assert.equal(created.statusCode, 201);
  assert.equal(providerOrders[0].amount, 12550);
  assert.equal((await Payment.findById(created.body.data.payment_id)).amount, 125.5);

  const body = {
    razorpay_order_id: 'order_fixture', razorpay_payment_id: 'pay_fixture',
    razorpay_signature: createHmac('sha256', env.RAZORPAY_KEY_SECRET).update('order_fixture|pay_fixture').digest('hex'),
  };
  const mismatchedCapture = await invoke(controller.verify, { user, body });
  assert.equal(mismatchedCapture.statusCode, 400);
  assert.equal((await Orders.findById(order._id)).paymentStatus, 'unpaid');

  capturedAmount = 12550;
  const verified = await invoke(controller.verify, { user, body });
  assert.equal(verified.statusCode, 200);
  assert.equal((await Orders.findById(order._id)).paymentStatus, 'paid');
  assert.equal((await Payment.findById(created.body.data.payment_id)).status, 'paid');
  assert.equal((await invoke(controller.verify, { user, body })).body.data.already_paid, true);
});

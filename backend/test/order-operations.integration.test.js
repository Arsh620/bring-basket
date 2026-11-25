const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const Order = require('../src/domains/orders/order.model');
const orderService = require('../src/domains/orders/order.service');
const { operationsModel } = require('../src/domains/orders/order-data');
const UserModel = require('../src/models/auth/User');
const WalletModel = require('../src/models/auth/WalletTransaction');
const DriverModel = require('../src/models/auth/DeliveryMan');
const DriverLedgerModel = require('../src/models/auth/DMWalletTransaction');
const StoreModel = require('../src/models/store/Store');

test('dispatch and wallet refunds share committed order and ledger state across databases', {
  skip: !process.env.ORDER_INTEGRATION_MONGO_URI,
}, async (t) => {
  const suffix = randomUUID().replaceAll('-', '');
  const uri = new URL(process.env.ORDER_INTEGRATION_MONGO_URI);
  const ordersDb = `bb_orders_ops_it_${suffix}`;
  const identityDb = `bb_identity_ops_it_${suffix}`;
  uri.pathname = `/${ordersDb}`;
  process.env.ORDER_OPERATIONS_DATABASE = identityDb;
  await mongoose.connect(uri.toString());
  const operations = mongoose.connection.useDb(identityDb, { useCache: true });
  t.after(async () => {
    if (operations.name === identityDb) await operations.dropDatabase();
    if (mongoose.connection.name === ordersDb) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  const User = operationsModel(UserModel);
  const Wallet = operationsModel(WalletModel);
  const Driver = operationsModel(DriverModel);
  const DriverLedger = operationsModel(DriverLedgerModel);
  const Store = operationsModel(StoreModel);
  await Promise.all([Order.init(), Wallet.init(), DriverLedger.init()]);
  const zoneId = new mongoose.Types.ObjectId();
  const otherZone = new mongoose.Types.ObjectId();
  const moduleId = new mongoose.Types.ObjectId();
  const store = await Store.create({ name: 'Integration store', zoneId, moduleId, phone: '9000000010', vendorId: new mongoose.Types.ObjectId() });
  const [driver, otherDriver] = await Driver.create([
    { fName: 'Dispatch driver', phone: '9000000011', password: 'TestPass1', zoneId },
    { fName: 'Other driver', phone: '9000000012', password: 'TestPass1', zoneId: otherZone },
  ]);
  const user = await User.create({ fName: 'Wallet customer', phone: '9000000013', walletBalance: 20 });
  const order = await Order.create({
    ownerId: String(user._id), isGuest: false, orderNumber: 'IT-WALLET-1',
    storeId: String(store._id), storeName: store.name, moduleId: String(moduleId), zoneId: String(zoneId),
    orderType: 'delivery', orderStatus: 'pending', paymentMethod: 'wallet', paymentStatus: 'paid',
    items: [], itemSubtotal: 100, taxAmount: 0, deliveryCharge: 10, dmTips: 5, orderAmount: 115,
  });
  await Wallet.create({
    userId: user._id, reference: String(order._id), type: 'debit', referenceType: 'order', amount: 115, balance: 20,
  });
  const id = String(order._id);
  const scope = { zoneId: String(zoneId) };
  const queue = await orderService.listAdminOrders({ queue: 'unassigned' }, scope);
  assert.equal(queue.total_size, 1);
  assert.deepEqual((await orderService.listDeliveryCandidates(id, scope)).map(({ _id }) => String(_id)), [String(driver._id)]);
  await assert.rejects(orderService.assignDeliveryman(id, String(otherDriver._id), scope), { statusCode: 409 });
  await assert.rejects(orderService.getAdminOrder(id, { zoneId: String(otherZone) }), { statusCode: 404 });
  await orderService.assignDeliveryman(id, String(driver._id), scope);
  assert.equal((await Order.findById(id)).orderStatus, 'accepted');
  assert.equal((await orderService.listAdminOrders({ queue: 'unassigned' }, scope)).total_size, 0);
  assert.equal((await Driver.findById(driver._id)).currentOrders, 1);
  for (const status of ['processing', 'handover', 'picked_up', 'delivered']) {
    await orderService.adminUpdateOrderStatus(id, { status }, undefined, String(driver._id));
  }
  await assert.rejects(orderService.adminUpdateOrderStatus(id, { status: 'delivered' }, scope), { statusCode: 409 });
  assert.equal(await DriverLedger.countDocuments({ orderId: order._id }), 1);
  assert.equal((await Driver.findById(driver._id)).currentOrders, 0);

  const actor = { ownerId: String(user._id), isGuest: false };
  const requested = await orderService.requestRefund(actor, id, 'Damaged item');
  assert.equal(requested.refundAmount, 100);
  await assert.rejects(orderService.requestRefund(actor, id, 'Duplicate request'), { statusCode: 409 });
  await assert.rejects(orderService.adminHandleRefund(id, 'approved', '', { zoneId: String(otherZone) }), { statusCode: 404 });
  const concurrent = await Promise.allSettled([
    orderService.adminHandleRefund(id, 'approved', 'Verified', scope),
    orderService.adminHandleRefund(id, 'approved', 'Verified', scope),
  ]);
  assert.equal(concurrent.filter(({ status }) => status === 'fulfilled').length, 1);
  const ledger = await Wallet.find({ type: 'credit', reference: id });
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].amount, 100);
  assert.equal((await User.findById(user._id)).walletBalance, 120);
  assert.equal((await Order.findById(id)).refundStatus, 'approved');

  const cash = await Order.create({
    ...order.toObject(), _id: new mongoose.Types.ObjectId(), orderNumber: 'IT-CASH-1',
    orderStatus: 'delivered', paymentMethod: 'cash_on_delivery',
  });
  await orderService.requestRefund(actor, String(cash._id), 'Damaged item');
  await assert.rejects(orderService.adminHandleRefund(String(cash._id), 'approved', '', scope), { statusCode: 409 });
  assert.equal((await Order.findById(cash._id)).refundStatus, 'pending');
});

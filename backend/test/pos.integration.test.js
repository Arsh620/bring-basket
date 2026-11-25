const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const mongoose = require('mongoose');
const legacyOrders = require('../src/models/GeneratedBusinessModels').registeredModels.orders;
const Admin = require('../src/models/auth/Admin');
const AdminRole = require('../src/models/auth/AdminRole');
const Vendor = require('../src/models/auth/Vendor');
const Store = require('../src/models/store/Store');
const Item = require('../src/models/catalog/Item');
const StoreStock = require('../src/domains/inventory/store-item-stock.model');
const { orderModel } = require('../src/domains/orders/order-data');
const { generateToken } = require('../src/middleware/auth');
const posRoutes = require('../src/routes/v1/pos');
const inventoryRoutes = require('../src/routes/v1/inventory');
const errorHandler = require('../src/middleware/errorHandler');
const { normalizeStorefrontCatalog } = require('../scripts/normalizeStorefrontCatalog');

test('Admin and Vendor POS scan, hold, resume, and post cash sales once to the Order database', {
  skip: !process.env.ORDER_INTEGRATION_MONGO_URI,
}, async (t) => {
  const suffix = randomUUID().replaceAll('-', '');
  const operationsDb = `bb_pos_ops_it_${suffix}`;
  const ordersDb = `bb_pos_orders_it_${suffix}`;
  const uri = new URL(process.env.ORDER_INTEGRATION_MONGO_URI);
  uri.pathname = `/${operationsDb}`;
  process.env.ORDER_DATABASE = ordersDb;
  process.env.JWT_SECRET = randomUUID();
  await mongoose.connect(uri.toString());
  const Orders = orderModel();
  t.after(async () => {
    if (Orders.db.name === ordersDb) await Orders.db.dropDatabase();
    if (mongoose.connection.name === operationsDb) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  assert.notEqual(Orders.modelName, legacyOrders.modelName);
  assert.equal(Orders.collection.name, 'orders');
  assert.ok(Orders.schema.path('orderNumber')?.isRequired);
  await Promise.all([Orders.init(), StoreStock.init()]);

  const app = express();
  app.use(express.json());
  app.use('/api/v1', posRoutes);
  app.use('/internal/order-stock', inventoryRoutes.orderServiceAuth, inventoryRoutes.internalRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  process.env.INVENTORY_SERVICE_URL = `http://127.0.0.1:${server.address().port}`;

  const zoneId = new mongoose.Types.ObjectId();
  const moduleId = new mongoose.Types.ObjectId();
  const role = await AdminRole.create({ name: 'POS operator', modules: '["pos"]' });
  const vendor = await Vendor.create({ fName: 'Fixture vendor', phone: '9000000001', email: 'pos-vendor@example.test', password: 'Fixture$123' });
  const admin = await Admin.create({ fName: 'Fixture admin', email: 'pos-admin@example.test', password: 'Fixture$123', roleId: role._id, zoneId });
  const store = await Store.create({ name: 'POS fixture store', phone: '9000000002', zoneId, moduleId, vendorId: vendor._id });
  const other = await Store.create({
    name: 'Other fixture store', phone: '9000000003', zoneId: new mongoose.Types.ObjectId(), moduleId, vendorId: new mongoose.Types.ObjectId(),
  });
  const item = await Item.create({ name: 'Fixture product', legacyId: 11, storeId: store._id, moduleId, barcode: '8900000000001', price: 50, stock: 10 });
  const otherItem = await Item.create({ name: 'Fixture product without options', legacyId: 12, storeId: store._id, moduleId, price: 90, stock: 4 });
  const addOn = await mongoose.connection.db.collection('addons').insertOne({
    legacyId: 42, name: 'Imported gift wrap', price: '5.00', storeId: store._id, status: 1,
  });
  await Item.collection.updateOne({ _id: item._id }, { $set: { addOns: '[42]' } });
  await Item.collection.updateOne({ _id: otherItem._id }, { $set: { addOns: '[]' } });
  const normalized = await mongoose.connection.transaction((session) =>
    normalizeStorefrontCatalog(mongoose.connection.db, { apply: true, session }));
  assert.equal(normalized.documents.items, 2);
  assert.equal((await normalizeStorefrontCatalog(mongoose.connection.db)).documents.items, 0);

  const tokens = { admin: generateToken(admin._id, 'admin'), vendor: generateToken(vendor._id, 'vendor') };
  const request = async (portal, path, { method = 'GET', body, storeId = store._id, session = `pos-test-${portal}` } = {}) => {
    const response = await fetch(`${process.env.INVENTORY_SERVICE_URL}/api/v1/${portal}/pos${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${tokens[portal]}`,
        'Content-Type': 'application/json',
        'X-Pos-Store': String(storeId),
        'X-Pos-Session': session,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json();
    return { status: response.status, ...payload };
  };
  const post = (portal, path, body) => request(portal, path, { method: 'POST', body });
  const money = { paymentMethod: 'cash' };

  await AdminRole.updateOne({ _id: role._id }, { modules: '[]' });
  assert.equal((await request('admin', '/items')).status, 403);
  await AdminRole.updateOne({ _id: role._id }, { modules: '["pos"]' });

  for (const portal of ['admin', 'vendor']) {
    assert.equal((await request(portal, '/items', { storeId: other._id })).status, 403);
    const list = await request(portal, '/items');
    assert.equal(list.status, 200, list.message);
    assert.equal(list.data.items.find(({ _id }) => _id === String(item._id)).addOns[0]._id, String(addOn.insertedId));
    assert.deepEqual(list.data.items.find(({ _id }) => _id === String(otherItem._id)).addOns, []);
    const scan = await request(portal, `/items/scan?code=${item.barcode}`);
    assert.equal(scan.status, 200, scan.message);
    assert.equal(scan.data._id, String(item._id));
    const added = await post(portal, '/cart/items', { itemId: String(item._id), qty: 2 });
    assert.equal(added.status, 200, added.message);
    assert.equal(added.data.totals.grandTotal, 100);
    const held = await post(portal, '/cart/hold', { label: 'Checkout fixture' });
    assert.equal(held.status, 201, held.message);
    assert.equal((await request(portal, '/cart')).data.cart, null);
    const restored = await post(portal, `/cart/held/${held.data._id}/resume`, {});
    assert.equal(restored.status, 200, restored.message);
    assert.equal(restored.data.totals.grandTotal, 100);
    assert.deepEqual((await request(portal, '/cart/held')).data, []);
  }

  const first = await post('admin', '/cart/place-order', money);
  assert.equal(first.status, 201, first.message);
  const vendorResults = await Promise.all([
    post('vendor', '/cart/place-order', money),
    post('vendor', '/cart/place-order', money),
  ]);
  assert.equal(vendorResults.filter((result) => result.status === 201).length, 1, JSON.stringify(vendorResults));
  assert.ok(vendorResults.some((result) => [404, 409].includes(result.status)));

  const completed = await Orders.find({ orderStatus: 'delivered' }).lean();
  assert.equal(completed.length, 2);
  assert.equal(await Orders.countDocuments({ paymentStatus: 'paid' }), 2);
  for (const sale of completed) {
    assert.match(sale.orderNumber, /^POS-/);
    assert.equal(sale.orderType, 'pos');
    assert.equal(sale.paymentStatus, 'paid');
    assert.equal(sale.paymentMethod, 'cash');
    assert.equal(sale.orderAmount, 100);
    assert.equal(sale.zoneId, String(zoneId));
  }
  const quantity = await StoreStock.findOne({ storeId: store._id, itemId: item._id }).lean();
  assert.equal(quantity.qty, 6);
  assert.equal((await Item.findById(item._id)).stock, 6);
  assert.equal((await request('admin', '/cart')).data.cart, null);
  assert.equal((await request('vendor', '/cart')).data.cart, null);
});

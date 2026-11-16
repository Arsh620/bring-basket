const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Order = require('../src/domains/orders/order.model');
const Cart = require('../src/domains/orders/cart.model');
const cartService = require('../src/domains/orders/cart.service');
const orderService = require('../src/domains/orders/order.service');
const inventoryService = require('../src/domains/inventory/order-stock-reservations.service');
const Store = require('../src/models/store/Store');
const Item = require('../src/models/catalog/Item');
const StoreItemStock = require('../src/domains/inventory/store-item-stock.model');
const OrderStockReservation = require('../src/models/warehouse/OrderStockReservation');
const StoreStockMovement = require('../src/models/store/StoreStockMovement');

test('checkout reserves and restores stock across an isolated order lifecycle', {
  skip: !process.env.ORDER_INTEGRATION_MONGO_URI,
}, async () => {
  const uri = new URL(process.env.ORDER_INTEGRATION_MONGO_URI);
  const database = `bring_basket_order_it_${crypto.randomUUID().replace(/-/g, '')}`;
  uri.pathname = `/${database}`;
  const originalFetch = global.fetch;
  let connected = false;

  try {
    process.env.JWT_SECRET = 'isolated-order-integration-test-secret';
    await mongoose.connect(uri.toString());
    connected = true;
    await Promise.all([
      Order.init(),
      Cart.init(),
      Store.init(),
      Item.init(),
      StoreItemStock.init(),
      OrderStockReservation.init(),
      StoreStockMovement.init(),
    ]);

    const storeId = new mongoose.Types.ObjectId();
    const itemId = new mongoose.Types.ObjectId();
    const moduleId = new mongoose.Types.ObjectId();
    await Store.create({
      _id: storeId,
      name: 'Isolated Test Store',
      phone: '9000000001',
      vendorId: new mongoose.Types.ObjectId(),
      moduleId,
      delivery: true,
      takeAway: true,
    });
    await Item.create({
      _id: itemId,
      name: 'Isolated Test Item',
      storeId,
      moduleId,
      price: 100,
      stock: 5,
      status: true,
      isApproved: true,
    });
    await StoreItemStock.create({ storeId, itemId, qty: 5, variant: '' });

    const actor = { ownerId: 'isolated-guest', isGuest: true };
    await Cart.create({
      ownerId: actor.ownerId,
      isGuest: true,
      moduleId: String(moduleId),
      itemId: String(itemId),
      itemType: 'Item',
      price: 1,
      quantity: 2,
      variationKey: '[]',
    });

    const store = {
      _id: String(storeId),
      moduleId: String(moduleId),
      name: 'Isolated Test Store',
      minimumOrder: 0,
      delivery: true,
      takeAway: true,
      freeDelivery: false,
      schedule: [],
      zone: null,
    };
    const item = {
      _id: String(itemId),
      storeId: String(storeId),
      moduleId: String(moduleId),
      name: 'Isolated Test Item',
      price: 100,
      discount: 0,
      discountType: 'percent',
    };

    global.fetch = async (url, options = {}) => {
      const requestUrl = new URL(url);
      if (requestUrl.pathname.includes('/api/v1/customer/stores/')) {
        return { ok: true, status: 200, json: async () => ({ success: true, data: store }) };
      }
      if (requestUrl.pathname.includes('/api/v1/customer/items/')) {
        return { ok: true, status: 200, json: async () => ({ success: true, data: item }) };
      }

      const match = requestUrl.pathname.match(/\/internal\/order-stock\/([a-f\d]{24})\/(reserve|commit|release)$/i);
      if (!match) throw new Error(`Unexpected service request: ${requestUrl.pathname}`);
      const [, orderId, action] = match;
      const body = options.body ? JSON.parse(options.body) : {};
      const data = await inventoryService[action](orderId, body.storeId, body.items);
      return { ok: true, status: 200, json: async () => ({ success: true, data }) };
    };

    await Cart.create([
      {
        ownerId: 'merge-guest',
        isGuest: true,
        moduleId: String(moduleId),
        itemId: String(itemId),
        itemType: 'Item',
        price: 100,
        quantity: 2,
        variationKey: '[]',
      },
      {
        ownerId: 'merge-customer',
        isGuest: false,
        moduleId: String(moduleId),
        itemId: String(itemId),
        itemType: 'Item',
        price: 100,
        quantity: 3,
        variationKey: '[]',
      },
    ]);
    const mergedCart = await cartService.mergeGuest(
      { ownerId: 'merge-customer', isGuest: false },
      String(moduleId),
      'merge-guest',
    );
    assert.equal(mergedCart.length, 1);
    assert.equal(mergedCart[0].quantity, 5);
    assert.equal(await Cart.countDocuments({ ownerId: 'merge-guest', isGuest: true }), 0);

    const body = {
      order_type: 'take_away',
      payment_method: 'cash_on_delivery',
      store_id: String(storeId),
    };
    const order = await orderService.placeOrder(actor, String(moduleId), body, 'isolated-idempotency-001');
    assert.equal(order.orderStatus, 'pending');
    assert.equal(order.orderAmount, 200);
    assert.equal(order.items[0].unitPrice, 100);
    assert.equal(order.stockReserved, true);
    assert.equal(await Cart.countDocuments({ ownerId: actor.ownerId }), 0);
    assert.equal((await StoreItemStock.findOne({ storeId, itemId })).qty, 3);
    assert.equal((await OrderStockReservation.findOne({ orderId: order._id })).status, 'committed');

    const replay = await orderService.placeOrder(actor, String(moduleId), body, 'isolated-idempotency-001');
    assert.equal(String(replay._id), String(order._id));
    assert.equal(await Order.countDocuments({ ownerId: actor.ownerId }), 1);
    assert.equal((await orderService.listOrders(actor)).total_size, 1);
    assert.equal(String((await orderService.getOrder(String(order._id), actor))._id), String(order._id));

    const canceled = await orderService.cancelOrder(actor, {
      order_id: String(order._id),
      reason: 'integration test cancellation',
    });
    assert.equal(canceled.orderStatus, 'canceled');
    assert.equal((await StoreItemStock.findOne({ storeId, itemId })).qty, 5);
    assert.equal((await OrderStockReservation.findOne({ orderId: order._id })).status, 'released');
    assert.deepEqual(
      (await StoreStockMovement.find({ referenceId: order._id }).sort({ qtyChange: 1 }).lean())
        .map((movement) => movement.type),
      ['order_placed', 'order_canceled'],
    );
  } finally {
    global.fetch = originalFetch;
    if (connected) {
      try {
        await mongoose.connection.dropDatabase();
      } finally {
        await mongoose.disconnect();
      }
    }
  }
});

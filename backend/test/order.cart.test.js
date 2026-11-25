const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const cartAuth = require('../src/domains/orders/cart-auth');
const cartService = require('../src/domains/orders/cart.service');
const orderService = require('../src/domains/orders/order.service');
const orderRoutes = require('../src/routes/v1/orders');

const routeEntries = (router) => router.stack
  .filter((layer) => layer.route)
  .map(({ route }) => [Object.keys(route.methods)[0].toUpperCase(), route.path]);

const invoke = (middleware, request) => new Promise((resolve) => {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      resolve({ statusCode: this.statusCode, body });
    },
  };
  middleware(request, res, () => resolve({ statusCode: 200, actor: request.cartActor }));
});

test('cart exposes the guest-compatible Laravel cart endpoints', () => {
  assert.deepEqual(routeEntries(orderRoutes), [
    ['POST', '/cart/merge-guest'],
    ['GET', '/cart/list'],
    ['POST', '/cart/add'],
    ['POST', '/cart/update'],
    ['DELETE', '/cart/remove-item'],
    ['DELETE', '/cart/remove'],
    ['GET', '/order/list'],
    ['GET', '/order/running-orders'],
    ['GET', '/order/details'],
    ['POST', '/order/place'],
    ['PUT', '/order/cancel'],
    ['POST', '/order/:id/refund-request'],
    ['POST', '/order/place-parcel'],
    ['POST', '/dm-review'],
    ['GET', '/parcel-categories'],
    ['GET', '/cancel-reasons'],
    ['POST', '/item-review'],
  ]);
});

test('checkout rejects unsupported types and payment methods before service calls', async () => {
  const actor = { ownerId: 'guest-123', isGuest: true };
  await assert.rejects(
    orderService.placeOrder(actor, '3', { order_type: 'parcel', payment_method: 'cash_on_delivery', store_id: 'store' }),
    /order_type must be delivery or take_away/,
  );
  await assert.rejects(
    orderService.placeOrder(actor, '3', { order_type: 'delivery', payment_method: 'digital', store_id: 'store' }),
    /payment_method must be cash_on_delivery, digital_payment, or wallet/,
  );
  await assert.rejects(
    orderService.placeOrder(actor, '3', {
      order_type: 'take_away',
      payment_method: 'cash_on_delivery',
      store_id: 'store',
    }, 'tiny'),
    /Idempotency-Key must be 8-128 characters/,
  );
  await assert.rejects(orderService.getOrder(undefined, actor), /order_id is required/);
});

test('cart authentication scopes guests to their guest_id', async () => {
  const result = await invoke(cartAuth, {
    headers: {},
    body: { guest_id: 'guest-123' },
    query: {},
    get: () => undefined,
  });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.actor, { ownerId: 'guest-123', isGuest: true });
});

test('cart rejects a missing guest_id', async () => {
  const result = await invoke(cartAuth, {
    headers: {},
    body: {},
    query: {},
    get: () => undefined,
  });
  assert.equal(result.statusCode, 400);
});

test('cart accepts only valid customer JWTs for authenticated carts', async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-cart-secret';
  try {
    const token = jwt.sign({ id: 'customer-1', role: 'customer' }, process.env.JWT_SECRET);
    const request = {
      headers: { authorization: `Bearer ${token}` },
      body: {},
      query: {},
      get: (name) => name.toLowerCase() === 'authorization' ? `Bearer ${token}` : undefined,
    };
    const result = await invoke(cartAuth, request);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.actor, { ownerId: 'customer-1', isGuest: false });

    const vendorToken = jwt.sign({ id: 'vendor-1', role: 'vendor' }, process.env.JWT_SECRET);
    const rejected = await invoke(cartAuth, {
      ...request,
      get: (name) => name.toLowerCase() === 'authorization' ? `Bearer ${vendorToken}` : undefined,
    });
    assert.equal(rejected.statusCode, 403);
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test('cart validates required module and item input before calling other services', async () => {
  await assert.rejects(cartService.list({ ownerId: 'guest', isGuest: true }), /moduleId header is required/);
  await assert.rejects(cartService.add({ ownerId: 'guest', isGuest: true }, 'module-1', {}), /item_id is required/);
  await assert.rejects(
    cartService.add({ ownerId: 'guest', isGuest: true }, 'module-1', { item_id: 'item-1', model: 'ItemCampaign', price: 5, quantity: 1 }),
    /Only Item products are currently supported/,
  );
});

test('guest carts cannot be merged without a customer identity', async () => {
  await assert.rejects(
    cartService.mergeGuest({ ownerId: 'guest-123', isGuest: true }, 'module-1', 'guest-123'),
    /Customer authentication is required/,
  );
});

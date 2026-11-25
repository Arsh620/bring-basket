const test = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../src/domains/orders/order.model');
const orderService = require('../src/domains/orders/order.service');
const adminRoutes = require('../src/routes/v1/orders/admin');

const routeEntries = (router) => router.stack
  .filter((layer) => layer.route)
  .map(({ route }) => [Object.keys(route.methods)[0].toUpperCase(), route.path, route.stack[0].handle]);

test('admin order, dispatch and refund routes require authentication', async () => {
  const entries = routeEntries(adminRoutes);
  assert.deepEqual(entries.map(([method, path]) => [method, path]), [
    ['GET', '/orders'],
    ['GET', '/orders/refunds'],
    ['GET', '/orders/:id'],
    ['GET', '/orders/:id/deliverymen'],
    ['PATCH', '/orders/:id/assign-dm'],
    ['PATCH', '/orders/:id/status'],
    ['PATCH', '/orders/:id/refund'],
  ]);
  for (const [, , authorize] of entries) {
    let status;
    const res = {
      status(code) { status = code; return this; },
      json(body) { return body; },
    };
    const body = await authorize({ headers: {} }, res, () => assert.fail('Unauthenticated request was accepted'));
    assert.equal(status, 401);
    assert.equal(body.success, false);
  }
});

test('admin order filters are validated and search is literal', async () => {
  await assert.rejects(
    orderService.listAdminOrders({ status: 'unknown' }),
    /Unsupported order status filter/,
  );
  await assert.rejects(
    orderService.listAdminOrders({ search: 'x'.repeat(101) }),
    /search must be a string/,
  );

  const originalFind = Order.find;
  const originalCountDocuments = Order.countDocuments;
  let filter;
  const query = {
    select() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean: async () => [],
  };
  Order.find = (value) => {
    filter = value;
    return query;
  };
  Order.countDocuments = async (value) => {
    assert.equal(value, filter);
    return 0;
  };

  try {
    const result = await orderService.listAdminOrders({
      status: 'pending',
      moduleId: '3',
      search: 'BB-[42]',
      page: '2',
      limit: '5',
    });

    assert.equal(filter.orderStatus, 'pending');
    assert.equal(filter.moduleId, '3');
    assert.equal(filter.$or[0].orderNumber.test('BB-[42]-100'), true);
    assert.equal(filter.$or[0].orderNumber.test('BB-4-100'), false);
    assert.equal(result.offset, 2);
    assert.equal(result.limit, 5);
  } finally {
    Order.find = originalFind;
    Order.countDocuments = originalCountDocuments;
  }
});

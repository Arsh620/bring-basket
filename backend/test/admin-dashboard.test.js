const test = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../src/domains/orders/order.model');
const orderService = require('../src/domains/orders/order.service');
const { getDashboardPeriod } = require('../src/domains/orders/dashboard-period');
const User = require('../src/models/auth/User');
const Store = require('../src/models/store/Store');
const Module = require('../src/models/store/Module');
const Zone = require('../src/models/store/Zone');
const dashboardStoreController = require('../src/domains/store/dashboard.controller');
const customersController = require('../src/domains/identity/customers.controller');
const adminRoutes = require('../src/routes/v1/admin');

const invoke = async (handler, req) => {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextError;
  await handler(req, res, (error) => { nextError = error; });
  if (nextError) throw nextError;
  return res;
};

test('dashboard periods use Asia/Kolkata calendar boundaries', () => {
  const now = new Date('2026-11-18T12:00:00.000Z');
  const week = getDashboardPeriod('this_week', now);
  assert.equal(week.start.toISOString(), '2026-11-15T18:30:00.000Z');
  assert.equal(week.end.toISOString(), '2026-11-22T18:29:59.999Z');
  assert.deepEqual(week.buckets.map(({ label }) => label), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

  const month = getDashboardPeriod('this_month', now);
  assert.equal(month.start.toISOString(), '2026-10-31T18:30:00.000Z');
  assert.equal(month.buckets.length, 30);
  assert.equal(month.buckets[17].key, '2026-11-18');

  const year = getDashboardPeriod('this_year', now);
  assert.equal(year.start.toISOString(), '2025-12-31T18:30:00.000Z');
  assert.equal(year.buckets.length, 12);
  assert.equal(year.buckets[10].key, '2026-11');
});

test('dashboard rejects unsupported periods before querying orders', async () => {
  await assert.rejects(
    orderService.getAdminDashboardStats({ period: 'last_30_days' }),
    (error) => error.statusCode === 400,
  );
});

test('dashboard order analytics apply module, zone and period filters', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-18T12:00:00.000Z') });
  const originalAggregate = Order.aggregate;
  const originalFetch = global.fetch;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalStoreServiceUrl = process.env.STORE_SERVICE_URL;
  const aggregateCalls = [];
  const moduleId = '507f1f77bcf86cd799439011';
  const zoneId = '507f1f77bcf86cd799439012';

  process.env.JWT_SECRET = 'dashboard-test-secret';
  process.env.STORE_SERVICE_URL = 'http://store.test';
  global.fetch = async (url, options) => {
    assert.match(url, /dashboard-store-ids\?/);
    assert.match(url, /moduleId=507f1f77bcf86cd799439011/);
    assert.match(url, /zoneId=507f1f77bcf86cd799439012/);
    assert.match(options.headers.authorization, /^Bearer /);
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { storeIds: ['store-id'] } }),
    };
  };
  Order.aggregate = async (pipeline) => {
    aggregateCalls.push(pipeline);
    if (pipeline.some((stage) => stage.$match && stage.$match.orderStatus === 'delivered')) {
      return [{ _id: '2026-11-16', sales: 12.345, orders: 2 }];
    }
    if (pipeline[1].$group.newOrders) {
      return [{
        totalOrders: 5,
        newOrders: 2,
        deliveredOrders: 1,
        pendingOrders: 3,
        canceledOrders: 1,
        unassignedOrders: 2,
        refundRequests: 1,
        approvedRefunds: 0,
        deliveredSales: 20,
      }];
    }
    return [{ _id: 'pending', count: 3 }];
  };

  try {
    const result = await orderService.getAdminDashboardStats({ period: 'this_week', moduleId, zoneId });
    const salesPipeline = aggregateCalls.find((pipeline) =>
      pipeline.some((stage) => stage.$match && stage.$match.dashboardDeliveredAt));
    const salesMatch = salesPipeline.find((stage) => stage.$match).$match;
    const statusFilter = aggregateCalls[2][0].$match;
    assert.equal(statusFilter.moduleId.$in[0], moduleId);
    assert.equal(String(statusFilter.moduleId.$in[1]), moduleId);
    assert.deepEqual(statusFilter.storeId, { $in: ['store-id'] });
    assert.deepEqual(salesMatch.moduleId, statusFilter.moduleId);
    assert.deepEqual(salesMatch.storeId, statusFilter.storeId);
    assert.deepEqual(
      salesPipeline[0].$addFields.dashboardDeliveredAt.$convert.input,
      { $ifNull: ['$deliveredAt', '$delivered'] },
    );
    assert.equal(salesPipeline[2].$group._id.$dateToString.date, '$dashboardDeliveredAt');
    assert.equal(result.totalOrders, 5);
    assert.equal(result.newOrders, 2);
    assert.equal(result.unassignedOrders, 2);
    assert.equal(result.refundRequests, 1);
    assert.equal(result.periodDeliveredSales, 12.35);
    assert.equal(result.dailySales.length, 7);
    assert.equal(result.dailySales[0].date, '2026-11-16');
    assert.equal(result.dailySales[0].sales, 12.35);
    assert.equal(result.statusCounts.pending, 3);
    const summaryPipeline = aggregateCalls.find((pipeline) => pipeline[1]?.$group?.newOrders);
    assert.deepEqual(summaryPipeline[1].$group.pendingOrders, {
      $sum: { $cond: [{ $eq: ['$orderStatus', 'pending'] }, 1, 0] },
    });
  } finally {
    Order.aggregate = originalAggregate;
    global.fetch = originalFetch;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalStoreServiceUrl === undefined) delete process.env.STORE_SERVICE_URL;
    else process.env.STORE_SERVICE_URL = originalStoreServiceUrl;
  }
});

test('dashboard order filters match numeric and string legacy references', async (t) => {
  const originalAggregate = Order.aggregate;
  const originalFetch = global.fetch;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalStoreServiceUrl = process.env.STORE_SERVICE_URL;
  const aggregateCalls = [];
  t.after(() => {
    Order.aggregate = originalAggregate;
    global.fetch = originalFetch;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalStoreServiceUrl === undefined) delete process.env.STORE_SERVICE_URL;
    else process.env.STORE_SERVICE_URL = originalStoreServiceUrl;
  });

  process.env.JWT_SECRET = 'dashboard-test-secret';
  process.env.STORE_SERVICE_URL = 'http://store.test';
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { storeIds: ['3'] } }),
  });
  Order.aggregate = async (pipeline) => {
    aggregateCalls.push(pipeline);
    if (pipeline[1]?.$group?.newOrders) return [{}];
    return [];
  };

  await orderService.getAdminDashboardStats({ period: 'this_week', moduleId: '3', zoneId: '4' });

  const filters = aggregateCalls.flatMap((pipeline) =>
    pipeline.filter((stage) => stage.$match).map((stage) => stage.$match));
  const filteredQuery = filters.find((filter) => filter.moduleId && filter.storeId);
  assert.deepEqual(filteredQuery.moduleId, { $in: ['3', 3] });
  assert.deepEqual(filteredQuery.storeId, { $in: ['3', 3] });
});

test('dashboard store scope resolves legacy module and zone references', async (t) => {
  const originalStoreFind = Store.collection.find;
  const originalModuleFindOne = Module.collection.findOne;
  const originalZoneFindOne = Zone.collection.findOne;
  const moduleId = '507f1f77bcf86cd799439011';
  const zoneId = '507f1f77bcf86cd799439012';
  const storeId = '507f1f77bcf86cd799439013';
  let filter;

  t.after(() => {
    Store.collection.find = originalStoreFind;
    Module.collection.findOne = originalModuleFindOne;
    Zone.collection.findOne = originalZoneFindOne;
  });

  Module.collection.findOne = async (query, options) => {
    assert.equal(String(query._id), moduleId);
    assert.deepEqual(options, { projection: { legacyId: 1 } });
    return { legacyId: 3 };
  };
  Zone.collection.findOne = async (query, options) => {
    assert.equal(String(query._id), zoneId);
    assert.deepEqual(options, { projection: { legacyId: 1 } });
    return { legacyId: 4 };
  };
  Store.collection.find = (query, options) => {
    filter = query;
    assert.deepEqual(options, { projection: { _id: 1 } });
    return { toArray: async () => [{ _id: storeId }] };
  };

  const response = await invoke(dashboardStoreController.getStoreIds, {
    query: { moduleId, zoneId },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(String(filter.moduleId.$in[0]), moduleId);
  assert.deepEqual(filter.moduleId.$in.slice(1), [moduleId, 3, '3']);
  assert.equal(String(filter.zoneId.$in[0]), zoneId);
  assert.deepEqual(filter.zoneId.$in.slice(1), [zoneId, 4, '4']);
  assert.deepEqual(response.body.data.storeIds, [storeId]);
});

test('customer dashboard stats use the selected zone and return a zero-filled yearly trend', async (t) => {
  const originalAggregate = User.aggregate;
  const zoneId = '507f1f77bcf86cd799439012';
  const year = Number(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
  }).format(new Date()));
  let pipeline;
  t.after(() => { User.aggregate = originalAggregate; });
  User.aggregate = async (value) => {
    pipeline = value;
    return [{
      summary: [{
        totalCustomers: 9,
        activeCustomers: 7,
        blockedCustomers: 2,
        newCustomers: 3,
      }],
      monthly: [{ _id: `${year}-02`, count: 3 }],
    }];
  };

  const response = await invoke(customersController.getDashboardStats, {
    query: { zoneId },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(String(pipeline[0].$match.zoneId), zoneId);
  assert.equal(response.body.data.totalCustomers, 9);
  assert.equal(response.body.data.activeCustomers, 7);
  assert.equal(response.body.data.blockedCustomers, 2);
  assert.equal(response.body.data.newCustomers, 3);
  assert.equal(response.body.data.year, year);
  assert.equal(response.body.data.monthlyCustomers.length, 12);
  assert.deepEqual(response.body.data.monthlyCustomers[0], {
    month: `${year}-01`,
    label: 'Jan',
    count: 0,
  });
  assert.deepEqual(response.body.data.monthlyCustomers[1], {
    month: `${year}-02`,
    label: 'Feb',
    count: 3,
  });
});

test('customer dashboard stats reject invalid zone filters before querying users', async (t) => {
  const originalAggregate = User.aggregate;
  t.after(() => { User.aggregate = originalAggregate; });
  User.aggregate = async () => {
    throw new Error('Invalid zone filters must not query customer data');
  };

  const response = await invoke(customersController.getDashboardStats, {
    query: { zoneId: 'not-a-zone' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'Invalid zone ID');
});

test('customer dashboard route requires Admin customer-management access', () => {
  const route = adminRoutes.stack
    .find(({ route: item }) => item?.path === '/dashboard/customer-stats' && item.methods.get)
    .route;
  assert.equal(route.stack.length, 4);
});

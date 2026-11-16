const test = require('node:test');
const assert = require('node:assert/strict');
const storeRoutes = require('../src/routes/v1/store');
const storeService = require('../src/domains/store/stores.service');
const { adminAuth } = require('../src/middleware/auth');
const { zoneContains } = require('../src/utils/geospatial');

const routeEntries = (router) => router.stack
  .filter((layer) => layer.route)
  .map(({ route }) => [Object.keys(route.methods)[0].toUpperCase(), route.path]);

test('store endpoints include schedule management under the versioned admin route group', () => {
  assert.deepEqual(routeEntries(storeRoutes), [
    ['GET', '/modules'], ['POST', '/modules'], ['GET', '/modules/:id'],
    ['PUT', '/modules/:id'], ['PATCH', '/modules/:id/status'], ['DELETE', '/modules/:id'],
    ['GET', '/zones'], ['POST', '/zones'], ['GET', '/zones/:id'],
    ['PUT', '/zones/:id'], ['PATCH', '/zones/:id/status'], ['DELETE', '/zones/:id'],
    ['GET', '/stores'], ['POST', '/stores'], ['GET', '/stores/:id'],
    ['PUT', '/stores/:id'], ['PATCH', '/stores/:id/status'], ['DELETE', '/stores/:id'],
    ['GET', '/stores/:id/schedule'], ['PUT', '/stores/:id/schedule'],
    ['GET', '/banners'], ['POST', '/banners'], ['PUT', '/banners/:id'],
    ['PATCH', '/banners/:id/status'], ['DELETE', '/banners/:id'],
    ['GET', '/coupons'], ['POST', '/coupons'], ['PUT', '/coupons/:id'],
    ['PATCH', '/coupons/:id/status'], ['DELETE', '/coupons/:id'],
    ['GET', '/flash-sales'], ['POST', '/flash-sales'], ['GET', '/flash-sales/:id'],
    ['PUT', '/flash-sales/:id'], ['PATCH', '/flash-sales/:id/status'], ['DELETE', '/flash-sales/:id'],
    ['GET', '/campaigns'], ['POST', '/campaigns'], ['PUT', '/campaigns/:id'],
    ['PATCH', '/campaigns/:id/status'], ['DELETE', '/campaigns/:id'],
    ['GET', '/advertisements'], ['POST', '/advertisements'], ['PUT', '/advertisements/:id'],
    ['PATCH', '/advertisements/:id/status'], ['DELETE', '/advertisements/:id'],
  ]);
  assert.equal(typeof storeService.getAll, 'function');
  assert.equal(typeof storeService.getSchedule, 'function');
  assert.equal(typeof storeService.updateSchedule, 'function');
  for (const layer of storeRoutes.stack.filter((entry) => entry.route)) {
    assert.equal(layer.route.stack[0].handle, adminAuth, `${layer.route.path} must require admin authentication`);
  }
});

test('public store routes expose module-aware customer address zone validation', () => {
  assert.deepEqual(routeEntries(storeRoutes.customerRouter), [
    ['GET', '/stores'],
    ['GET', '/stores/:id'],
    ['POST', '/zones/check'],
    ['GET', '/banners'],
    ['GET', '/banners/store/:storeId'],
    ['GET', '/flash-sales'],
    ['GET', '/flash-sales/items'],
    ['GET', '/campaigns/basic'],
    ['GET', '/campaigns/item'],
    ['GET', '/advertisements'],
  ]);
});

test('zone containment supports GeoJSON polygons and excludes polygon holes', () => {
  const coordinates = {
    type: 'Polygon',
    coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
    ],
  };
  assert.equal(zoneContains(coordinates, { latitude: 2, longitude: 2 }), true);
  assert.equal(zoneContains(coordinates, { latitude: 5, longitude: 5 }), false);
  assert.equal(zoneContains(coordinates, { latitude: 20, longitude: 20 }), false);
});

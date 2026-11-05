const test = require('node:test');
const assert = require('node:assert/strict');
const storeRoutes = require('../src/routes/v1/store');
const storeService = require('../src/domains/store/stores.service');
const { adminAuth } = require('../src/middleware/auth');

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
  ]);
  assert.equal(typeof storeService.getAll, 'function');
  assert.equal(typeof storeService.getSchedule, 'function');
  assert.equal(typeof storeService.updateSchedule, 'function');
  for (const layer of storeRoutes.stack.filter((entry) => entry.route)) {
    assert.equal(layer.route.stack[0].handle, adminAuth, `${layer.route.path} must require admin authentication`);
  }
});

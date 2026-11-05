const test = require('node:test');
const assert = require('node:assert/strict');
const inventoryRoutes = require('../src/routes/v1/inventory');
const { adminAuth } = require('../src/middleware/auth');

const routeEntries = (router) => router.stack
  .filter((layer) => layer.route)
  .map(({ route }) => [Object.keys(route.methods)[0].toUpperCase(), route.path]);

test('inventory endpoints stay registered under the versioned admin route group', () => {
  assert.deepEqual(routeEntries(inventoryRoutes), [
    ['GET', '/warehouses'], ['POST', '/warehouses'], ['GET', '/warehouses/:id'],
    ['PUT', '/warehouses/:id'], ['PATCH', '/warehouses/:id/status'], ['DELETE', '/warehouses/:id'],
    ['GET', '/warehouses/:id/stock'], ['PUT', '/warehouses/:id/stock/:itemId'],
    ['PATCH', '/warehouses/:id/stock/:itemId/adjust'],
    ['GET', '/stock-movements'],
    ['GET', '/stock-transfers'], ['POST', '/stock-transfers'],
    ['GET', '/stock-transfers/:id'], ['PATCH', '/stock-transfers/:id/dispatch'],
    ['PATCH', '/stock-transfers/:id/receive'], ['PATCH', '/stock-transfers/:id/reject'],
    ['GET', '/store-stock-requests'], ['POST', '/store-stock-requests'],
    ['GET', '/store-stock-requests/:id'], ['PATCH', '/store-stock-requests/:id/approve'],
    ['PATCH', '/store-stock-requests/:id/dispatch'], ['PATCH', '/store-stock-requests/:id/receive'],
    ['PATCH', '/store-stock-requests/:id/reject'],
    ['GET', '/batch-write-offs'], ['POST', '/batch-write-offs'],
  ]);
  for (const layer of inventoryRoutes.stack.filter((entry) => entry.route)) {
    assert.equal(layer.route.stack[0].handle, adminAuth, `${layer.route.path} must require admin authentication`);
  }
});

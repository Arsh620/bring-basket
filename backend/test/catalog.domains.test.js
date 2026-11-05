const test = require('node:test');
const assert = require('node:assert/strict');
const catalogRoutes = require('../src/routes/v1/catalog');
const { adminAuth } = require('../src/middleware/auth');

const routeEntries = (router) => router.stack
  .filter((layer) => layer.route)
  .map(({ route }) => [Object.keys(route.methods)[0].toUpperCase(), route.path]);

test('catalog endpoints stay registered under the versioned admin route group', () => {
  const expected = [
    ['GET', '/brands'], ['POST', '/brands'], ['PUT', '/brands/:id'],
    ['PATCH', '/brands/:id/status'], ['DELETE', '/brands/:id'],
    ['GET', '/categories'], ['GET', '/categories/:id'], ['POST', '/categories'],
    ['PUT', '/categories/:id'], ['PATCH', '/categories/:id/status'], ['DELETE', '/categories/:id'],
    ['GET', '/items'], ['GET', '/items/low-stock'], ['GET', '/items/:id'],
    ['POST', '/items'], ['PUT', '/items/:id'], ['PATCH', '/items/:id/status'],
    ['PATCH', '/items/:id/stock'], ['DELETE', '/items/:id'],
    ['GET', '/units'], ['GET', '/units/:id'], ['POST', '/units'],
    ['PUT', '/units/:id'], ['DELETE', '/units/:id'],
    ['GET', '/unit-groups'], ['GET', '/unit-groups/:id'], ['POST', '/unit-groups'],
    ['PUT', '/unit-groups/:id'], ['PATCH', '/unit-groups/:id/status'],
    ['DELETE', '/unit-groups/:id'], ['GET', '/unit-groups/:id/conversions'],
    ['POST', '/unit-groups/:id/conversions'],
    ['PUT', '/unit-groups/:id/conversions/:conversionId'],
    ['DELETE', '/unit-groups/:id/conversions/:conversionId'],
    ['GET', '/item-batches/expiring-soon'], ['GET', '/item-batches'],
    ['GET', '/item-batches/:id'], ['POST', '/item-batches'],
    ['PUT', '/item-batches/:id'], ['DELETE', '/item-batches/:id'],
  ];

  assert.deepEqual(routeEntries(catalogRoutes), expected);
  for (const layer of catalogRoutes.stack.filter((entry) => entry.route)) {
    assert.equal(layer.route.stack[0].handle, adminAuth, `${layer.route.path} must require admin authentication`);
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { adminAuth } = require('../src/middleware/auth');

const routeCases = [
  {
    name: 'brands',
    oldRoutes: '../src/routes/v1/admin/brand.routes',
    newRoutes: '../src/domains/catalog/brands.routes',
    oldController: '../src/controllers/admin/catalog/brand.controller',
    newController: '../src/domains/catalog/brands.controller',
    expected: [
      ['GET', '/'],
      ['POST', '/'],
      ['PUT', '/:id'],
      ['DELETE', '/:id'],
      ['PATCH', '/:id/status'],
    ],
  },
  {
    name: 'items',
    oldRoutes: '../src/routes/v1/admin/item.routes',
    newRoutes: '../src/domains/catalog/items.routes',
    oldController: '../src/controllers/admin/catalog/item.controller',
    newController: '../src/domains/catalog/items.controller',
    expected: [
      ['GET', '/'],
      ['GET', '/low-stock'],
      ['GET', '/:id'],
      ['POST', '/'],
      ['PUT', '/:id'],
      ['DELETE', '/:id'],
      ['PATCH', '/:id/stock'],
      ['PATCH', '/:id/status'],
    ],
  },
  {
    name: 'units',
    oldRoutes: '../src/routes/v1/admin/unit.routes',
    newRoutes: '../src/domains/catalog/units.routes',
    oldController: '../src/controllers/admin/catalog/unit.controller',
    newController: '../src/domains/catalog/units.controller',
    expected: [
      ['GET', '/'],
      ['POST', '/'],
      ['GET', '/:id'],
      ['PUT', '/:id'],
      ['DELETE', '/:id'],
    ],
  },
  {
    name: 'unit groups',
    oldRoutes: '../src/routes/v1/admin/unit-group.routes',
    newRoutes: '../src/domains/catalog/unit-groups.routes',
    oldController: '../src/controllers/admin/catalog/unit-group.controller',
    newController: '../src/domains/catalog/unit-groups.controller',
    expected: [
      ['GET', '/'],
      ['POST', '/'],
      ['GET', '/:id'],
      ['PUT', '/:id'],
      ['PATCH', '/:id/status'],
      ['DELETE', '/:id'],
      ['GET', '/:id/conversions'],
      ['POST', '/:id/conversions'],
      ['PUT', '/:id/conversions/:conversionId'],
      ['DELETE', '/:id/conversions/:conversionId'],
    ],
    authenticated: true,
  },
];

for (const routeCase of routeCases) {
  test(`${routeCase.name} API keeps its routes and compatibility adapters`, () => {
    const oldRoutes = require(routeCase.oldRoutes);
    const domainRoutes = require(routeCase.newRoutes);
    assert.equal(oldRoutes, domainRoutes);
    assert.equal(require(routeCase.oldController), require(routeCase.newController));

    const actual = domainRoutes.stack
      .filter((layer) => layer.route)
      .map(({ route }) => [Object.keys(route.methods)[0].toUpperCase(), route.path]);
    assert.deepEqual(actual, routeCase.expected);

    if (routeCase.authenticated) {
      assert.equal(domainRoutes.stack[0].handle, adminAuth);
    }
  });
}

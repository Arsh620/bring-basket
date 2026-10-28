const test = require('node:test');
const assert = require('node:assert/strict');
const { adminAuth } = require('../src/middleware/auth');

test('store stock request legacy paths point to the inventory domain', () => {
  const domainRoutes = require('../src/domains/inventory/store-stock-requests.routes');
  const domainController = require('../src/domains/inventory/store-stock-requests.controller');
  const domainService = require('../src/domains/inventory/store-stock-requests.service');

  assert.equal(require('../src/routes/v1/admin/store-stock-request.routes'), domainRoutes);
  assert.equal(
    require('../src/controllers/admin/warehouse/store-stock-request.controller'),
    domainController,
  );
  assert.equal(
    require('../src/services/warehouse/store-stock-request.service'),
    domainService,
  );

  assert.deepEqual(
    domainRoutes.stack
      .filter((layer) => layer.route)
      .map(({ route }) => [Object.keys(route.methods)[0].toUpperCase(), route.path]),
    [
      ['GET', '/'],
      ['POST', '/'],
      ['GET', '/:id'],
      ['PATCH', '/:id/approve'],
      ['PATCH', '/:id/dispatch'],
      ['PATCH', '/:id/receive'],
      ['PATCH', '/:id/reject'],
    ],
  );
  assert.equal(domainRoutes.stack[0].handle, adminAuth);
});

test('stock transfer legacy paths point to inventory domain and keep protected endpoints', () => {
  const domainRoutes = require('../src/domains/inventory/stock-transfers.routes');
  const domainController = require('../src/domains/inventory/stock-transfers.controller');

  assert.equal(require('../src/routes/v1/admin/stock-transfer.routes'), domainRoutes);
  assert.equal(
    require('../src/controllers/admin/warehouse/transfer.controller'),
    domainController,
  );
  assert.deepEqual(
    domainRoutes.stack
      .filter((layer) => layer.route)
      .map(({ route }) => [Object.keys(route.methods)[0].toUpperCase(), route.path]),
    [
      ['GET', '/'],
      ['POST', '/'],
      ['GET', '/:id'],
      ['PATCH', '/:id/dispatch'],
      ['PATCH', '/:id/receive'],
      ['PATCH', '/:id/reject'],
    ],
  );
  assert.equal(domainRoutes.stack[0].handle, adminAuth);
});

const inventoryRouteCases = [
  {
    name: 'warehouses',
    oldRoute: '../src/routes/v1/admin/warehouse.routes',
    domainRoute: '../src/domains/inventory/warehouses.routes',
    oldController: '../src/controllers/admin/warehouse/warehouse.controller',
    domainController: '../src/domains/inventory/warehouses.controller',
    routes: [
      ['GET', '/'],
      ['POST', '/'],
      ['GET', '/:id'],
      ['PUT', '/:id'],
      ['PATCH', '/:id/status'],
      ['DELETE', '/:id'],
    ],
  },
  {
    name: 'warehouse stock',
    oldRoute: '../src/routes/v1/admin/warehouse-stock.routes',
    domainRoute: '../src/domains/inventory/warehouse-stock.routes',
    oldController: '../src/controllers/admin/warehouse/stock.controller',
    domainController: '../src/domains/inventory/warehouse-stock.controller',
    routes: [
      ['GET', '/:id/stock'],
      ['PUT', '/:id/stock/:itemId'],
      ['PATCH', '/:id/stock/:itemId/adjust'],
    ],
    authenticated: true,
  },
  {
    name: 'stock movements',
    oldRoute: '../src/routes/v1/admin/stock-movement.routes',
    domainRoute: '../src/domains/inventory/stock-movements.routes',
    oldController: '../src/controllers/admin/warehouse/movement.controller',
    domainController: '../src/domains/inventory/stock-movements.controller',
    routes: [['GET', '/']],
    authenticated: true,
  },
  {
    name: 'batch write-offs',
    oldRoute: '../src/routes/v1/admin/batch-write-off.routes',
    domainRoute: '../src/domains/inventory/batch-write-offs.routes',
    oldController: '../src/controllers/admin/warehouse/batch-write-off.controller',
    domainController: '../src/domains/inventory/batch-write-offs.controller',
    routes: [
      ['GET', '/'],
      ['POST', '/'],
    ],
    authenticated: true,
  },
];

for (const routeCase of inventoryRouteCases) {
  test(`${routeCase.name} API stays wired through the inventory domain`, () => {
    const domainRoutes = require(routeCase.domainRoute);
    assert.equal(require(routeCase.oldRoute), domainRoutes);
    assert.equal(require(routeCase.oldController), require(routeCase.domainController));
    assert.deepEqual(
      domainRoutes.stack
        .filter((layer) => layer.route)
        .map(({ route }) => [Object.keys(route.methods)[0].toUpperCase(), route.path]),
      routeCase.routes,
    );
    if (routeCase.authenticated) {
      assert.equal(domainRoutes.stack[0].handle, adminAuth);
    }
  });
}

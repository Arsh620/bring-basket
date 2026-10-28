const test = require('node:test');
const assert = require('node:assert/strict');
const legacyRoutes = require('../src/routes/v1/admin/store.routes');
const moduleRoutes = require('../src/domains/store/stores.routes');
const legacyController = require('../src/controllers/admin/store/store.controller');
const moduleController = require('../src/domains/store/stores.controller');
const storeService = require('../src/domains/store/stores.service');
const { adminAuth } = require('../src/middleware/auth');

test('store compatibility adapters point to the domain routes and controller', () => {
  assert.equal(legacyRoutes, moduleRoutes);
  assert.equal(legacyController, moduleController);
  assert.equal(typeof storeService.getAll, 'function');
  assert.equal(typeof storeService.getSchedule, 'function');
});

test('store domain keeps all existing routes behind admin authentication', () => {
  const routes = moduleRoutes.stack.filter((layer) => layer.route);
  assert.deepEqual(
    routes.map(({ route }) => [
      Object.keys(route.methods)[0].toUpperCase(),
      route.path,
    ]),
    [
      ['GET', '/'],
      ['POST', '/'],
      ['GET', '/:id'],
      ['PUT', '/:id'],
      ['PATCH', '/:id/status'],
      ['DELETE', '/:id'],
      ['GET', '/:id/schedule'],
      ['PUT', '/:id/schedule'],
    ],
  );
  assert.equal(moduleRoutes.stack[0].handle, adminAuth);
});

const storeDomainRoutes = [
  {
    name: 'modules',
    legacyRoute: '../src/routes/v1/admin/module.routes',
    domainRoute: '../src/domains/store/modules.routes',
    legacyController: '../src/controllers/admin/store/module.controller',
    domainController: '../src/domains/store/modules.controller',
  },
  {
    name: 'zones',
    legacyRoute: '../src/routes/v1/admin/zone.routes',
    domainRoute: '../src/domains/store/zones.routes',
    legacyController: '../src/controllers/admin/store/zone.controller',
    domainController: '../src/domains/store/zones.controller',
  },
];

for (const { name, legacyRoute, domainRoute, legacyController, domainController } of storeDomainRoutes) {
  test(`${name} API is registered from the store domain with existing protected routes`, () => {
    const routes = require(domainRoute);
    assert.equal(require(legacyRoute), routes);
    assert.equal(require(legacyController), require(domainController));
    assert.deepEqual(
      routes.stack
        .filter((layer) => layer.route)
        .map(({ route }) => [Object.keys(route.methods)[0].toUpperCase(), route.path]),
      [
        ['GET', '/'],
        ['POST', '/'],
        ['GET', '/:id'],
        ['PUT', '/:id'],
        ['PATCH', '/:id/status'],
        ['DELETE', '/:id'],
      ],
    );
    assert.equal(routes.stack[0].handle, adminAuth);
  });
}

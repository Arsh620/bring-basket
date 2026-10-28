const test = require('node:test');
const assert = require('node:assert/strict');
const {
  adminAuth,
  warehouseAuth,
  supplierAuth,
  vendorAuth,
  customerAuth,
  deliverymanAuth,
} = require('../src/middleware/auth');

const routeCases = [
  {
    name: 'admin auth',
    legacyRoute: '../src/routes/v1/admin/auth.routes',
    domainRoute: '../src/domains/identity/admin-auth.routes',
    legacyController: '../src/controllers/admin/auth/auth.controller',
    domainController: '../src/domains/identity/admin-auth.controller',
    routes: [
      ['POST', '/login'],
      ['POST', '/register'],
      ['GET', '/me'],
      ['POST', '/logout'],
    ],
    auth: adminAuth,
    protectedPaths: ['/me', '/logout'],
  },
  {
    name: 'admin management',
    legacyRoute: '../src/routes/v1/admin/admins.routes',
    domainRoute: '../src/domains/identity/admins.routes',
    legacyController: '../src/controllers/admin/auth/admins.controller',
    domainController: '../src/domains/identity/admins.controller',
    routes: [
      ['GET', '/'],
      ['POST', '/'],
      ['GET', '/:id'],
      ['PUT', '/:id'],
      ['PATCH', '/:id/status'],
      ['DELETE', '/:id'],
    ],
    auth: adminAuth,
    globalAuth: true,
  },
  {
    name: 'admin roles',
    legacyRoute: '../src/routes/v1/admin/roles.routes',
    domainRoute: '../src/domains/identity/roles.routes',
    legacyController: '../src/controllers/admin/auth/roles.controller',
    domainController: '../src/domains/identity/roles.controller',
    routes: [
      ['GET', '/'],
      ['POST', '/'],
      ['GET', '/:id'],
      ['PUT', '/:id'],
      ['DELETE', '/:id'],
    ],
    auth: adminAuth,
    globalAuth: true,
  },
  ...[
    ['warehouse', 'warehouse-auth', warehouseAuth, [
      ['POST', '/login'], ['GET', '/me'], ['POST', '/logout'],
    ], ['/me', '/logout']],
    ['supplier', 'supplier-auth', supplierAuth, [
      ['POST', '/login'], ['GET', '/me'], ['POST', '/logout'],
    ], ['/me', '/logout']],
    ['vendor', 'vendor-auth', vendorAuth, [
      ['POST', '/login'], ['GET', '/me'], ['POST', '/logout'],
    ], ['/me', '/logout']],
    ['customer', 'customer-auth', customerAuth, [
      ['POST', '/login'], ['POST', '/register'], ['GET', '/me'],
    ], ['/me']],
    ['deliveryman', 'deliveryman-auth', deliverymanAuth, [
      ['POST', '/login'], ['GET', '/me'], ['POST', '/logout'],
    ], ['/me', '/logout']],
  ].map(([name, domainName, auth, routes, protectedPaths]) => ({
    name,
    legacyRoute: `../src/routes/v1/${name}/auth.routes`,
    domainRoute: `../src/domains/identity/${domainName}.routes`,
    legacyController: `../src/controllers/${name}/auth.controller`,
    domainController: `../src/domains/identity/${domainName}.controller`,
    routes,
    auth,
    protectedPaths,
  })),
];

for (const routeCase of routeCases) {
  test(`${routeCase.name} routes and legacy adapters remain compatible`, () => {
    const domainRoute = require(routeCase.domainRoute);
    assert.equal(require(routeCase.legacyRoute), domainRoute);
    assert.equal(require(routeCase.legacyController), require(routeCase.domainController));

    const layers = domainRoute.stack;
    if (routeCase.globalAuth) assert.equal(layers[0].handle, routeCase.auth);
    for (const layer of layers.filter((candidate) => (
      candidate.route && routeCase.protectedPaths?.includes(candidate.route.path)
    ))) {
      assert.equal(layer.route.stack[0].handle, routeCase.auth);
    }

    assert.deepEqual(
      layers.filter((layer) => layer.route).map(({ route }) => [
        Object.keys(route.methods)[0].toUpperCase(),
        route.path,
      ]),
      routeCase.routes,
    );
  });
}

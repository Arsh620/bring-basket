const test = require('node:test');
const assert = require('node:assert/strict');
const identityRoutes = require('../src/routes/v1/identity');
const {
  adminAuth,
  customerAuth,
  deliverymanAuth,
  supplierAuth,
  vendorAuth,
  warehouseAuth,
} = require('../src/middleware/auth');
const { authLimiter } = require('../src/middleware/rateLimiter');

const routeEntries = (router) => router.stack
  .filter((layer) => layer.route)
  .map(({ route }) => [Object.keys(route.methods)[0].toUpperCase(), route.path]);

test('identity endpoints expose the existing portal auth and admin management routes', () => {
  assert.deepEqual(routeEntries(identityRoutes), [
    ['POST', '/admin/auth/login'], ['POST', '/admin/auth/register'],
    ['GET', '/admin/auth/me'], ['POST', '/admin/auth/logout'],
    ['GET', '/admin/admins'], ['POST', '/admin/admins'],
    ['GET', '/admin/admins/:id'], ['PUT', '/admin/admins/:id'],
    ['PATCH', '/admin/admins/:id/status'], ['DELETE', '/admin/admins/:id'],
    ['GET', '/admin/roles'], ['POST', '/admin/roles'],
    ['GET', '/admin/roles/:id'], ['PUT', '/admin/roles/:id'], ['DELETE', '/admin/roles/:id'],
    ['POST', '/customer/auth/login'], ['POST', '/customer/auth/register'], ['GET', '/customer/auth/me'],
    ['POST', '/vendor/auth/login'], ['GET', '/vendor/auth/me'], ['POST', '/vendor/auth/logout'],
    ['POST', '/supplier/auth/login'], ['GET', '/supplier/auth/me'], ['POST', '/supplier/auth/logout'],
    ['POST', '/deliveryman/auth/login'], ['GET', '/deliveryman/auth/me'], ['POST', '/deliveryman/auth/logout'],
    ['POST', '/warehouse/auth/login'], ['GET', '/warehouse/auth/me'], ['POST', '/warehouse/auth/logout'],
  ]);
});

test('admin management and portal profile/logout endpoints retain authentication', () => {
  for (const layer of identityRoutes.stack.filter((entry) => entry.route)) {
    const path = layer.route.path;
    const method = Object.keys(layer.route.methods)[0].toUpperCase();
    const auth = layer.route.stack[0].handle;

    if (path.startsWith('/admin/admins') || path.startsWith('/admin/roles')) {
      assert.equal(layer.route.stack.length, 3, `${method} ${path} must require admin authentication and role checks`);
      assert.equal(auth, adminAuth, `${method} ${path} must use the admin auth middleware`);
    } else if (['/admin/auth/me', '/admin/auth/logout'].includes(path)) {
      assert.equal(layer.route.stack.length, 3, `${method} ${path} must require admin authentication and role checks`);
      assert.equal(auth, adminAuth, `${method} ${path} must use the admin auth middleware`);
    } else if (/\/auth\/(me|logout)$/.test(path)) {
      const portalAuth = {
        '/customer/auth/me': customerAuth,
        '/vendor/auth/me': vendorAuth,
        '/vendor/auth/logout': vendorAuth,
        '/supplier/auth/me': supplierAuth,
        '/supplier/auth/logout': supplierAuth,
        '/deliveryman/auth/me': deliverymanAuth,
        '/deliveryman/auth/logout': deliverymanAuth,
        '/warehouse/auth/me': warehouseAuth,
        '/warehouse/auth/logout': warehouseAuth,
      };
      assert.equal(layer.route.stack.length, 2, `${method} ${path} must require authentication`);
      assert.equal(auth, portalAuth[path], `${method} ${path} must use its portal auth middleware`);
    } else {
      assert.equal(layer.route.stack.length, 2, `${method} ${path} must be rate limited`);
      assert.equal(layer.route.stack[0].handle, authLimiter, `${method} ${path} must use the shared auth limiter`);
    }
  }
});

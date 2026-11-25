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
    ['GET', '/admin/employee-roles'],
    ['GET', '/admin/roles/permissions'],
    ['GET', '/admin/roles'], ['POST', '/admin/roles'],
    ['GET', '/admin/roles/:id'], ['PUT', '/admin/roles/:id'], ['DELETE', '/admin/roles/:id'],
    ['POST', '/customer/auth/login'], ['POST', '/customer/auth/register'],
    ['POST', '/customer/auth/forgot-password'], ['POST', '/customer/auth/verify-otp'],
    ['PUT', '/customer/auth/reset-password'], ['GET', '/customer/auth/me'],
    ['GET', '/customer/addresses'], ['POST', '/customer/addresses'],
    ['PUT', '/customer/addresses/:id'], ['DELETE', '/customer/addresses'],
    ['POST', '/vendor/auth/login'], ['POST', '/vendor/auth/register'],
    ['GET', '/vendor/auth/me'], ['POST', '/vendor/auth/logout'],
    ['GET', '/vendor/roles/permissions'], ['GET', '/vendor/roles/assignable'],
    ['GET', '/vendor/roles'], ['POST', '/vendor/roles'],
    ['GET', '/vendor/roles/:id'], ['PUT', '/vendor/roles/:id'], ['DELETE', '/vendor/roles/:id'],
    ['GET', '/vendor/employees'], ['POST', '/vendor/employees'],
    ['PUT', '/vendor/employees/:id'], ['PATCH', '/vendor/employees/:id/status'],
    ['DELETE', '/vendor/employees/:id'],
    ['POST', '/supplier/auth/login'], ['POST', '/supplier/auth/set-password'],
    ['POST', '/supplier/auth/invitations/:supplierId'],
    ['GET', '/supplier/auth/me'], ['POST', '/supplier/auth/logout'],
    ['POST', '/deliveryman/auth/login'], ['GET', '/deliveryman/auth/me'], ['POST', '/deliveryman/auth/logout'],
    ['POST', '/warehouse/auth/login'], ['GET', '/warehouse/auth/me'], ['POST', '/warehouse/auth/logout'],
  ]);
});

test('admin management and portal profile/logout endpoints retain authentication', () => {
  for (const layer of identityRoutes.stack.filter((entry) => entry.route)) {
    const path = layer.route.path;
    const method = Object.keys(layer.route.methods)[0].toUpperCase();
    const auth = layer.route.stack[0].handle;

    if (path.startsWith('/admin/admins') || path.startsWith('/admin/roles') || path === '/admin/employee-roles') {
      assert.equal(layer.route.stack.length, 4, `${method} ${path} must require admin authentication, role checks and module access`);
      assert.equal(auth, adminAuth, `${method} ${path} must use the admin auth middleware`);
    } else if (path === '/admin/auth/register') {
      assert.equal(layer.route.stack.length, 5, `${method} ${path} must require admin authentication, employee access and rate limiting`);
      assert.equal(auth, adminAuth, `${method} ${path} must use the admin auth middleware`);
    } else if (['/admin/auth/me', '/admin/auth/logout'].includes(path)) {
      assert.equal(layer.route.stack.length, 4, `${method} ${path} must require admin authentication, role checks and an active role`);
      assert.equal(auth, adminAuth, `${method} ${path} must use the admin auth middleware`);
    } else if (path.startsWith('/customer/addresses')) {
      assert.equal(layer.route.stack.length, 2, `${method} ${path} must require customer authentication`);
      assert.equal(auth, customerAuth, `${method} ${path} must use customer authentication`);
    } else if (path.startsWith('/vendor/roles') || path.startsWith('/vendor/employees')) {
      assert.equal(layer.route.stack.length, 3, `${method} ${path} must require vendor auth and module access`);
      assert.equal(auth, vendorAuth, `${method} ${path} must use vendor authentication`);
    } else if (path === '/supplier/auth/invitations/:supplierId') {
      assert.equal(layer.route.stack.length, 4, `${method} ${path} must require admin authentication and purchase permission`);
      assert.equal(auth, adminAuth, `${method} ${path} must use admin authentication`);
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

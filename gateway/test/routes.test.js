const test = require('node:test');
const assert = require('node:assert/strict');
const routes = require('../src/routes');

const hasPrefix = (service, prefix) => routes[service].pathPrefix.includes(prefix);

test('gateway sends customer catalog and store content to their owning services', () => {
  assert.equal(hasPrefix('catalog', '/api/v1/customer/categories'), true);

  for (const resource of ['banners', 'flash-sales', 'campaigns', 'advertisements']) {
    assert.equal(hasPrefix('store', `/api/v1/customer/${resource}`), true);
  }
});

test('gateway sends storefront cart, orders and wishlist requests to their mounted routes', () => {
  assert.equal(hasPrefix('order', '/api/v1/customer/cart'), true);
  assert.equal(hasPrefix('order', '/api/v1/customer/order'), true);
  assert.equal(hasPrefix('customerWishlist', '/api/v1/customer/wish-list'), true);
});

test('gateway sends admin marketing resources to the Store service', () => {
  for (const resource of ['banners', 'coupons', 'flash-sales', 'campaigns', 'brand-sales', 'advertisements']) {
    assert.equal(hasPrefix('store', `/api/v1/admin/${resource}`), true);
  }
  assert.equal(hasPrefix('catalog', '/api/v1/admin/brand-sales'), false);
});

test('gateway sends admin retention routes to the backend that mounts them', () => {
  for (const resource of ['membership', 'loyalty', 'wallet']) {
    const prefix = `/api/v1/admin/${resource}`;
    assert.equal(hasPrefix('adminMgmt', prefix), true);
    assert.equal(hasPrefix('accounting', prefix), false);
  }
});

test('gateway sends customer cashback reads to the Accounting service', () => {
  assert.equal(hasPrefix('accounting', '/api/v1/cashback'), true);
});

test('gateway sends Admin customer dashboard analytics to the Accounting service', () => {
  assert.equal(hasPrefix('accounting', '/api/v1/admin/dashboard/customer-stats'), true);
});

test('gateway sends vendor role and employee management to the Identity service', () => {
  assert.equal(hasPrefix('identity', '/api/v1/vendor/roles'), true);
  assert.equal(hasPrefix('identity', '/api/v1/vendor/employees'), true);
});

test('gateway sends employee role options to the Identity service', () => {
  assert.equal(hasPrefix('identity', '/api/v1/admin/employee-roles'), true);
});

test('gateway sends the protected master access workspace to Identity', () => {
  assert.equal(hasPrefix('identity', '/api/v1/admin/master'), true);
});

test('gateway sends supplier authentication to Identity and supplier operations to Procurement', () => {
  assert.equal(hasPrefix('identity', '/api/v1/supplier/auth'), true);
  assert.equal(hasPrefix('procurement', '/api/v1/supplier'), true);
});

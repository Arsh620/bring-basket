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

test('gateway sends admin marketing resources to the Store service', () => {
  for (const resource of ['banners', 'coupons', 'flash-sales', 'campaigns', 'advertisements']) {
    assert.equal(hasPrefix('store', `/api/v1/admin/${resource}`), true);
  }
});

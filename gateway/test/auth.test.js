const test = require('node:test');
const assert = require('node:assert/strict');
const authMiddleware = require('../src/auth');

const invoke = ({ method, path, headers = {} }) => new Promise((resolve) => {
  const req = { method, path, headers };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      resolve({ statusCode: this.statusCode, body });
    },
  };
  authMiddleware(req, res, () => resolve({ statusCode: 200 }));
});

test('gateway permits guest cart requests for downstream customer scoping', async () => {
  const result = await invoke({ method: 'POST', path: '/api/v1/customer/cart/add' });
  assert.equal(result.statusCode, 200);
});

test('gateway permits public customer item reads but protects item writes', async () => {
  assert.equal((await invoke({ method: 'GET', path: '/api/v1/customer/items/abc' })).statusCode, 200);
  assert.equal((await invoke({ method: 'GET', path: '/api/v1/customer/items/abc/reviews' })).statusCode, 200);
  assert.equal((await invoke({ method: 'POST', path: '/api/v1/customer/items/abc' })).statusCode, 401);
});

test('gateway permits public customer catalog and promotion reads', async () => {
  const paths = [
    '/api/v1/customer/items/popular',
    '/api/v1/customer/items/search',
    '/api/v1/customer/categories',
    '/api/v1/customer/categories/abc/items',
    '/api/v1/customer/stores/latest',
    '/api/v1/customer/banners',
    '/api/v1/customer/flash-sales/items',
    '/api/v1/customer/campaigns/basic',
    '/api/v1/customer/advertisements',
  ];

  for (const path of paths) {
    assert.equal((await invoke({ method: 'GET', path })).statusCode, 200, path);
  }
});

test('gateway still protects customer writes and admin promotion routes', async () => {
  assert.equal((await invoke({ method: 'POST', path: '/api/v1/customer/banners' })).statusCode, 401);
  assert.equal((await invoke({ method: 'GET', path: '/api/v1/admin/banners' })).statusCode, 401);
});

test('gateway sends guest order routes downstream but protects legacy plural order routes', async () => {
  const guestOrder = await invoke({ method: 'POST', path: '/api/v1/customer/order/place' });
  assert.equal(guestOrder.statusCode, 200);

  const result = await invoke({ method: 'POST', path: '/api/v1/customer/orders' });
  assert.equal(result.statusCode, 401);
});

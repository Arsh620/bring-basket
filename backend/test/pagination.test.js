const test = require('node:test');
const assert = require('node:assert/strict');
const { paginate } = require('../src/utils/pagination');

test('pagination uses defaults for missing or invalid values', () => {
  assert.deepEqual(paginate(), { page: 1, limit: 20, skip: 0 });
  assert.deepEqual(paginate({ page: 'invalid', limit: 'invalid' }), {
    page: 1,
    limit: 20,
    skip: 0,
  });
});

test('pagination parses decimal strings and caps the requested limit', () => {
  assert.deepEqual(paginate({ page: '3', limit: '250' }), {
    page: 3,
    limit: 100,
    skip: 200,
  });
});

test('pagination prevents zero or negative values from producing invalid skips', () => {
  assert.deepEqual(paginate({ page: '-2', limit: '-5' }), {
    page: 1,
    limit: 20,
    skip: 0,
  });
  assert.deepEqual(paginate({ page: '0', limit: '0' }), {
    page: 1,
    limit: 20,
    skip: 0,
  });
});

test('pagination bounds very large page numbers to a safe skip value', () => {
  const result = paginate({ page: '9007199254740991', limit: '100' });
  assert.equal(Number.isSafeInteger(result.skip), true);
  assert.equal(result.limit, 100);
});

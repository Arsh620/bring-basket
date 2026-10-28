const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCategoryFilter, parseStatus } = require('../src/domains/catalog/categories.validation');
const categoryRoutes = require('../src/routes/v1/admin/category.routes');
const errorHandler = require('../src/middleware/errorHandler');
const AppError = require('../src/utils/AppError');

const moduleId = '507f1f77bcf86cd799439011';
const parentId = '507f191e810c19729de860ea';

test('category filters validate IDs and support root categories', () => {
  assert.deepEqual(
    buildCategoryFilter({ moduleId, parentId: 'null', status: 'true' }),
    { moduleId, parentId: null, status: true },
  );
  assert.throws(() => buildCategoryFilter({ moduleId: 'invalid' }), {
    message: 'Invalid module ID',
    statusCode: 400,
  });
  assert.throws(() => buildCategoryFilter({ parentId: 'invalid' }), {
    message: 'Invalid parent category ID',
    statusCode: 400,
  });
});

test('category status accepts booleans and true/false strings only', () => {
  assert.equal(parseStatus(true), true);
  assert.equal(parseStatus(false), false);
  assert.equal(parseStatus(' TRUE '), true);
  assert.equal(parseStatus('false'), false);
  assert.throws(() => parseStatus('active'), {
    message: 'Status must be true or false',
    statusCode: 400,
  });
  assert.throws(() => parseStatus(undefined, { required: true }), {
    message: 'Status is required',
    statusCode: 400,
  });
});

test('category filter rejects malformed status instead of silently filtering inactive rows', () => {
  assert.throws(() => buildCategoryFilter({ status: 'active' }), {
    message: 'Status must be true or false',
    statusCode: 400,
  });
});

test('legacy category route keeps the existing REST endpoints', () => {
  const routes = categoryRoutes.stack.map(({ route }) => [
    Object.keys(route.methods)[0].toUpperCase(),
    route.path,
  ]);
  assert.deepEqual(routes, [
    ['GET', '/'],
    ['GET', '/:id'],
    ['POST', '/'],
    ['PUT', '/:id'],
    ['DELETE', '/:id'],
    ['PATCH', '/:id/status'],
  ]);
});

test('central error handler preserves AppError status codes', () => {
  let responseStatus;
  let responseBody;
  const response = {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  errorHandler(new AppError('Invalid category ID', 400), {}, response, () => {});

  assert.equal(responseStatus, 400);
  assert.deepEqual(responseBody, { success: false, message: 'Invalid category ID' });
});

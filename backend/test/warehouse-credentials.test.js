const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const Warehouse = require('../src/models/warehouse/Warehouse');
const warehouses = require('../src/domains/inventory/warehouses.service');
const sanitize = require('../src/middleware/sanitize');

const warehouseId = '507f1f77bcf86cd799439011';

test('warehouse creation hashes the optional portal password and keeps it out of responses', async (t) => {
  const create = t.mock.method(Warehouse, 'create', async (fields) => new Warehouse(fields));
  const payload = { name: 'Test warehouse', code: 'TW', state: 'Kerala', username: 'warehouse_1', password: 'Example$42' };
  const request = { body: payload };
  sanitize(request, {}, () => {});
  const warehouse = await warehouses.create(request.body);
  const fields = create.mock.calls[0].arguments[0];
  assert.equal(fields.password, undefined);
  assert.equal(await bcrypt.compare(payload.password, fields.passwordHash), true);
  const response = JSON.parse(JSON.stringify(warehouse));
  assert.equal(response.username, 'warehouse_1');
  assert.equal(response.passwordHash, undefined);
});

test('warehouse password rotation uses the existing username and reports username conflicts', async (t) => {
  const warehouse = new Warehouse({ _id: warehouseId, name: 'Test', code: 'TW', state: 'Kerala', username: 'warehouse_1' });
  t.mock.method(Warehouse, 'findById', async () => warehouse);
  const save = t.mock.method(warehouse, 'save', async () => warehouse);

  await warehouses.update(warehouseId, { password: 'Changed$42' });
  assert.equal(warehouse.username, 'warehouse_1');
  assert.equal(await bcrypt.compare('Changed$42', warehouse.passwordHash), true);
  const hash = warehouse.passwordHash;
  await warehouses.update(warehouseId, { city: 'Kochi' });
  assert.equal(warehouse.passwordHash, hash);

  save.mock.mockImplementation(async () => {
    throw Object.assign(new Error('Duplicate key'), { code: 11000, keyPattern: { username: 1 } });
  });
  await assert.rejects(
    warehouses.update(warehouseId, { username: 'existing-user', password: 'Changed$43' }),
    { statusCode: 409, message: 'Username already taken' },
  );
});

test('warehouse provisioning rejects incomplete and invalid portal credentials', async () => {
  const data = { name: 'Test', code: 'TW', state: 'Kerala' };
  await assert.rejects(warehouses.create({ ...data, password: 'Example42' }), { statusCode: 400 });
  await assert.rejects(warehouses.create({ ...data, username: 'invalid user', password: 'Example42' }), { statusCode: 400 });
  await assert.rejects(warehouses.create({ ...data, username: 'warehouse_1', password: '123' }), { statusCode: 400 });
});

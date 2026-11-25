const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const mongoose = require('mongoose');
const Admin = require('../src/models/auth/Admin');
const AdminRole = require('../src/models/auth/AdminRole');
const WarehouseStockMovement = require('../src/models/warehouse/WarehouseStockMovement');
const identityRoutes = require('../src/routes/v1/identity');
const inventoryRoutes = require('../src/routes/v1/inventory');
const warehouseRoutes = require('../src/routes/v1/warehouse');
const sanitize = require('../src/middleware/sanitize');
const errorHandler = require('../src/middleware/errorHandler');
const { normalizeModules } = require('../src/domains/identity/admin-role-permissions');

test('portal provisioning and access work through real routes and isolated Mongo records', {
  skip: !process.env.PORTAL_INTEGRATION_MONGO_URI,
}, async (t) => {
  const uri = new URL(process.env.PORTAL_INTEGRATION_MONGO_URI);
  const database = `bring_basket_portal_it_${randomUUID().replace(/-/g, '')}`;
  uri.pathname = `/${database}`;
  process.env.JWT_SECRET = randomUUID();
  await mongoose.connect(uri.toString(), { serverSelectionTimeoutMS: 6000 });
  t.after(async () => {
    if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  const master = await AdminRole.create({ name: 'Primary admin', legacyId: 1, modules: [] });
  const adminCredentials = { email: 'admin@example.test', password: 'Portal$Test1', accountType: 'admin' };
  await Admin.create({ fName: 'Primary', ...adminCredentials, roleId: master._id });

  const app = express();
  app.use(express.json(), sanitize);
  app.use('/api/v1', identityRoutes);
  app.use('/api/v1/admin', inventoryRoutes);
  app.use('/api/v1/warehouse', warehouseRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const request = async (method, path, { body, token, expected = 200 } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json();
    assert.equal(response.status, expected, `${method} ${path} returned ${payload.message ?? response.status}`);
    return payload.data;
  };

  const { token: adminToken } = await request('POST', '/admin/auth/login', { body: adminCredentials });
  const grants = ['item', 'employee', 'custom_role'];
  const role = await request('POST', '/admin/master/roles', {
    token: adminToken, body: { name: 'Test catalog team', modules: grants }, expected: 201,
  });
  const options = await request('GET', '/admin/master/employee-roles', { token: adminToken });
  assert.ok(options.some(({ _id }) => _id === role._id));
  const employeeCredentials = { email: 'catalog@example.test', password: 'Portal$Test2', accountType: 'employee' };
  const employee = await request('POST', '/admin/master/employees', {
    token: adminToken,
    body: { ...employeeCredentials, fName: 'Catalog', phone: '9876543210', roleId: role._id, status: false },
    expected: 201,
  });
  assert.equal(employee.status, false);
  assert.equal(employee.password, undefined);
  await request('POST', '/admin/auth/login', { body: employeeCredentials, expected: 403 });
  await request('PATCH', `/admin/master/employees/${employee._id}/status`, { token: adminToken, body: { status: true } });
  const { token: employeeToken, admin } = await request('POST', '/admin/auth/login', { body: employeeCredentials });
  assert.deepEqual(normalizeModules(admin.roleId.modules), grants);
  await request('GET', '/admin/roles', { token: employeeToken });
  await request('GET', '/admin/master/roles', { token: employeeToken, expected: 403 });
  await request('GET', '/admin/master/employees', { token: employeeToken, expected: 403 });
  await request('GET', '/admin/master/employees', { expected: 401 });
  await request('GET', '/admin/warehouses', { token: employeeToken, expected: 403 });
  await request('PUT', `/admin/master/roles/${role._id}`, {
    token: adminToken, body: { modules: ['item', 'employee'] },
  });
  const refreshed = await request('GET', '/admin/auth/me', { token: employeeToken });
  assert.deepEqual(normalizeModules(refreshed.roleId.modules), ['item', 'employee']);
  await request('GET', '/admin/roles', { token: employeeToken, expected: 403 });
  await request('PATCH', `/admin/master/employees/${employee._id}/status`, { token: adminToken, body: { status: false } });
  await request('GET', '/admin/auth/me', { token: employeeToken, expected: 403 });
  await request('PATCH', `/admin/master/employees/${employee._id}/status`, { token: adminToken, body: { status: true } });
  await request('POST', '/admin/auth/login', { body: employeeCredentials });

  const motherCredentials = { username: 'mother_test', password: 'Warehouse$1' };
  const mother = await request('POST', '/admin/warehouses', {
    token: adminToken,
    body: { ...motherCredentials, name: 'Test mother', code: 'TEST-WH', type: 'mother', state: 'Kerala' },
    expected: 201,
  });
  assert.equal(mother.passwordHash, undefined);
  const { token: motherToken } = await request('POST', '/warehouse/auth/login', { body: motherCredentials });
  const profile = await request('GET', '/warehouse/auth/me', { token: motherToken });
  assert.equal(profile.type, 'mother');
  assert.equal(profile.passwordHash, undefined);

  const child = await request('POST', '/warehouse/subs', {
    token: motherToken, body: { name: 'Test sub', state: 'Kerala' }, expected: 201,
  });
  const childCredentials = { username: 'sub_test', password: 'Warehouse$2' };
  await request('POST', `/warehouse/subs/${child._id}/credentials`, { token: motherToken, body: childCredentials });
  const { token: childToken } = await request('POST', '/warehouse/auth/login', { body: childCredentials });
  await request('GET', '/warehouse/subs', { token: childToken, expected: 403 });

  const itemId = new mongoose.Types.ObjectId();
  await WarehouseStockMovement.create([
    { warehouseId: mother._id, itemId, type: 'opening', qtyChange: 10 },
    { warehouseId: child._id, itemId, type: 'opening', qtyChange: 4 },
  ]);
  const ownHistory = await request('GET', '/warehouse/stock-movements', { token: motherToken });
  assert.deepEqual(ownHistory.map(({ qtyChange }) => qtyChange), [10]);
  const childHistory = await request('GET', '/warehouse/stock-movements', { token: childToken });
  assert.deepEqual(childHistory.map(({ qtyChange }) => qtyChange), [4]);
  const permittedHistory = await request('GET', `/warehouse/stock-movements?warehouseId=${child._id}`, { token: motherToken });
  assert.deepEqual(permittedHistory.map(({ qtyChange }) => qtyChange), [4]);
});

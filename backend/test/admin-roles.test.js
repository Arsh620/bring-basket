const test = require('node:test');
const assert = require('node:assert/strict');
const rolesController = require('../src/domains/identity/roles.controller');
const adminsController = require('../src/domains/identity/admins.controller');
const AdminRole = require('../src/models/auth/AdminRole');
const Admin = require('../src/models/auth/Admin');
const { checkAdminModule, resolveAdminRole } = require('../src/middleware/auth');
const { permissionModules, normalizeModules } = require('../src/domains/identity/admin-role-permissions');
const identityRoutes = require('../src/routes/v1/identity');

const invoke = async (handler, req) => {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextError;
  await handler(req, res, (error) => { nextError = error; });
  if (nextError) throw nextError;
  return res;
};

const stubActorRole = (t, role) => {
  const originalFindById = Admin.findById;
  t.after(() => { Admin.findById = originalFindById; });
  Admin.findById = () => ({
    select: async () => ({ status: true, zoneId: null, roleId: role }),
  });
};

test('role permission catalog matches Laravel module keys and normalizes stored JSON', () => {
  assert.ok(permissionModules.some(({ key }) => key === 'item'));
  assert.ok(permissionModules.some(({ key }) => key === 'warehouse'));
  assert.ok(permissionModules.some(({ key }) => key === 'purchase'));
  assert.ok(permissionModules.some(({ key }) => key === 'account'));
  assert.ok(permissionModules.some(({ key }) => key === 'pos'));
  assert.ok(permissionModules.some(({ key }) => key === 'custom_role'));
  assert.deepEqual(normalizeModules('["item","purchase","item"]'), ['item', 'purchase']);
  assert.deepEqual(normalizeModules('invalid'), []);
});

test('admin role lookup resolves legacy numeric role references', async (t) => {
  const originalFindById = AdminRole.findById;
  const originalFindOne = AdminRole.findOne;
  t.after(() => {
    AdminRole.findById = originalFindById;
    AdminRole.findOne = originalFindOne;
  });

  const role = { legacyId: 4, name: 'PO Creator' };
  let selectedRole = null;
  AdminRole.findById = async () => selectedRole;
  AdminRole.findOne = async (filter) => {
    assert.deepEqual(filter, { legacyId: 4 });
    return role;
  };

  assert.equal(await resolveAdminRole(4), role);
});

test('role creation rejects modules outside the Laravel permission catalog', async (t) => {
  const originalExists = AdminRole.exists;
  const originalCreate = AdminRole.create;
  stubActorRole(t, { legacyId: 1, status: true, modules: null });
  t.after(() => {
    AdminRole.exists = originalExists;
    AdminRole.create = originalCreate;
  });
  AdminRole.exists = async () => null;
  AdminRole.create = async () => {
    throw new Error('invalid permission modules must not create a role');
  };

  const response = await invoke(rolesController.create, {
    user: { id: 'master-admin', role: 'admin' },
    body: { name: 'Inventory Management', modules: ['inventory_admin'] },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'One or more permission modules are invalid');
});

test('role creation persists selected module keys on the role document', async (t) => {
  const originalExists = AdminRole.exists;
  const originalCreate = AdminRole.create;
  stubActorRole(t, { legacyId: 1, status: true, modules: null });
  t.after(() => {
    AdminRole.exists = originalExists;
    AdminRole.create = originalCreate;
  });

  let created;
  AdminRole.exists = async () => null;
  AdminRole.create = async (data) => {
    created = data;
    return { _id: '507f1f77bcf86cd799439012', ...data, status: true };
  };

  const response = await invoke(rolesController.create, {
    user: { id: 'master-admin', role: 'admin' },
    body: { name: 'QA Inventory', modules: ['item', 'warehouse'] },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(created.name, 'QA Inventory');
  assert.equal(created.modules, '["item","warehouse"]');
  assert.deepEqual(response.body.data.modules, ['item', 'warehouse']);
});

test('role creation cannot grant modules outside the acting admin role', async (t) => {
  const originalExists = AdminRole.exists;
  const originalCreate = AdminRole.create;
  stubActorRole(t, { legacyId: 4, status: true, modules: ['employee', 'item'] });
  t.after(() => {
    AdminRole.exists = originalExists;
    AdminRole.create = originalCreate;
  });
  AdminRole.exists = async () => null;
  AdminRole.create = async () => {
    throw new Error('an admin must not grant modules outside their own role');
  };

  const response = await invoke(rolesController.create, {
    user: { id: 'employee-1', role: 'admin' },
    body: { name: 'Escalated role', modules: ['item', 'purchase'] },
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.body.message, /cannot grant modules/i);
});

test('role selectors expose only roles and modules the acting admin can grant', async (t) => {
  const originalFind = AdminRole.find;
  stubActorRole(t, { legacyId: 4, status: true, modules: ['employee', 'item'] });
  t.after(() => { AdminRole.find = originalFind; });
  AdminRole.find = () => ({
    sort: async () => [
      { _id: '507f1f77bcf86cd799439012', name: 'Catalog', modules: ['item'], status: true },
      { _id: '507f1f77bcf86cd799439013', name: 'Procurement', modules: ['purchase'], status: true },
    ],
  });

  const roles = await invoke(rolesController.getAll, {
    user: { id: 'employee-1', role: 'admin' },
    query: { assignable: 'true' },
  });
  const modules = await invoke(rolesController.getPermissionModules, {
    user: { id: 'employee-1', role: 'admin' },
  });

  assert.deepEqual(roles.body.data.map(({ name }) => name), ['Catalog']);
  assert.deepEqual(modules.body.data.map(({ key }) => key), ['employee', 'item']);
});

test('employee role selector works with employee permission without custom-role permission', async (t) => {
  const originalFind = AdminRole.find;
  const originalAdminFindById = Admin.findById;
  let actorModules = ['employee', 'item'];
  Admin.findById = () => ({
    select: async () => ({
      status: true,
      zoneId: null,
      roleId: { legacyId: 9, status: true, modules: actorModules },
    }),
  });
  t.after(() => {
    AdminRole.find = originalFind;
    Admin.findById = originalAdminFindById;
  });
  AdminRole.find = (filter) => {
    assert.deepEqual(filter, { legacyId: { $ne: 1 } });
    return {
      sort: async () => [
        { _id: '507f1f77bcf86cd799439012', name: 'Catalog', modules: ['item'], status: 1 },
        { _id: '507f1f77bcf86cd799439013', name: 'Procurement', modules: ['purchase'], status: 1 },
        { _id: '507f1f77bcf86cd799439014', name: 'Disabled catalog', modules: ['item'], status: 0 },
      ],
    };
  };

  const response = await invoke(rolesController.getAssignable, {
    user: { id: 'employee-manager', role: 'admin' },
  });
  const route = identityRoutes.stack
    .find(({ route: item }) => item?.path === '/admin/employee-roles' && item.methods.get)
    .route;

  assert.equal(route.stack.length, 4);
  assert.deepEqual(response.body.data.map(({ name }) => name), ['Catalog']);
  assert.equal((await invoke(route.stack[2].handle, {
    user: { id: 'employee-manager', role: 'admin' },
  })).statusCode, 200);
  actorModules = ['custom_role'];
  assert.equal((await invoke(route.stack[2].handle, {
    user: { id: 'employee-manager', role: 'admin' },
  })).statusCode, 403);
});

test('admin role endpoints require the Laravel custom_role permission', async (t) => {
  const originalFindById = Admin.findById;
  t.after(() => { Admin.findById = originalFindById; });

  let modules = ['custom_role'];
  Admin.findById = () => ({
    select: async () => ({
      status: true,
      zoneId: null,
      roleId: { legacyId: 9, status: true, modules },
    }),
  });

  const getRoles = identityRoutes.stack
    .find(({ route }) => route?.path === '/admin/roles' && route.methods.get)
    .route.stack[2].handle;
  const createRole = identityRoutes.stack
    .find(({ route }) => route?.path === '/admin/roles' && route.methods.post)
    .route.stack[2].handle;

  assert.equal((await invoke(getRoles, { user: { id: 'employee-1', role: 'admin' } })).statusCode, 200);
  assert.equal((await invoke(createRole, { user: { id: 'employee-1', role: 'admin' } })).statusCode, 200);

  modules = ['employee'];
  assert.equal((await invoke(createRole, { user: { id: 'employee-1', role: 'admin' } })).statusCode, 403);
});

test('assigned employee roles cannot be deleted', async (t) => {
  const originalFindById = AdminRole.findById;
  const originalExists = Admin.exists;
  const originalDeleteOne = AdminRole.prototype.deleteOne;
  stubActorRole(t, { legacyId: 1, status: true, modules: null });
  t.after(() => {
    AdminRole.findById = originalFindById;
    Admin.exists = originalExists;
    AdminRole.prototype.deleteOne = originalDeleteOne;
  });

  const role = {
    _id: '507f1f77bcf86cd799439011',
    legacyId: 2,
    async deleteOne() {
      throw new Error('assigned roles must not be deleted');
    },
  };
  AdminRole.findById = async () => role;
  Admin.exists = async ({ roleId }) => {
    assert.ok(roleId.$in.includes(role._id));
    assert.ok(roleId.$in.includes(role.legacyId));
    assert.ok(roleId.$in.includes(String(role.legacyId)));
    return true;
  };

  const response = await invoke(rolesController.remove, {
    user: { id: 'master-admin', role: 'admin' },
    params: { id: role._id },
  });
  assert.equal(response.statusCode, 409);
  assert.match(response.body.message, /assigned to employees/);
});

test('employee creation rejects inactive or missing roles', async (t) => {
  const originalRoleFindById = AdminRole.findById;
  const originalAdminFindOne = Admin.findOne;
  const originalAdminCreate = Admin.create;
  stubActorRole(t, { legacyId: 1, status: true, modules: null });
  t.after(() => {
    AdminRole.findById = originalRoleFindById;
    Admin.findOne = originalAdminFindOne;
    Admin.create = originalAdminCreate;
  });

  AdminRole.findById = async () => null;
  Admin.findOne = async () => null;
  Admin.create = async () => {
    throw new Error('an inactive role must not create an employee');
  };

  const request = {
    user: { id: 'master-admin', role: 'admin' },
    body: {
      fName: 'New',
      phone: '9876543210',
      email: 'new.employee@example.com',
      password: 'Valid-temp-Password1!',
      roleId: '507f1f77bcf86cd799439011',
    },
  };
  for (const role of [null, { legacyId: 9, status: 0, modules: ['item'] }]) {
    selectedRole = role;
    const response = await invoke(adminsController.create, request);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.message, 'Select an active employee role');
  }
});

test('employee creation stores the selected role ObjectId and returns its module permissions', async (t) => {
  const originalRoleFindOne = AdminRole.findOne;
  const originalRoleFindById = AdminRole.findById;
  const originalAdminFindOne = Admin.findOne;
  const originalAdminExists = Admin.exists;
  const originalAdminCreate = Admin.create;
  stubActorRole(t, { legacyId: 4, status: true, modules: ['employee', 'item'] });
  t.after(() => {
    AdminRole.findOne = originalRoleFindOne;
    AdminRole.findById = originalRoleFindById;
    Admin.findOne = originalAdminFindOne;
    Admin.exists = originalAdminExists;
    Admin.create = originalAdminCreate;
  });

  const roleId = '507f1f77bcf86cd799439011';
  const role = { _id: roleId, legacyId: 9, name: 'Catalog Staff', status: 1, modules: ['item'] };
  let createdAdmin;
  AdminRole.findOne = async () => role;
  AdminRole.findById = async () => role;
  Admin.findOne = async () => null;
  Admin.exists = async () => false;
  Admin.create = async (data) => {
    createdAdmin = data;
    return {
      _id: '507f1f77bcf86cd799439012',
      ...data,
      toObject() { return { _id: this._id, ...data }; },
    };
  };

  const response = await invoke(adminsController.create, {
    user: { id: 'manager-1', role: 'admin' },
    body: {
      fName: 'Catalog',
      phone: '9876543210',
      email: 'catalog.employee@example.com',
      password: 'Valid-temp-Password1!',
      roleId,
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(createdAdmin.roleId, roleId);
  assert.deepEqual(response.body.data.roleId.modules, ['item']);
});

test('employee creation cannot assign a role with permissions outside the acting admin role', async (t) => {
  const originalRoleFindOne = AdminRole.findOne;
  const originalAdminCreate = Admin.create;
  stubActorRole(t, { legacyId: 4, status: true, modules: ['employee', 'item'] });
  t.after(() => {
    AdminRole.findOne = originalRoleFindOne;
    Admin.create = originalAdminCreate;
  });
  AdminRole.findOne = async () => ({ legacyId: 5, status: true, modules: ['purchase'] });
  Admin.create = async () => {
    throw new Error('an employee must not receive permissions outside the acting admin role');
  };

  const response = await invoke(adminsController.create, {
    user: { id: 'employee-1', role: 'admin' },
    body: {
      fName: 'New',
      phone: '9876543210',
      email: 'new.employee@example.com',
      password: 'Valid-temp-Password1!',
      roleId: '507f1f77bcf86cd799439011',
    },
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.body.message, /cannot assign a role/i);
});

test('employee managers cannot delete accounts with permissions beyond their own role', async (t) => {
  const originalFindById = Admin.findById;
  const originalFindByIdAndDelete = Admin.findByIdAndDelete;
  t.after(() => {
    Admin.findById = originalFindById;
    Admin.findByIdAndDelete = originalFindByIdAndDelete;
  });

  const managerId = '507f1f77bcf86cd799439010';
  const targetId = '507f1f77bcf86cd799439011';
  const manager = { status: true, roleId: { legacyId: 4, status: true, modules: ['employee', 'item'] } };
  const target = { _id: targetId, roleId: { legacyId: 5, status: true, modules: ['employee', 'purchase'] } };
  Admin.findById = (id) => {
    if (id === managerId) return { select: async () => manager };
    return Promise.resolve(target);
  };
  Admin.findByIdAndDelete = async () => {
    throw new Error('an employee manager must not delete an account with broader access');
  };

  const response = await invoke(adminsController.remove, {
    user: { id: managerId, role: 'admin' },
    params: { id: targetId },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.message, 'Not found');
});

test('employee managers cannot deactivate or delete their own login', async (t) => {
  const originalFindById = Admin.findById;
  const originalFindByIdAndUpdate = Admin.findByIdAndUpdate;
  const originalFindByIdAndDelete = Admin.findByIdAndDelete;
  t.after(() => {
    Admin.findById = originalFindById;
    Admin.findByIdAndUpdate = originalFindByIdAndUpdate;
    Admin.findByIdAndDelete = originalFindByIdAndDelete;
  });

  const adminId = '507f1f77bcf86cd799439010';
  const admin = {
    _id: adminId,
    status: true,
    roleId: { legacyId: 4, status: true, modules: ['employee', 'item'] },
  };
  Admin.findById = () => ({
    select: async () => admin,
    then(resolve, reject) { return Promise.resolve(admin).then(resolve, reject); },
  });
  Admin.findByIdAndUpdate = async () => {
    throw new Error('an employee must not deactivate their own login');
  };
  Admin.findByIdAndDelete = async () => {
    throw new Error('an employee must not delete their own login');
  };

  const request = {
    user: { id: adminId, role: 'admin' },
    params: { id: adminId },
    body: { status: false },
  };
  const deactivate = await invoke(adminsController.updateStatus, request);
  const remove = await invoke(adminsController.remove, request);

  assert.equal(deactivate.statusCode, 409);
  assert.equal(remove.statusCode, 409);
});

test('admin module middleware enforces the assigned role permissions', async (t) => {
  const originalFindById = Admin.findById;
  t.after(() => {
    Admin.findById = originalFindById;
  });

  const role = { legacyId: 2, modules: '["item","purchase"]' };
  Admin.findById = () => ({
    select() {
      return Promise.resolve({ status: true, zoneId: null, roleId: role });
    },
  });

  const request = { user: { id: 'employee-1', role: 'admin' } };
  const denied = await invoke(checkAdminModule('warehouse'), request);
  assert.equal(denied.statusCode, 403);

  let nextCalled = false;
  const allowed = await new Promise((resolve) => {
    checkAdminModule('purchase')(request, {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ statusCode: this.statusCode, body }); },
    }, () => {
      nextCalled = true;
      resolve({ statusCode: 200 });
    });
  });
  assert.equal(allowed.statusCode, 200);
  assert.equal(nextCalled, true);
});

test('admin module middleware resolves legacy numeric role references', async (t) => {
  const originalAdminFindById = Admin.findById;
  const originalRoleFindOne = AdminRole.findOne;
  t.after(() => {
    Admin.findById = originalAdminFindById;
    AdminRole.findOne = originalRoleFindOne;
  });

  Admin.findById = () => ({
    select: () => Promise.resolve({ status: true, zoneId: null, roleId: 4 }),
  });
  AdminRole.findOne = async (filter) => {
    assert.deepEqual(filter, { legacyId: 4 });
    return { legacyId: 4, status: true, modules: ['purchase'] };
  };

  const response = await invoke(checkAdminModule('purchase'), {
    user: { id: 'legacy-admin', role: 'admin' },
  });
  assert.equal(response.statusCode, 200);
});

test('admin module middleware rejects disabled roles and allows the protected super-admin role', async (t) => {
  const originalFindById = Admin.findById;
  t.after(() => {
    Admin.findById = originalFindById;
  });

  const request = { user: { id: 'employee-1', role: 'admin' } };
  const setRole = (role) => {
    Admin.findById = () => ({
      select() {
        return Promise.resolve({ status: true, zoneId: null, roleId: role });
      },
    });
  };

  setRole({ legacyId: 2, status: false, modules: ['item'] });
  const disabled = await invoke(checkAdminModule('item'), request);
  assert.equal(disabled.statusCode, 403);

  setRole({ legacyId: 1, status: true, modules: [] });
  const allowed = await new Promise((resolve) => {
    checkAdminModule('warehouse')(request, {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ statusCode: this.statusCode, body }); },
    }, () => resolve({ statusCode: 200 }));
  });
  assert.equal(allowed.statusCode, 200);
});

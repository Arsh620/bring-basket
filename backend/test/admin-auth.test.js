const test = require('node:test');
const assert = require('node:assert/strict');
const Admin = require('../src/models/auth/Admin');
const controller = require('../src/domains/identity/admin-auth.controller');

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

test('admin login marks the account as logged in after credentials are verified', async (t) => {
  const originalFindOne = Admin.findOne;
  const originalFindByIdAndUpdate = Admin.findByIdAndUpdate;
  const originalJwtSecret = process.env.JWT_SECRET;
  const adminId = '507f1f77bcf86cd799439011';
  const admin = {
    _id: adminId,
    status: true,
    roleId: { legacyId: 1, status: true, modules: [] },
    async matchPassword(password) {
      assert.equal(password, 'correct-password');
      return true;
    },
    toObject() {
      return { _id: this._id, email: 'admin@example.com' };
    },
  };
  let updatedAccount;

  t.after(() => {
    Admin.findOne = originalFindOne;
    Admin.findByIdAndUpdate = originalFindByIdAndUpdate;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  process.env.JWT_SECRET = 'test-secret';
  Admin.findOne = () => ({ select: async () => admin });
  Admin.findByIdAndUpdate = async (id, update) => {
    updatedAccount = { id, update };
  };

  const response = await invoke(controller.login, {
    body: { email: 'admin@example.com', password: 'correct-password', accountType: 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.admin.roleId.legacyId, 1);
  assert.deepEqual(updatedAccount, { id: adminId, update: { isLoggedIn: true } });
});

test('employee login returns the assigned role and cannot use the primary admin login', async (t) => {
  const employeeId = '507f1f77bcf86cd799439012';
  const role = { name: 'Technical team', legacyId: 8, status: true, modules: ['item', 'order'] };
  const employee = {
    _id: employeeId,
    status: true,
    roleId: role,
    matchPassword: async (password) => password === 'fixture-password',
    toObject: () => ({ _id: employeeId, email: 'employee@example.test' }),
  };
  const originalJwtSecret = process.env.JWT_SECRET;
  t.after(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });
  process.env.JWT_SECRET = 'test-secret';
  t.mock.method(Admin, 'findOne', () => ({ select: async () => employee }));
  const updateAccount = t.mock.method(Admin, 'findByIdAndUpdate', async () => {});

  const credentials = { email: 'employee@example.test', password: 'fixture-password' };
  const employeeResponse = await invoke(controller.login, {
    body: { ...credentials, accountType: 'employee' },
  });

  assert.equal(employeeResponse.statusCode, 200);
  assert.deepEqual(employeeResponse.body.data.admin.roleId, role);
  assert.ok(employeeResponse.body.data.token);
  assert.equal(updateAccount.mock.callCount(), 1);

  const adminResponse = await invoke(controller.login, {
    body: { ...credentials, accountType: 'admin' },
  });

  assert.equal(adminResponse.statusCode, 401);
  assert.equal(updateAccount.mock.callCount(), 1);
});

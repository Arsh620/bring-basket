const test = require('node:test');
const assert = require('node:assert/strict');
const { checkVendorModule, vendorAuth, generateToken } = require('../src/middleware/auth');
const vendorAccessController = require('../src/domains/identity/vendor-access.controller');
const identityRoutes = require('../src/routes/v1/identity');
const vendorRoutes = require('../src/routes/v1/vendor');
const { permissionModules } = require('../src/domains/identity/employee-role-permissions');
const VendorEmployee = require('../src/models/auth/VendorEmployee');
const Vendor = require('../src/models/auth/Vendor');
const Store = require('../src/models/store/Store');
const EmployeeRole = require('../src/models/auth/EmployeeRole');

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

test('vendor employee module middleware enforces assigned modules while vendor owners bypass it', async () => {
  const employeeRequest = {
    vendorContext: { isEmployee: true, role: { modules: '["item","order"]' } },
  };
  const denied = await invoke(checkVendorModule('my_shop'), employeeRequest);
  assert.equal(denied.statusCode, 403);

  let employeeAllowed = false;
  checkVendorModule('item')(employeeRequest, {}, () => { employeeAllowed = true; });
  assert.equal(employeeAllowed, true);

  let ownerAllowed = false;
  checkVendorModule('custom_role')({ vendorContext: { isEmployee: false } }, {}, () => { ownerAllowed = true; });
  assert.equal(ownerAllowed, true);
});

test('vendor employee and custom-role routes use their separate Laravel modules', async () => {
  assert.ok(permissionModules.some(({ key }) => key === 'custom_role'));

  const identityRoleGate = identityRoutes.stack
    .find(({ route }) => route?.path === '/vendor/roles' && route.methods.get)
    .route.stack[1].handle;
  const identityEmployeeGate = identityRoutes.stack
    .find(({ route }) => route?.path === '/vendor/employees' && route.methods.get)
    .route.stack[1].handle;
  const businessRoleGate = vendorRoutes.stack
    .find(({ route }) => route?.path === '/roles' && route.methods.get)
    .route.stack[0].handle;
  const businessEmployeeGate = vendorRoutes.stack
    .find(({ route }) => route?.path === '/employees' && route.methods.get)
    .route.stack[0].handle;

  const customRoleEmployee = {
    vendorContext: { isEmployee: true, role: { modules: ['custom_role'] } },
  };
  assert.equal((await invoke(identityRoleGate, customRoleEmployee)).statusCode, 200);
  assert.equal((await invoke(businessRoleGate, customRoleEmployee)).statusCode, 200);
  assert.equal((await invoke(identityEmployeeGate, customRoleEmployee)).statusCode, 403);
  assert.equal((await invoke(businessEmployeeGate, customRoleEmployee)).statusCode, 403);

  const employeeManager = {
    vendorContext: { isEmployee: true, role: { modules: ['employee'] } },
  };
  assert.equal((await invoke(identityRoleGate, employeeManager)).statusCode, 403);
  assert.equal((await invoke(businessRoleGate, employeeManager)).statusCode, 403);
  assert.equal((await invoke(identityEmployeeGate, employeeManager)).statusCode, 200);
  assert.equal((await invoke(businessEmployeeGate, employeeManager)).statusCode, 200);
});

test('employee creation rejects a store outside the authenticated vendor context', async () => {
  const response = await invoke(vendorAccessController.createEmployee, {
    vendorContext: { vendorId: 'vendor-a', storeIds: ['store-a'] },
    body: {
      fName: 'Store employee',
      email: 'employee@example.com',
      password: 'a-valid-password',
      employeeRoleId: '507f1f77bcf86cd799439011',
      storeId: 'store-b',
    },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'Select one of your stores');
});

test('add-on permission is offered and accepted only for food stores', async (t) => {
  const originalStoreFindById = Store.findById;
  const originalRoleExists = EmployeeRole.exists;
  t.after(() => {
    Store.findById = originalStoreFindById;
    EmployeeRole.exists = originalRoleExists;
  });

  let moduleType = 'grocery';
  Store.findById = () => ({
    async populate() { return { moduleId: { moduleType } }; },
  });

  const request = {
    vendorContext: { vendorId: 'vendor-a', storeIds: ['store-a'] },
    query: { storeId: 'store-a' },
  };
  const groceryPermissions = await invoke(vendorAccessController.getPermissionModules, request);
  assert.equal(groceryPermissions.body.data.some(({ key }) => key === 'addon'), false);

  moduleType = 'food';
  const foodPermissions = await invoke(vendorAccessController.getPermissionModules, request);
  assert.equal(foodPermissions.body.data.some(({ key }) => key === 'addon'), true);

  moduleType = 'grocery';
  EmployeeRole.exists = async () => null;
  const deniedRole = await invoke(vendorAccessController.createRole, {
    ...request,
    body: { name: 'Food Access', modules: ['item', 'addon'], storeId: 'store-a' },
  });
  assert.equal(deniedRole.statusCode, 400);
  assert.equal(deniedRole.body.message, 'Add-on access is not available for this store type');
});

test('delegated vendor managers can only offer and assign roles within their grants', async (t) => {
  const grantedRole = { _id: '507f1f77bcf86cd799439011', modules: '["item"]' };
  const broaderRole = { _id: '507f1f77bcf86cd799439012', modules: '["item","pos"]' };
  t.mock.method(Store, 'findById', () => ({
    populate: async () => ({ moduleId: { moduleType: 'grocery' } }),
  }));
  t.mock.method(EmployeeRole, 'find', () => ({
    sort: () => ({ lean: async () => [grantedRole, broaderRole] }),
  }));
  t.mock.method(EmployeeRole, 'findOne', async () => broaderRole);
  const create = t.mock.method(VendorEmployee, 'create', async () => assert.fail('Out-of-scope employee creation'));
  const vendorContext = {
    isEmployee: true, vendorId: 'vendor-a', storeIds: ['store-a'], role: { modules: ['custom_role', 'employee', 'item'] },
  };
  const request = { vendorContext, query: { storeId: 'store-a' } };
  const permissions = await invoke(vendorAccessController.getPermissionModules, request);
  assert.deepEqual(permissions.body.data.map(({ key }) => key).sort(), ['custom_role', 'employee', 'item']);
  const roles = await invoke(vendorAccessController.getAssignableRoles, request);
  assert.deepEqual(roles.body.data.map(({ _id }) => _id), [grantedRole._id]);

  const denied = await invoke(vendorAccessController.createEmployee, {
    vendorContext,
    body: { fName: 'Employee', email: 'employee@example.test', password: 'test-password', storeId: 'store-a', employeeRoleId: broaderRole._id },
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(create.mock.callCount(), 0);
});

test('vendor authentication rejects an employee role scoped to another store', async (t) => {
  const originalSecret = process.env.JWT_SECRET;
  const originalEmployeeFindById = VendorEmployee.findById;
  const originalVendorFindById = Vendor.findById;
  const originalStoreFindOne = Store.findOne;
  t.after(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    VendorEmployee.findById = originalEmployeeFindById;
    Vendor.findById = originalVendorFindById;
    Store.findOne = originalStoreFindOne;
  });

  process.env.JWT_SECRET = 'vendor-role-test-secret';
  VendorEmployee.findById = () => ({
    async populate() {
      return {
        status: true,
        isLoggedIn: true,
        vendorId: 'vendor-a',
        storeId: 'store-a',
        employeeRoleId: { status: true, storeId: 'store-b', modules: ['item'] },
      };
    },
  });
  Vendor.findById = async () => {
    throw new Error('an employee with a cross-store role must be rejected');
  };
  Store.findOne = async () => {
    throw new Error('an employee with a cross-store role must be rejected');
  };

  const req = {
    headers: { authorization: `Bearer ${generateToken('employee-a', 'vendor_employee')}` },
  };
  const response = await new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ statusCode: this.statusCode, body });
        return this;
      },
    };
    vendorAuth(req, res, (error) => resolve({ error }));
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.message, 'Access denied');
});

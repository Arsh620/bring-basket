const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const PurchaseVendor = require('../src/models/purchase/PurchaseVendor');
const SupplierPasswordSetupToken = require('../src/models/auth/SupplierPasswordSetupToken');
const controller = require('../src/domains/identity/supplier-password-setup.controller');

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

test('admin invitation stores only a hashed, expiring token and returns a setup link', async (t) => {
  const originalFindById = PurchaseVendor.findById;
  const originalFindOneAndUpdate = SupplierPasswordSetupToken.findOneAndUpdate;
  t.after(() => {
    PurchaseVendor.findById = originalFindById;
    SupplierPasswordSetupToken.findOneAndUpdate = originalFindOneAndUpdate;
  });

  const supplierId = '507f1f77bcf86cd799439011';
  const supplier = { _id: supplierId, email: 'supplier@example.com', status: true };
  PurchaseVendor.findById = () => ({ select: async () => supplier });
  let savedFilter;
  let savedUpdate;
  SupplierPasswordSetupToken.findOneAndUpdate = async (filter, update) => {
    savedFilter = filter;
    savedUpdate = update;
  };

  const res = await invoke(controller.createInvitation, { params: { supplierId } });
  const token = res.body.data.setupPath.split('#')[1];
  const expectedHash = crypto.createHash('sha256').update(token).digest('hex');

  assert.equal(res.statusCode, 201);
  assert.match(res.body.data.setupPath, /^\/supplier\/set-password#[a-f\d]{64}$/i);
  assert.equal(savedFilter.supplierId, supplierId);
  assert.equal(savedUpdate.$set.tokenHash, expectedHash);
  assert.equal(savedUpdate.$set.tokenHash.includes(token), false);
  assert.ok(savedUpdate.$set.expiresAt.getTime() > Date.now());
  assert.match(res.body.message, /copy and share/i);
});

test('setting a password atomically consumes the unexpired link and saves a bcrypt hash', async (t) => {
  const originalFindOneAndDelete = SupplierPasswordSetupToken.findOneAndDelete;
  const originalFindById = PurchaseVendor.findById;
  t.after(() => {
    SupplierPasswordSetupToken.findOneAndDelete = originalFindOneAndDelete;
    PurchaseVendor.findById = originalFindById;
  });

  const token = crypto.randomBytes(32).toString('hex');
  const supplierId = '507f1f77bcf86cd799439011';
  let tokenFilter;
  let saved = false;
  const supplier = {
    status: true,
    async save() { saved = true; },
  };
  SupplierPasswordSetupToken.findOneAndDelete = async (filter) => {
    tokenFilter = filter;
    return { supplierId };
  };
  PurchaseVendor.findById = async () => supplier;

  const res = await invoke(controller.setPassword, {
    body: { token, password: 'secure-password', confirmPassword: 'secure-password' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(tokenFilter.tokenHash, crypto.createHash('sha256').update(token).digest('hex'));
  assert.ok(tokenFilter.expiresAt.$gt instanceof Date);
  assert.equal(saved, true);
  assert.equal(await bcrypt.compare('secure-password', supplier.password), true);
  assert.ok(supplier.passwordSetAt instanceof Date);
  assert.equal(res.body.success, true);
});

test('password setup rejects a mismatched confirmation without consuming the token', async (t) => {
  const originalFindOneAndDelete = SupplierPasswordSetupToken.findOneAndDelete;
  t.after(() => { SupplierPasswordSetupToken.findOneAndDelete = originalFindOneAndDelete; });
  SupplierPasswordSetupToken.findOneAndDelete = async () => {
    throw new Error('A mismatched password must not consume the setup token');
  };

  const res = await invoke(controller.setPassword, {
    body: {
      token: crypto.randomBytes(32).toString('hex'),
      password: 'secure-password',
      confirmPassword: 'different-password',
    },
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /confirmation does not match/i);
});

test('password setup rejects malformed and expired tokens', async (t) => {
  const originalFindOneAndDelete = SupplierPasswordSetupToken.findOneAndDelete;
  t.after(() => { SupplierPasswordSetupToken.findOneAndDelete = originalFindOneAndDelete; });
  SupplierPasswordSetupToken.findOneAndDelete = async () => null;

  const malformed = await invoke(controller.setPassword, { body: { token: 'not-a-token' } });
  const expired = await invoke(controller.setPassword, {
    body: {
      token: crypto.randomBytes(32).toString('hex'),
      password: 'secure-password',
      confirmPassword: 'secure-password',
    },
  });

  assert.equal(malformed.statusCode, 400);
  assert.equal(expired.statusCode, 400);
  assert.match(expired.body.message, /expired/i);
});

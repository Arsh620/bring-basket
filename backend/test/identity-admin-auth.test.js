const test = require('node:test');
const assert = require('node:assert/strict');
const identityAdminAuth = require('../src/middleware/identity-admin-auth');

const invoke = async (handler, req = { headers: {} }) => {
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
  let nextCalled = false;
  let nextError;
  await handler(req, res, (error) => {
    nextCalled = !error;
    nextError = error;
  });
  if (nextError) throw nextError;
  return { res, nextCalled };
};

const stubIdentity = (t, { status = 200, body } = {}) => {
  const originalFetch = global.fetch;
  const originalIdentityUrl = process.env.IDENTITY_SERVICE_URL;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalIdentityUrl === undefined) delete process.env.IDENTITY_SERVICE_URL;
    else process.env.IDENTITY_SERVICE_URL = originalIdentityUrl;
  });
  process.env.IDENTITY_SERVICE_URL = 'http://identity:5001';
  global.fetch = async (url, options) => {
    assert.equal(url, 'http://identity:5001/api/v1/admin/auth/me');
    assert.equal(options.headers.authorization, 'Bearer signed-admin-token');
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };
};

test('Order Admin authorization trusts the active Identity-owned Super Admin role', async (t) => {
  stubIdentity(t, {
    body: {
      success: true,
      data: {
        _id: 'admin-id',
        status: true,
        roleId: { legacyId: 1, status: 1, modules: null },
      },
    },
  });

  const { nextCalled, res } = await invoke(identityAdminAuth('order'), {
    headers: { authorization: 'Bearer signed-admin-token' },
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('Order Admin authorization enforces employee modules from Identity', async (t) => {
  stubIdentity(t, {
    body: {
      success: true,
      data: {
        _id: 'employee-id',
        status: true,
        roleId: { legacyId: 4, status: 1, modules: '["purchase","order"]' },
      },
    },
  });

  const allowed = await invoke(identityAdminAuth('order'), {
    headers: { authorization: 'Bearer signed-admin-token' },
  });
  const denied = await invoke(identityAdminAuth('warehouse'), {
    headers: { authorization: 'Bearer signed-admin-token' },
  });

  assert.equal(allowed.nextCalled, true);
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.res.statusCode, 403);
});

test('Order Admin authorization fails closed when Identity is unavailable', async (t) => {
  const originalFetch = global.fetch;
  const originalIdentityUrl = process.env.IDENTITY_SERVICE_URL;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalIdentityUrl === undefined) delete process.env.IDENTITY_SERVICE_URL;
    else process.env.IDENTITY_SERVICE_URL = originalIdentityUrl;
  });
  process.env.IDENTITY_SERVICE_URL = 'http://identity:5001';
  global.fetch = async () => {
    throw new Error('identity unavailable');
  };

  const { nextCalled, res } = await invoke(identityAdminAuth('order'), {
    headers: { authorization: 'Bearer signed-admin-token' },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
});

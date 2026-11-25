const test = require('node:test');
const assert = require('node:assert/strict');
const wallet = require('../src/domains/identity/wallet.controller');
const otp = require('../src/domains/identity/customer-otp.controller');

const response = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test('legacy wallet top-up endpoint directs customers to verified Razorpay checkout', async () => {
  const res = response();
  await wallet.addFund({ body: { amount: 500 }, user: { id: 'customer-id' } }, res, (err) => { throw err; });

  assert.equal(res.statusCode, 410);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Razorpay checkout/i);
});

test('password reset reports unavailable delivery in production instead of claiming an OTP was sent', async () => {
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const res = response();
    await otp.forgotPassword({ body: { email: 'customer@example.com' } }, res, (err) => { throw err; });

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /delivery is not configured/i);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});

test('password reset rejects malformed one-time codes before database access', async () => {
  const res = response();
  await otp.verifyOtp({ body: { email: 'customer@example.com', otp: '123' } }, res, (err) => { throw err; });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /6-digit/i);
});

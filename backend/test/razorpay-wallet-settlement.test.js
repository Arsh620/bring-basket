const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const controller = require('../src/domains/store/razorpay.controller');
const Payment = require('../src/models/store/Payment');
const User = require('../src/models/auth/User');
const WalletTransaction = require('../src/models/auth/WalletTransaction');

test('captured Razorpay webhook credits the wallet and ledger only once', async (t) => {
  const originals = {
    startSession: mongoose.startSession,
    findOne: Payment.findOne,
    findOneAndUpdate: Payment.findOneAndUpdate,
    findById: Payment.findById,
    userFindById: User.findById,
    transactionCreate: WalletTransaction.create,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  };
  t.after(() => {
    mongoose.startSession = originals.startSession;
    Payment.findOne = originals.findOne;
    Payment.findOneAndUpdate = originals.findOneAndUpdate;
    Payment.findById = originals.findById;
    User.findById = originals.userFindById;
    WalletTransaction.create = originals.transactionCreate;
    if (originals.webhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = originals.webhookSecret;
  });

  process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
  const payment = {
    _id: 'payment-1',
    purpose: 'wallet_topup',
    userId: 'customer-1',
    amount: 125,
    razorpayOrderId: 'order-1',
  };
  const user = {
    _id: payment.userId,
    walletBalance: 25,
    async save() {},
  };
  const ledgerEntries = [];
  let paymentStatus = 'created';

  mongoose.startSession = async () => ({
    withTransaction: async (operation) => operation(),
    async endSession() {},
  });
  Payment.findOne = async () => ({ ...payment, status: paymentStatus });
  Payment.findOneAndUpdate = async (_filter, update) => {
    if (!['created', 'failed'].includes(paymentStatus)) return null;
    paymentStatus = update.status;
    return { ...payment, ...update };
  };
  Payment.findById = () => ({
    session: async () => ({ ...payment, status: paymentStatus }),
  });
  User.findById = () => ({
    session: async () => user,
  });
  WalletTransaction.create = async (entries) => {
    ledgerEntries.push(...entries);
  };

  const rawBody = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay-1', order_id: payment.razorpayOrderId } } },
  });
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const invokeWebhook = async () => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    let nextError;
    await controller.webhook({
      headers: { 'x-razorpay-signature': signature },
      rawBody,
      body: JSON.parse(rawBody),
    }, res, (error) => { nextError = error; });
    if (nextError) throw nextError;
    return res;
  };

  const firstResponse = await invokeWebhook();
  const duplicateResponse = await invokeWebhook();

  assert.equal(firstResponse.body.success, true);
  assert.equal(duplicateResponse.body.success, true);
  assert.equal(paymentStatus, 'paid');
  assert.equal(user.walletBalance, 150);
  assert.equal(ledgerEntries.length, 1);
  assert.equal(ledgerEntries[0].referenceType, 'razorpay');
  assert.equal(ledgerEntries[0].amount, 125);
});

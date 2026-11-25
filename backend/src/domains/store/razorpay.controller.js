const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const benefits = require('../orders/checkout-benefits.service');
const Payment = require('../../models/store/Payment');
const { orderModel } = require('../orders/order-data');
const User = require('../../models/auth/User');
const WalletTransaction = require('../../models/auth/WalletTransaction');
const { success, error } = require('../../utils/response');

const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured');
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const verifySignature = (razorpayOrderId, razorpayPaymentId, signature) => {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
};

const settlePayment = async (paymentId, { razorpayPaymentId, razorpaySignature } = {}) => {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findOneAndUpdate(
        { _id: paymentId, status: { $in: ['created', 'failed'] } },
        {
          status: 'paid',
          ...(razorpayPaymentId ? { razorpayPaymentId } : {}),
          ...(razorpaySignature ? { razorpaySignature } : {}),
        },
        { new: true, session },
      );

      if (!payment) {
        const existing = await Payment.findById(paymentId).session(session);
        if (existing?.status === 'paid') {
          result = { already_paid: true };
          return;
        }
        throw new Error('Payment is not available for settlement');
      }

      if (payment.purpose === 'wallet_topup') {
        const user = await User.findById(payment.userId).session(session);
        if (!user) throw new Error('User not found');
        user.walletBalance = Number((user.walletBalance + payment.amount).toFixed(2));
        await user.save({ session });
        await WalletTransaction.create([{
          userId: user._id,
          type: 'credit',
          amount: payment.amount,
          balance: user.walletBalance,
          referenceType: 'razorpay',
          reference: razorpayPaymentId || payment.razorpayOrderId,
          note: 'Wallet top-up via Razorpay',
        }], { session });
        // Apply wallet bonus (best-effort)
        benefits.applyWalletBonus(payment.userId, payment.amount, session).catch(() => {});
        result = { balance: user.walletBalance, amount: payment.amount };
        return;
      }

      if (payment.purpose === 'order') {
        const order = await orderModel().findOneAndUpdate(
          { _id: payment.referenceId, ownerId: String(payment.userId), paymentStatus: 'unpaid', paymentMethod: 'digital_payment', orderAmount: payment.amount },
          { $set: { paymentStatus: 'paid' } },
          { returnDocument: 'after', session },
        );
        if (!order) throw new Error('Payment could not be matched to an unpaid order at the recorded amount');
        result = { order_id: payment.referenceId };
        return;
      }

      throw new Error('Unsupported payment purpose');
    });
  } finally {
    await session.endSession();
  }

  return result;
};

// POST /payment/razorpay/create-order
// body: { purpose: 'order'|'wallet_topup', amount, order_id? }
exports.createOrder = async (req, res, next) => {
  try {
    const { purpose, amount: requestedAmount, order_id } = req.body;
    if (!['order', 'wallet_topup'].includes(purpose)) return error(res, 'Invalid purpose', 400);
    let amount = Number(requestedAmount);

    let referenceId = order_id || 'wallet';

    // For order payment — validate order belongs to user
    if (purpose === 'order') {
      if (!mongoose.isValidObjectId(order_id)) return error(res, 'Valid order_id required for order payment', 400);
      const order = await orderModel().findOne({ _id: order_id, ownerId: req.user.id, isGuest: false }).lean();
      if (!order) return error(res, 'Order not found', 404);
      if (order.paymentStatus === 'paid') return error(res, 'Order already paid', 409);
      if (order.orderStatus === 'canceled') {
        return error(res, 'This order was canceled. Place a new order to pay online.', 409);
      }
      if (order.paymentStatus !== 'unpaid' || order.paymentMethod !== 'digital_payment'
          || !['pending', 'accepted', 'confirmed', 'processing'].includes(order.orderStatus)) {
        return error(res, 'Order cannot be paid at this stage', 409);
      }
      referenceId = String(order._id);
      amount = order.orderAmount;
    }

    const amountInPaise = Math.round(amount * 100);
    if (!Number.isFinite(amount) || amountInPaise < 1 || amount > 500000) return error(res, 'Invalid amount', 400);
    amount = amountInPaise / 100;
    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `bb_${Date.now()}`,
      notes: { purpose, userId: String(req.user.id), referenceId },
    });

    const payment = await Payment.create({
      userId: req.user.id,
      purpose,
      referenceId,
      razorpayOrderId: rzpOrder.id,
      amount,
      currency: 'INR',
      status: 'created',
    });

    return success(res, {
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      payment_id: payment._id,
    }, 'Payment order created', 201);
  } catch (err) { next(err); }
};

// POST /payment/razorpay/verify
// body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
exports.verify = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return error(res, 'razorpay_order_id, razorpay_payment_id, razorpay_signature required', 400);
    }

    // Verify signature
    if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return error(res, 'Payment verification failed — invalid signature', 400);
    }

    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
      userId: req.user.id,
    });
    if (!payment) return error(res, 'Payment record not found', 404);
    if (payment.status === 'paid') return success(res, { already_paid: true }, 'Already verified');

    const razorpayPayment = await getRazorpay().payments.fetch(razorpay_payment_id);
    if (
      razorpayPayment.order_id !== razorpay_order_id
      || razorpayPayment.status !== 'captured'
      || razorpayPayment.amount !== Math.round(payment.amount * 100)
      || razorpayPayment.currency !== payment.currency
    ) {
      return error(res, 'Payment is not captured for the expected amount', 400);
    }

    const result = await settlePayment(payment._id, { razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature });
    return success(res, result, payment.purpose === 'wallet_topup' ? 'Wallet topped up' : 'Payment verified');
  } catch (err) { next(err); }
};

// POST /payment/razorpay/webhook  (raw body, no auth)
exports.webhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
      return res.status(400).json({ success: false, message: 'Missing signature' });
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.rawBody || JSON.stringify(req.body))
      .digest('hex');

    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = typeof signature === 'string' && /^[a-f0-9]{64}$/i.test(signature)
      ? Buffer.from(signature)
      : Buffer.alloc(0);
    if (
      expectedBuffer.length !== signatureBuffer.length
      || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = req.body;
    if (event.event === 'payment.captured') {
      const rzpPaymentId = event.payload?.payment?.entity?.id;
      const rzpOrderId = event.payload?.payment?.entity?.order_id;
      if (rzpOrderId && rzpPaymentId) {
        const payment = await Payment.findOne({ razorpayOrderId: rzpOrderId });
        if (payment) await settlePayment(payment._id, { razorpayPaymentId: rzpPaymentId });
      }
    }

    if (event.event === 'payment.failed') {
      const rzpOrderId = event.payload?.payment?.entity?.order_id;
      const reason = event.payload?.payment?.entity?.error_description;
      if (rzpOrderId) {
        await Payment.findOneAndUpdate(
          { razorpayOrderId: rzpOrderId, status: 'created' },
          { status: 'failed', failureReason: reason },
        );
      }
    }

    return res.json({ success: true });
  } catch (err) { next(err); }
};

// POST /payment/razorpay/refund  body: { payment_id, amount? }
exports.refund = async (req, res, next) => {
  try {
    const { payment_id, amount } = req.body;
    if (!payment_id) return error(res, 'payment_id required', 400);

    const payment = await Payment.findById(payment_id);
    if (!payment) return error(res, 'Payment not found', 404);
    if (payment.status !== 'paid') return error(res, 'Only paid payments can be refunded', 400);
    if (payment.refundId) return error(res, 'Already refunded', 409);
    if (payment.purpose === 'wallet_topup') {
      return error(res, 'Wallet top-up refunds require a wallet adjustment and are not supported here', 409);
    }

    const refundAmount = amount || payment.amount;
    const razorpay = getRazorpay();
    const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: Math.round(refundAmount * 100),
    });

    payment.status = 'refunded';
    payment.refundId = refund.id;
    payment.refundAmount = refundAmount;
    payment.refundedAt = new Date();
    await payment.save();

    return success(res, { refund_id: refund.id, amount: refundAmount }, 'Refund initiated');
  } catch (err) { next(err); }
};

// GET /payment/razorpay/history
exports.history = async (req, res, next) => {
  try {
    const payments = await Payment.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return success(res, payments);
  } catch (err) { next(err); }
};

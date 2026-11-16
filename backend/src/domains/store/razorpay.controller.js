const crypto = require('node:crypto');
const Razorpay = require('razorpay');
const Payment = require('../../models/store/Payment');
const Order = require('../orders/order.model');
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
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expected === signature;
};

// POST /payment/razorpay/create-order
// body: { purpose: 'order'|'wallet_topup', amount, order_id? }
exports.createOrder = async (req, res, next) => {
  try {
    const { purpose, amount, order_id } = req.body;
    if (!purpose || !amount) return error(res, 'purpose and amount are required', 400);
    if (!['order', 'wallet_topup'].includes(purpose)) return error(res, 'Invalid purpose', 400);
    if (amount <= 0 || amount > 500000) return error(res, 'Invalid amount', 400);

    let referenceId = order_id || 'wallet';

    // For order payment — validate order belongs to user
    if (purpose === 'order') {
      if (!order_id) return error(res, 'order_id required for order payment', 400);
      const order = await Order.findOne({ _id: order_id, ownerId: req.user.id }).lean();
      if (!order) return error(res, 'Order not found', 404);
      if (order.paymentStatus === 'paid') return error(res, 'Order already paid', 409);
      if (!['pending', 'confirmed', 'processing'].includes(order.orderStatus)) {
        return error(res, 'Order cannot be paid at this stage', 409);
      }
      referenceId = String(order._id);
    }

    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
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

    // Mark payment as paid
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = 'paid';
    await payment.save();

    // Fulfill based on purpose
    if (payment.purpose === 'wallet_topup') {
      const user = await User.findById(req.user.id);
      if (!user) return error(res, 'User not found', 404);
      user.walletBalance = Number((user.walletBalance + payment.amount).toFixed(2));
      await user.save();
      await WalletTransaction.create({
        userId: user._id,
        type: 'credit',
        amount: payment.amount,
        balance: user.walletBalance,
        referenceType: 'razorpay',
        reference: razorpay_payment_id,
        note: `Wallet top-up via Razorpay`,
      });
      return success(res, { balance: user.walletBalance, amount: payment.amount }, 'Wallet topped up');
    }

    if (payment.purpose === 'order') {
      await Order.findByIdAndUpdate(payment.referenceId, {
        paymentStatus: 'paid',
        paymentMethod: 'digital_payment',
      });
      return success(res, { order_id: payment.referenceId }, 'Order payment verified');
    }

    return success(res, null, 'Payment verified');
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

    if (expected !== signature) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = req.body;
    if (event.event === 'payment.captured') {
      const rzpPaymentId = event.payload?.payment?.entity?.id;
      const rzpOrderId = event.payload?.payment?.entity?.order_id;
      if (rzpOrderId && rzpPaymentId) {
        const payment = await Payment.findOne({ razorpayOrderId: rzpOrderId });
        if (payment && payment.status !== 'paid') {
          payment.razorpayPaymentId = rzpPaymentId;
          payment.status = 'paid';
          await payment.save();
          // Fulfill if not already done
          if (payment.purpose === 'order') {
            await Order.findByIdAndUpdate(payment.referenceId, { paymentStatus: 'paid', paymentMethod: 'digital_payment' });
          }
        }
      }
    }

    if (event.event === 'payment.failed') {
      const rzpOrderId = event.payload?.payment?.entity?.order_id;
      const reason = event.payload?.payment?.entity?.error_description;
      if (rzpOrderId) {
        await Payment.findOneAndUpdate(
          { razorpayOrderId: rzpOrderId },
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

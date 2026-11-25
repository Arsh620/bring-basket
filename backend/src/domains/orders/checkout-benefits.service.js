/**
 * checkout-benefits.service.js
 *
 * Handles all post-order financial benefits:
 *   - Cashback credit on order placed
 *   - Loyalty points earn on order delivered
 *   - Loyalty points redeem at checkout (discount)
 *   - Wallet bonus on wallet top-up
 */

const mongoose = require('mongoose');
const AppError = require('../../utils/AppError');

const money = (v) => Number(Number(v).toFixed(2));

// ── Cashback ──────────────────────────────────────────────────────────────────

/**
 * Find the best active cashback rule for a given order amount.
 * Returns null if no applicable rule found.
 */
const findApplicableCashback = async (orderAmount) => {
  const { Cashback } = require('../../models/store/CashbackModels');
  const now = new Date();
  const rules = await Cashback.find({
    status: true,
    $or: [{ startDate: null }, { startDate: { $lte: now } }],
    $or: [{ endDate: null }, { endDate: { $gte: now } }],
    minPurchase: { $lte: orderAmount },
  }).sort({ cashbackAmount: -1 }).lean();
  return rules[0] || null;
};

/**
 * Compute cashback amount from a rule.
 */
const computeCashback = (rule, orderAmount) => {
  if (!rule) return 0;
  let amount = rule.cashbackType === 'percentage'
    ? money(orderAmount * rule.cashbackAmount / 100)
    : money(rule.cashbackAmount);
  if (rule.maxDiscount > 0) amount = Math.min(amount, rule.maxDiscount);
  return money(amount);
};

/**
 * Credit cashback to user wallet after order is placed.
 * Called inside a session if available, otherwise standalone.
 */
const creditCashback = async (userId, orderId, orderAmount, session = null) => {
  const { Cashback, CashbackHistory } = require('../../models/store/CashbackModels');
  const User = require('../../models/auth/User');
  const WalletTransaction = require('../../models/auth/WalletTransaction');

  const rule = await findApplicableCashback(orderAmount);
  if (!rule) return null;

  // Per-user limit check
  if (rule.sameUserLimit > 0) {
    const used = await CashbackHistory.countDocuments({ userId, cashbackId: rule._id });
    if (used >= rule.sameUserLimit) return null;
  }

  const cashbackAmount = computeCashback(rule, orderAmount);
  if (cashbackAmount <= 0) return null;

  const opts = session ? { session } : {};

  const user = await User.findById(userId).session(session);
  if (!user) return null;
  user.walletBalance = money(user.walletBalance + cashbackAmount);
  await user.save(opts);

  await WalletTransaction.create([{
    userId,
    type: 'credit',
    amount: cashbackAmount,
    balance: user.walletBalance,
    referenceType: 'cashback',
    reference: orderId,
    note: `Cashback for order`,
  }], opts);

  await CashbackHistory.create([{
    userId,
    orderId,
    cashbackId: rule._id,
    amount: cashbackAmount,
    type: 'cashback',
  }], opts);

  // Increment totalUsed on cashback rule (best-effort, no session needed)
  Cashback.updateOne({ _id: rule._id }, { $inc: { totalUsed: 1 } }).catch(() => {});

  return { cashbackId: rule._id, amount: cashbackAmount };
};

// ── Loyalty Points Earn ───────────────────────────────────────────────────────

/**
 * Credit loyalty points to user when order is delivered.
 * Rate: 1 point per ₹ spent (configurable via LOYALTY_EARN_RATE env, default 1).
 */
const earnLoyaltyPoints = async (userId, orderId, orderAmount) => {
  const User = require('../../models/auth/User');
  const LoyaltyTransaction = require('../../models/auth/LoyaltyTransaction');

  const rate = Number(process.env.LOYALTY_EARN_RATE) || 1; // points per ₹
  const points = Math.floor(orderAmount * rate);
  if (points <= 0) return null;

  const session = await mongoose.startSession();
  try {
    let tx;
    await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      if (!user) return;
      user.loyaltyPoint = (user.loyaltyPoint || 0) + points;
      await user.save({ session });
      [tx] = await LoyaltyTransaction.create([{
        userId,
        type: 'credit',
        points,
        balance: user.loyaltyPoint,
        transactionType: 'order_earn',
        referenceId: orderId,
        note: `Earned on order delivery`,
      }], { session });
    });
    return tx || null;
  } finally {
    await session.endSession();
  }
};

// ── Loyalty Points Redeem ─────────────────────────────────────────────────────

/**
 * Validate and compute loyalty point redemption discount.
 * Returns { pointsToRedeem, discountAmount } or throws.
 *
 * Rules:
 *   - LOYALTY_REDEEM_RATE: points needed per ₹ discount (default 10)
 *   - LOYALTY_MAX_REDEEM_PERCENT: max % of order amount redeemable (default 20)
 */
const computeLoyaltyRedemption = (userPoints, orderAmount, pointsRequested) => {
  const redeemRate = Number(process.env.LOYALTY_REDEEM_RATE) || 10; // points per ₹
  const maxPercent = Number(process.env.LOYALTY_MAX_REDEEM_PERCENT) || 20;

  if (!Number.isInteger(pointsRequested) || pointsRequested <= 0) {
    throw new AppError('loyalty_points_to_redeem must be a positive integer', 400);
  }
  if (pointsRequested > userPoints) {
    throw new AppError('Insufficient loyalty points', 400);
  }

  const maxDiscount = money(orderAmount * maxPercent / 100);
  let discountAmount = money(pointsRequested / redeemRate);
  discountAmount = Math.min(discountAmount, maxDiscount);
  const pointsToRedeem = Math.ceil(discountAmount * redeemRate);

  return { pointsToRedeem, discountAmount: money(discountAmount) };
};

/**
 * Debit loyalty points from user during order placement (inside a session).
 */
const redeemLoyaltyPoints = async (userId, orderId, pointsToRedeem, session) => {
  const User = require('../../models/auth/User');
  const LoyaltyTransaction = require('../../models/auth/LoyaltyTransaction');

  const user = await User.findById(userId).session(session);
  if (!user) throw new AppError('User not found', 404);
  if (user.loyaltyPoint < pointsToRedeem) throw new AppError('Insufficient loyalty points', 400);

  user.loyaltyPoint -= pointsToRedeem;
  await user.save({ session });

  await LoyaltyTransaction.create([{
    userId,
    type: 'debit',
    points: pointsToRedeem,
    balance: user.loyaltyPoint,
    transactionType: 'order_redeem',
    referenceId: orderId,
    note: 'Redeemed at checkout',
  }], { session });
};

// ── Wallet Bonus on Top-up ────────────────────────────────────────────────────

/**
 * Apply wallet bonus when customer adds funds to wallet.
 * Called after successful wallet top-up (Razorpay or manual).
 */
const applyWalletBonus = async (userId, topUpAmount, session = null) => {
  const WalletBonus = require('../../models/store/WalletBonus');
  const User = require('../../models/auth/User');
  const WalletTransaction = require('../../models/auth/WalletTransaction');

  const now = new Date();
  const bonus = await WalletBonus.findOne({
    status: true,
    minimumAddAmount: { $lte: topUpAmount },
    $or: [{ startDate: null }, { startDate: { $lte: now } }],
    $or: [{ endDate: null }, { endDate: { $gte: now } }],
  }).sort({ bonusAmount: -1 }).lean();

  if (!bonus) return null;

  let bonusAmount = bonus.bonusType === 'percentage'
    ? money(topUpAmount * bonus.bonusAmount / 100)
    : money(bonus.bonusAmount);
  if (bonus.maximumBonusAmount > 0) bonusAmount = Math.min(bonusAmount, bonus.maximumBonusAmount);
  bonusAmount = money(bonusAmount);
  if (bonusAmount <= 0) return null;

  const opts = session ? { session } : {};
  const user = await User.findById(userId).session(session);
  if (!user) return null;
  user.walletBalance = money(user.walletBalance + bonusAmount);
  await user.save(opts);

  await WalletTransaction.create([{
    userId,
    type: 'credit',
    amount: bonusAmount,
    balance: user.walletBalance,
    referenceType: 'wallet_bonus',
    note: `Wallet bonus: ${bonus.title}`,
  }], opts);

  return { bonusId: bonus._id, amount: bonusAmount };
};

module.exports = {
  findApplicableCashback,
  computeCashback,
  creditCashback,
  earnLoyaltyPoints,
  computeLoyaltyRedemption,
  redeemLoyaltyPoints,
  applyWalletBonus,
};

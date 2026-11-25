const mongoose = require('mongoose');
const { MembershipPlan, CustomerSubscription } = require('../../models/store/membership/MembershipModels');
const { Cashback, CashbackHistory } = require('../../models/store/CashbackModels');
const WalletBonus = require('../../models/store/WalletBonus');
const LoyaltyTransaction = require('../../models/auth/LoyaltyTransaction');
const User = require('../../models/auth/User');
const WalletTransaction = require('../../models/auth/WalletTransaction');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

const money = (v) => Number(Number(v).toFixed(2));

const isId = (id) => mongoose.isValidObjectId(id);
const requireId = (id, label) => { if (!isId(id)) throw new AppError(`Invalid ${label} ID`, 400); };

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBERSHIP PLANS
// ═══════════════════════════════════════════════════════════════════════════════

const PLAN_WRITABLE = [
  'name', 'tier', 'billingCycle', 'price', 'savingsText', 'features',
  'badge', 'minOrderValue', 'minMonthlyCartValue', 'walletRedemptionPercent',
  'loyaltyPointMinimum', 'pointExchangeRate', 'status',
];

const pickPlan = (body) => Object.fromEntries(
  PLAN_WRITABLE.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]),
);

const validatePlan = (fields) => {
  if (fields.tier && !['silver', 'gold'].includes(fields.tier)) throw new AppError('tier must be silver or gold', 400);
  if (fields.billingCycle && !['monthly', 'annual'].includes(fields.billingCycle)) throw new AppError('billingCycle must be monthly or annual', 400);
  if (fields.price !== undefined && (typeof fields.price !== 'number' || fields.price < 0)) throw new AppError('price must be >= 0', 400);
  if (fields.walletRedemptionPercent !== undefined && (fields.walletRedemptionPercent < 0 || fields.walletRedemptionPercent > 100)) throw new AppError('walletRedemptionPercent must be 0-100', 400);
};

const getPlans = async (query = {}) => {
  const filter = {};
  if (query.status !== undefined) filter.status = query.status === 'true' || query.status === true;
  const plans = await MembershipPlan.find(filter).sort({ tier: 1, billingCycle: 1 }).lean();
  return plans;
};

const getPlan = async (id) => {
  requireId(id, 'plan');
  const plan = await MembershipPlan.findById(id);
  if (!plan) throw new AppError('Membership plan not found', 404);
  return plan;
};

const createPlan = async (body) => {
  const fields = pickPlan(body);
  if (!fields.name?.trim()) throw new AppError('name is required', 400);
  if (!fields.tier) throw new AppError('tier is required', 400);
  if (!fields.billingCycle) throw new AppError('billingCycle is required', 400);
  if (fields.price === undefined) throw new AppError('price is required', 400);
  validatePlan(fields);
  return MembershipPlan.create(fields);
};

const updatePlan = async (id, body) => {
  requireId(id, 'plan');
  const fields = pickPlan(body);
  if (!Object.keys(fields).length) throw new AppError('No valid fields to update', 400);
  validatePlan(fields);
  const plan = await MembershipPlan.findByIdAndUpdate(id, fields, { new: true, runValidators: true });
  if (!plan) throw new AppError('Membership plan not found', 404);
  return plan;
};

const togglePlan = async (id) => {
  requireId(id, 'plan');
  const plan = await MembershipPlan.findById(id);
  if (!plan) throw new AppError('Membership plan not found', 404);
  plan.status = !plan.status;
  await plan.save();
  return plan;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const getSubscriptions = async (query = {}) => {
  const { skip, page, limit } = paginate(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.userId) { requireId(query.userId, 'user'); filter.userId = query.userId; }
  if (query.planId) { requireId(query.planId, 'plan'); filter.membershipPlanId = query.planId; }

  const now = new Date();
  if (query.window === 'expiring') {
    filter.status = 'active';
    filter.endDate = { $gte: now, $lte: new Date(now.getTime() + 7 * 86400000) };
  } else if (query.window === 'expired') {
    filter.endDate = { $lt: now };
  }

  const [subs, total] = await Promise.all([
    CustomerSubscription.find(filter)
      .populate('userId', 'fName lName phone email')
      .populate('membershipPlanId', 'name tier billingCycle')
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CustomerSubscription.countDocuments(filter),
  ]);
  return { subs, total, page, limit, pages: Math.ceil(total / limit) };
};

const subscribeCustomer = async (userId, planId, pricePaid = 0, purchasedVia = 'admin', orderId = null) => {
  requireId(userId, 'user');
  requireId(planId, 'plan');

  const [user, plan] = await Promise.all([
    User.findById(userId),
    MembershipPlan.findById(planId),
  ]);
  if (!user) throw new AppError('User not found', 404);
  if (!plan || !plan.status) throw new AppError('Membership plan not found or inactive', 404);

  const now = new Date();
  const endDate = new Date(now);
  if (plan.billingCycle === 'annual') endDate.setFullYear(endDate.getFullYear() + 1);
  else endDate.setMonth(endDate.getMonth() + 1);

  // Cancel any existing active subscription
  await CustomerSubscription.updateMany(
    { userId, status: 'active' },
    { $set: { status: 'upgraded' } },
  );

  const sub = await CustomerSubscription.create({
    userId,
    membershipPlanId: planId,
    tier: plan.tier,
    billingCycle: plan.billingCycle,
    pricePaid: money(pricePaid),
    startDate: now,
    endDate,
    status: 'active',
    purchasedVia,
    orderId: orderId || undefined,
  });

  await User.findByIdAndUpdate(userId, {
    currentMembershipTier: plan.tier,
    membershipExpiresAt: endDate,
  });

  return sub;
};

const updateSubscriptionStatus = async (id, status) => {
  requireId(id, 'subscription');
  const VALID = ['active', 'cancelled', 'expired', 'upgraded'];
  if (!VALID.includes(status)) throw new AppError(`status must be one of: ${VALID.join(', ')}`, 400);

  const sub = await CustomerSubscription.findById(id);
  if (!sub) throw new AppError('Subscription not found', 404);
  if (status === 'active' && sub.endDate < new Date()) throw new AppError('Expired subscription cannot be reactivated', 409);

  sub.status = status;
  await sub.save();

  // Sync user tier
  const activeSub = await CustomerSubscription.findOne({ userId: sub.userId, status: 'active', endDate: { $gte: new Date() } })
    .populate('membershipPlanId', 'tier');
  await User.findByIdAndUpdate(sub.userId, {
    currentMembershipTier: activeSub?.membershipPlanId?.tier || 'free',
    membershipExpiresAt: activeSub?.endDate || null,
  });

  return sub;
};

const getMembershipDashboard = async () => {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);
  const [active, expiring, expired, plans] = await Promise.all([
    CustomerSubscription.countDocuments({ status: 'active', endDate: { $gte: now } }),
    CustomerSubscription.countDocuments({ status: 'active', endDate: { $gte: now, $lte: in7Days } }),
    CustomerSubscription.countDocuments({ endDate: { $lt: now } }),
    MembershipPlan.countDocuments(),
  ]);
  return { active, expiring, expired, plans };
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOYALTY POINTS
// ═══════════════════════════════════════════════════════════════════════════════

const getLoyaltyTransactions = async (query = {}) => {
  const { skip, page, limit } = paginate(query);
  const filter = {};
  if (query.userId) { requireId(query.userId, 'user'); filter.userId = query.userId; }
  if (query.transactionType) filter.transactionType = query.transactionType;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to)   filter.createdAt.$lte = new Date(query.to + 'T23:59:59Z');
  }

  const [transactions, total, summary] = await Promise.all([
    LoyaltyTransaction.find(filter)
      .populate('userId', 'fName lName phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LoyaltyTransaction.countDocuments(filter),
    LoyaltyTransaction.aggregate([
      { $match: filter },
      { $group: { _id: null, totalCredit: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$points', 0] } }, totalDebit: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$points', 0] } } } },
    ]),
  ]);

  return {
    transactions, total, page, limit, pages: Math.ceil(total / limit),
    summary: { totalCredit: summary[0]?.totalCredit || 0, totalDebit: summary[0]?.totalDebit || 0 },
  };
};

const adjustLoyaltyPoints = async (userId, points, type, note = '') => {
  requireId(userId, 'user');
  const pts = Number(points);
  if (!Number.isFinite(pts) || pts <= 0) throw new AppError('points must be a positive number', 400);
  if (!['credit', 'debit'].includes(type)) throw new AppError('type must be credit or debit', 400);

  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  if (type === 'debit' && user.loyaltyPoint < pts) throw new AppError('Insufficient loyalty points', 400);

  const newBalance = type === 'credit'
    ? user.loyaltyPoint + pts
    : user.loyaltyPoint - pts;

  const session = await mongoose.startSession();
  let tx;
  try {
    await session.withTransaction(async () => {
      user.loyaltyPoint = newBalance;
      await user.save({ session });
      [tx] = await LoyaltyTransaction.create([{
        userId,
        type,
        points: pts,
        balance: newBalance,
        transactionType: type === 'credit' ? 'admin_credit' : 'admin_debit',
        note: note || `Admin ${type}`,
      }], { session });
    });
  } finally {
    await session.endSession();
  }
  return tx;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CASHBACK
// ═══════════════════════════════════════════════════════════════════════════════

const CASHBACK_WRITABLE = ['title', 'cashbackType', 'cashbackAmount', 'minPurchase', 'maxDiscount', 'sameUserLimit', 'startDate', 'endDate', 'status'];
const pickCashback = (body) => Object.fromEntries(CASHBACK_WRITABLE.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

const getCashbacks = async (query = {}) => {
  const { skip, page, limit } = paginate(query);
  const filter = {};
  if (query.status !== undefined) filter.status = query.status === 'true' || query.status === true;
  const [cashbacks, total] = await Promise.all([
    Cashback.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Cashback.countDocuments(filter),
  ]);
  return { cashbacks, total, page, limit, pages: Math.ceil(total / limit) };
};

const createCashback = async (body) => {
  const fields = pickCashback(body);
  if (!fields.title?.trim()) throw new AppError('title is required', 400);
  if (!fields.cashbackType) throw new AppError('cashbackType is required', 400);
  if (!['percentage', 'fixed'].includes(fields.cashbackType)) throw new AppError('cashbackType must be percentage or fixed', 400);
  if (fields.cashbackAmount === undefined || fields.cashbackAmount < 0) throw new AppError('cashbackAmount must be >= 0', 400);
  return Cashback.create(fields);
};

const updateCashback = async (id, body) => {
  requireId(id, 'cashback');
  const fields = pickCashback(body);
  if (!Object.keys(fields).length) throw new AppError('No valid fields to update', 400);
  const cb = await Cashback.findByIdAndUpdate(id, fields, { new: true, runValidators: true });
  if (!cb) throw new AppError('Cashback not found', 404);
  return cb;
};

const toggleCashback = async (id) => {
  requireId(id, 'cashback');
  const cb = await Cashback.findById(id);
  if (!cb) throw new AppError('Cashback not found', 404);
  cb.status = !cb.status;
  await cb.save();
  return cb;
};

const removeCashback = async (id) => {
  requireId(id, 'cashback');
  const cb = await Cashback.findByIdAndDelete(id);
  if (!cb) throw new AppError('Cashback not found', 404);
};

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET BONUS
// ═══════════════════════════════════════════════════════════════════════════════

const BONUS_WRITABLE = ['title', 'description', 'bonusType', 'bonusAmount', 'minimumAddAmount', 'maximumBonusAmount', 'startDate', 'endDate', 'status'];
const pickBonus = (body) => Object.fromEntries(BONUS_WRITABLE.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

const getWalletBonuses = async (query = {}) => {
  const { skip, page, limit } = paginate(query);
  const filter = {};
  if (query.status !== undefined) filter.status = query.status === 'true' || query.status === true;
  const [bonuses, total] = await Promise.all([
    WalletBonus.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    WalletBonus.countDocuments(filter),
  ]);
  return { bonuses, total, page, limit, pages: Math.ceil(total / limit) };
};

const createWalletBonus = async (body) => {
  const fields = pickBonus(body);
  if (!fields.title?.trim()) throw new AppError('title is required', 400);
  if (!fields.bonusType) throw new AppError('bonusType is required', 400);
  if (!['percentage', 'fixed'].includes(fields.bonusType)) throw new AppError('bonusType must be percentage or fixed', 400);
  if (fields.bonusAmount === undefined || fields.bonusAmount < 0) throw new AppError('bonusAmount must be >= 0', 400);
  return WalletBonus.create(fields);
};

const updateWalletBonus = async (id, body) => {
  requireId(id, 'wallet bonus');
  const fields = pickBonus(body);
  if (!Object.keys(fields).length) throw new AppError('No valid fields to update', 400);
  const bonus = await WalletBonus.findByIdAndUpdate(id, fields, { new: true, runValidators: true });
  if (!bonus) throw new AppError('Wallet bonus not found', 404);
  return bonus;
};

const toggleWalletBonus = async (id) => {
  requireId(id, 'wallet bonus');
  const bonus = await WalletBonus.findById(id);
  if (!bonus) throw new AppError('Wallet bonus not found', 404);
  bonus.status = !bonus.status;
  await bonus.save();
  return bonus;
};

const removeWalletBonus = async (id) => {
  requireId(id, 'wallet bonus');
  const bonus = await WalletBonus.findByIdAndDelete(id);
  if (!bonus) throw new AppError('Wallet bonus not found', 404);
};

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET FUND (admin adds funds to customer wallet)
// ═══════════════════════════════════════════════════════════════════════════════

const addWalletFund = async (userId, amount, note = '') => {
  requireId(userId, 'user');
  const amt = money(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) throw new AppError('amount must be a positive number', 400);

  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  const session = await mongoose.startSession();
  let tx;
  try {
    await session.withTransaction(async () => {
      user.walletBalance = money(user.walletBalance + amt);
      await user.save({ session });
      [tx] = await WalletTransaction.create([{
        userId,
        type: 'credit',
        amount: amt,
        balance: user.walletBalance,
        referenceType: 'admin_fund',
        note: note || 'Admin wallet top-up',
      }], { session });
    });
  } finally {
    await session.endSession();
  }
  return { walletBalance: user.walletBalance, transaction: tx };
};

module.exports = {
  // Membership
  getPlans, getPlan, createPlan, updatePlan, togglePlan,
  // Subscriptions
  getSubscriptions, subscribeCustomer, updateSubscriptionStatus, getMembershipDashboard,
  // Loyalty
  getLoyaltyTransactions, adjustLoyaltyPoints,
  // Cashback
  getCashbacks, createCashback, updateCashback, toggleCashback, removeCashback,
  // Wallet Bonus
  getWalletBonuses, createWalletBonus, updateWalletBonus, toggleWalletBonus, removeWalletBonus,
  // Wallet Fund
  addWalletFund,
};

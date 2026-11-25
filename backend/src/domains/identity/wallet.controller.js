const User = require('../../models/auth/User');
const WalletTransaction = require('../../models/auth/WalletTransaction');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

const WalletBonus = require('../../models/store/WalletBonus');

// GET /customer/wallet/transactions
exports.transactions = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const [txns, total] = await Promise.all([
      WalletTransaction.find({ userId: req.user.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WalletTransaction.countDocuments({ userId: req.user.id }),
    ]);
    return paginated(res, txns, total, page, limit);
  } catch (err) { next(err); }
};

// GET /customer/wallet/balance
exports.balance = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('walletBalance').lean();
    if (!user) return error(res, 'User not found', 404);
    return success(res, { balance: user.walletBalance });
  } catch (err) { next(err); }
};

// GET /customer/wallet/bonuses
exports.bonuses = async (req, res, next) => {
  try {
    const now = new Date();
    const bonuses = await WalletBonus.find({
      status: true,
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      ],
    }).lean();
    return success(res, bonuses);
  } catch (err) { next(err); }
};

// POST /customer/wallet/add-fund
// Wallet funds must only be credited after a payment provider confirms payment.
exports.addFund = async (req, res, next) => {
  try {
    return error(res, 'Use Razorpay checkout to add wallet funds', 410);
  } catch (err) {
    next(err);
  }
};

// Admin: POST /admin/customers/:id/wallet/add-fund
exports.adminAddFund = async (req, res, next) => {
  try {
    const { amount, note } = req.body;
    if (!amount || amount <= 0) return error(res, 'amount must be positive', 400);
    const user = await User.findById(req.params.id);
    if (!user) return error(res, 'User not found', 404);
    user.walletBalance = Number((user.walletBalance + amount).toFixed(2));
    await user.save();
    await WalletTransaction.create({ userId: user._id, type: 'credit', amount, balance: user.walletBalance, referenceType: 'admin', note: note || 'Admin credit' });
    return success(res, { balance: user.walletBalance });
  } catch (err) { next(err); }
};

// Internal helper - credit/debit wallet (used by order service etc.)
exports.creditWallet = async (userId, amount, reference, referenceType, note) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  user.walletBalance = Number((user.walletBalance + amount).toFixed(2));
  await user.save();
  await WalletTransaction.create({
    userId,
    type: 'credit',
    amount,
    balance: user.walletBalance,
    reference,
    referenceType,
    note,
  });
  return user.walletBalance;
};

exports.debitWallet = async (userId, amount, reference, referenceType, note) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (user.walletBalance < amount) throw new Error('Insufficient wallet balance');
  user.walletBalance = Number((user.walletBalance - amount).toFixed(2));
  await user.save();
  await WalletTransaction.create({
    userId,
    type: 'debit',
    amount,
    balance: user.walletBalance,
    reference,
    referenceType,
    note,
  });
  return user.walletBalance;
};

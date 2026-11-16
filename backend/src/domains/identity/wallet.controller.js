const mongoose = require('mongoose');
const User = require('../../models/auth/User');
const WalletTransaction = require('../../models/auth/WalletTransaction');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

// Wallet bonus model (lazy require to avoid circular)
const getWalletBonus = () => {
  try { return require('../../models/store/WalletBonus'); } catch { return null; }
};

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
    const WalletBonus = getWalletBonus();
    if (!WalletBonus) return success(res, []);
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

// POST /customer/wallet/add-fund  body: { amount, payment_method }
// For now: direct credit (payment gateway integration in Phase 6)
exports.addFund = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return error(res, 'amount must be positive', 400);
    if (amount > 100000) return error(res, 'Maximum add fund amount is ₹1,00,000', 400);

    const user = await User.findById(req.user.id);
    if (!user) return error(res, 'User not found', 404);

    // Check for applicable wallet bonus
    let bonusAmount = 0;
    const WalletBonus = getWalletBonus();
    if (WalletBonus) {
      const now = new Date();
      const bonus = await WalletBonus.findOne({
        status: true,
        bonusType: 'percentage',
        minimumAddAmount: { $lte: amount },
        $and: [
          { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
          { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
        ],
      }).sort({ bonusAmount: -1 });
      if (bonus) {
        bonusAmount = Number(((amount * bonus.bonusAmount) / 100).toFixed(2));
        if (bonus.maximumBonusAmount > 0) bonusAmount = Math.min(bonusAmount, bonus.maximumBonusAmount);
      }
    }

    const totalCredit = Number((amount + bonusAmount).toFixed(2));
    user.walletBalance = Number((user.walletBalance + totalCredit).toFixed(2));
    await user.save();

    await WalletTransaction.create({
      userId: user._id, type: 'credit', amount: totalCredit,
      balance: user.walletBalance, referenceType: 'bonus',
      note: bonusAmount > 0 ? `Added ₹${amount} + ₹${bonusAmount} bonus` : `Added ₹${amount}`,
    });

    return success(res, { balance: user.walletBalance, added: amount, bonus: bonusAmount });
  } catch (err) { next(err); }
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

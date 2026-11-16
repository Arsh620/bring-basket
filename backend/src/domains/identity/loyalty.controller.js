const User = require('../../models/auth/User');
const LoyaltyTransaction = require('../../models/auth/LoyaltyTransaction');
const WalletTransaction = require('../../models/auth/WalletTransaction');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

// GET /customer/loyalty-point/transactions
exports.transactions = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const [txns, total] = await Promise.all([
      LoyaltyTransaction.find({ userId: req.user.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      LoyaltyTransaction.countDocuments({ userId: req.user.id }),
    ]);
    const user = await User.findById(req.user.id).select('loyaltyPoint').lean();
    return paginated(res, { balance: user?.loyaltyPoint || 0, transactions: txns }, total, page, limit);
  } catch (err) { next(err); }
};

// POST /customer/loyalty-point/point-transfer  body: { points }
// Convert loyalty points to wallet balance (1 point = 1 INR by default)
exports.pointTransfer = async (req, res, next) => {
  try {
    const { points } = req.body;
    if (!points || points <= 0) return error(res, 'points must be positive', 400);

    const user = await User.findById(req.user.id);
    if (!user) return error(res, 'User not found', 404);
    if (user.loyaltyPoint < points) return error(res, 'Insufficient loyalty points', 400);

    const conversionRate = 1; // 1 point = 1 INR (configurable later via settings)
    const walletAmount = Number((points * conversionRate).toFixed(2));

    user.loyaltyPoint = Number((user.loyaltyPoint - points).toFixed(3));
    user.walletBalance = Number((user.walletBalance + walletAmount).toFixed(2));
    await user.save();

    await LoyaltyTransaction.create({
      userId: user._id,
      type: 'debit',
      points,
      balance: user.loyaltyPoint,
      transactionType: 'convert_to_wallet',
      note: `Converted ${points} points to ₹${walletAmount} wallet balance`,
    });

    await WalletTransaction.create({
      userId: user._id,
      type: 'credit',
      amount: walletAmount,
      balance: user.walletBalance,
      referenceType: 'loyalty_convert',
      note: `Converted from ${points} loyalty points`,
    });

    return success(res, { loyaltyPoint: user.loyaltyPoint, walletBalance: user.walletBalance }, 'Points transferred to wallet');
  } catch (err) { next(err); }
};

// Internal helper — credit loyalty points (called after order delivery)
exports.creditPoints = async (userId, points, orderId, note) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  user.loyaltyPoint = Number((user.loyaltyPoint + points).toFixed(3));
  await user.save();
  await LoyaltyTransaction.create({
    userId,
    type: 'credit',
    points,
    balance: user.loyaltyPoint,
    transactionType: 'order_earn',
    referenceId: orderId,
    note: note || `Earned from order`,
  });
  return user.loyaltyPoint;
};

// Internal helper — debit loyalty points (called at checkout)
exports.debitPoints = async (userId, points, orderId, note) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (user.loyaltyPoint < points) throw new Error('Insufficient loyalty points');
  user.loyaltyPoint = Number((user.loyaltyPoint - points).toFixed(3));
  await user.save();
  await LoyaltyTransaction.create({
    userId,
    type: 'debit',
    points,
    balance: user.loyaltyPoint,
    transactionType: 'order_redeem',
    referenceId: orderId,
    note: note || `Redeemed on order`,
  });
  return user.loyaltyPoint;
};

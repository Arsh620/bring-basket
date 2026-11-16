const DeliveryMan = require('../../models/auth/DeliveryMan');
const DMWalletTransaction = require('../../models/auth/DMWalletTransaction');
const Order = require('../orders/order.model');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

// GET /deliveryman/wallet/balance
exports.balance = async (req, res, next) => {
  try {
    const dm = await DeliveryMan.findById(req.user.id).select('walletBalance pendingCash').lean();
    if (!dm) return error(res, 'Not found', 404);
    return success(res, {
      balance: dm.walletBalance || 0,
      pendingCash: dm.pendingCash || 0,
    });
  } catch (err) { next(err); }
};

// GET /deliveryman/wallet/transactions?page=&limit=
exports.transactions = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const [txns, total] = await Promise.all([
      DMWalletTransaction.find({ dmId: req.user.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      DMWalletTransaction.countDocuments({ dmId: req.user.id }),
    ]);
    return paginated(res, txns, total, page, limit);
  } catch (err) { next(err); }
};

// GET /deliveryman/earnings?page=&limit=
// Per-order earnings summary
exports.earnings = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const [orders, total] = await Promise.all([
      Order.find({ deliverymanId: req.user.id, orderStatus: 'delivered' })
        .select('orderNumber storeName orderAmount deliveryCharge deliveredAt createdAt')
        .sort({ deliveredAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({ deliverymanId: req.user.id, orderStatus: 'delivered' }),
    ]);

    const dm = await DeliveryMan.findById(req.user.id).select('walletBalance pendingCash orderCount').lean();

    return paginated(res, {
      summary: {
        totalDeliveries: dm?.orderCount || 0,
        walletBalance: dm?.walletBalance || 0,
        pendingCash: dm?.pendingCash || 0,
      },
      orders,
    }, total, page, limit);
  } catch (err) { next(err); }
};

// Internal helper — credit DM wallet after delivery
exports.creditEarning = async (dmId, orderId, amount, note) => {
  const dm = await DeliveryMan.findById(dmId);
  if (!dm) throw new Error('Delivery man not found');
  dm.walletBalance = Number(((dm.walletBalance || 0) + amount).toFixed(2));
  await dm.save();
  await DMWalletTransaction.create({
    dmId, type: 'credit', amount,
    balance: dm.walletBalance,
    referenceType: 'order_earning',
    orderId,
    note: note || 'Delivery earning',
  });
  return dm.walletBalance;
};

const mongoose = require('mongoose');
const DeliveryMan = require('../../models/auth/DeliveryMan');
const DMWalletTransaction = require('../../models/auth/DMWalletTransaction');
const DMDisbursement = require('../../models/auth/DMDisbursement');
const DMVehicle = require('../../models/auth/DMVehicle');
const DMReview = require('../../models/auth/DMReview');
const Order = require('../orders/order.model');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

const money = (v) => Number(Number(v).toFixed(2));

// ── Vehicles ──────────────────────────────────────────────────────────────────
const getVehicles = (activeOnly = false) =>
  DMVehicle.find(activeOnly ? { isActive: true } : {}).sort({ createdAt: -1 });

const createVehicle = async (body) => {
  if (!body.name?.trim()) throw new AppError('name is required', 400);
  return DMVehicle.create({ name: body.name.trim(), type: body.type, image: body.image });
};

const updateVehicle = async (id, body) => {
  const fields = Object.fromEntries(
    ['name', 'type', 'image', 'isActive'].filter((k) => body[k] !== undefined).map((k) => [k, body[k]])
  );
  const v = await DMVehicle.findByIdAndUpdate(id, fields, { new: true });
  if (!v) throw new AppError('Vehicle not found', 404);
  return v;
};

const removeVehicle = async (id) => {
  const v = await DMVehicle.findByIdAndDelete(id);
  if (!v) throw new AppError('Vehicle not found', 404);
};

// ── Wallet Adjust (admin) ─────────────────────────────────────────────────────
const adjustWallet = async (dmId, amount, type, note, adminId) => {
  if (!mongoose.isValidObjectId(dmId)) throw new AppError('Valid dmId is required', 400);
  if (!['credit', 'debit'].includes(type)) throw new AppError('type must be credit or debit', 400);
  if (!amount || Number(amount) <= 0) throw new AppError('amount must be positive', 400);

  const dm = await DeliveryMan.findById(dmId);
  if (!dm) throw new AppError('Delivery man not found', 404);

  const amt = money(Number(amount));
  if (type === 'debit' && dm.walletBalance < amt) throw new AppError('Insufficient wallet balance', 400);

  dm.walletBalance = money(dm.walletBalance + (type === 'credit' ? amt : -amt));
  await dm.save();

  await DMWalletTransaction.create({
    dmId, type, amount: amt, balance: dm.walletBalance,
    referenceType: 'adjustment', note: note || `Admin ${type}`,
  });

  return { walletBalance: dm.walletBalance };
};

// ── Collect Cash (admin settles DM's pending cash) ────────────────────────────
const collectCash = async (dmId, amount, note, adminId) => {
  if (!mongoose.isValidObjectId(dmId)) throw new AppError('Valid dmId is required', 400);
  const amt = money(Number(amount));
  if (!amt || amt <= 0) throw new AppError('amount must be positive', 400);

  const dm = await DeliveryMan.findById(dmId);
  if (!dm) throw new AppError('Delivery man not found', 404);
  if (dm.pendingCash < amt) throw new AppError('Amount exceeds pending cash', 400);

  dm.pendingCash = money(dm.pendingCash - amt);
  await dm.save();

  await DMWalletTransaction.create({
    dmId, type: 'debit', amount: amt, balance: dm.walletBalance,
    referenceType: 'cash_collected', note: note || 'Cash collected by admin',
  });

  return { pendingCash: dm.pendingCash };
};

// ── Disbursement ──────────────────────────────────────────────────────────────
const getDisbursements = async (query = {}) => {
  const { skip, page, limit } = paginate(query);
  const filter = {};
  if (query.dmId && mongoose.isValidObjectId(query.dmId)) filter.dmId = query.dmId;

  const [disbursements, total] = await Promise.all([
    DMDisbursement.find(filter)
      .populate('dmId', 'fName lName phone')
      .populate('paidBy', 'fName lName')
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    DMDisbursement.countDocuments(filter),
  ]);
  return { disbursements, total, page, limit, pages: Math.ceil(total / limit) };
};

const createDisbursement = async (dmId, amount, method, note, adminId) => {
  if (!mongoose.isValidObjectId(dmId)) throw new AppError('Valid dmId is required', 400);
  const amt = money(Number(amount));
  if (!amt || amt <= 0) throw new AppError('amount must be positive', 400);

  const dm = await DeliveryMan.findById(dmId);
  if (!dm) throw new AppError('Delivery man not found', 404);
  if (dm.walletBalance < amt) throw new AppError('Insufficient wallet balance', 400);

  dm.walletBalance = money(dm.walletBalance - amt);
  await dm.save();

  const [disbursement] = await Promise.all([
    DMDisbursement.create({ dmId, amount: amt, method: method || 'cash', note, paidBy: adminId }),
    DMWalletTransaction.create({
      dmId, type: 'debit', amount: amt, balance: dm.walletBalance,
      referenceType: 'disbursement', note: note || 'Disbursement',
    }),
  ]);

  return disbursement;
};

// ── Earning Auto-credit (called after order delivered) ────────────────────────
const creditEarning = async (dmId, orderId, deliveryCharge, note) => {
  if (!mongoose.isValidObjectId(dmId)) return;
  const dm = await DeliveryMan.findById(dmId);
  if (!dm || !dm.earning) return;

  const amt = money(Number(deliveryCharge) || 0);
  dm.walletBalance = money(dm.walletBalance + amt);
  dm.orderCount = (dm.orderCount || 0) + 1;
  await dm.save();

  await DMWalletTransaction.create({
    dmId, type: 'credit', amount: amt, balance: dm.walletBalance,
    referenceType: 'order_earning', orderId, note: note || 'Delivery earning',
  });
};

// ── Reviews ───────────────────────────────────────────────────────────────────
const getReviews = async (dmId, query = {}) => {
  if (!mongoose.isValidObjectId(dmId)) throw new AppError('Valid dmId is required', 400);
  const { skip, page, limit } = paginate(query);
  const filter = { dmId };

  const [reviews, total, ratingAgg] = await Promise.all([
    DMReview.find(filter).populate('userId', 'fName lName image').sort({ createdAt: -1 }).skip(skip).limit(limit),
    DMReview.countDocuments(filter),
    DMReview.aggregate([{ $match: { dmId: new mongoose.Types.ObjectId(dmId) } }, { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
  ]);

  return {
    reviews, total, page, limit, pages: Math.ceil(total / limit),
    avgRating: ratingAgg[0] ? Number(ratingAgg[0].avg.toFixed(2)) : 0,
    totalReviews: ratingAgg[0]?.count || 0,
  };
};

const createReview = async (userId, orderId, rating, comment) => {
  if (!mongoose.isValidObjectId(orderId)) throw new AppError('Valid orderId is required', 400);
  if (!rating || rating < 1 || rating > 5) throw new AppError('rating must be 1-5', 400);

  const order = await Order.findOne({ _id: orderId, ownerId: String(userId), orderStatus: 'delivered' })
    .select('deliverymanId').lean();
  if (!order) throw new AppError('Delivered order not found', 404);
  if (!order.deliverymanId) throw new AppError('No delivery man assigned to this order', 400);

  const existing = await DMReview.findOne({ orderId, userId });
  if (existing) throw new AppError('Review already submitted for this order', 409);

  return DMReview.create({ dmId: order.deliverymanId, orderId, userId, rating, comment });
};

// ── DM Dashboard (for DM portal) ─────────────────────────────────────────────
const getDmDashboard = async (dmId) => {
  const [dm, currentOrders, totalDelivered, pendingReviews] = await Promise.all([
    DeliveryMan.findById(dmId).select('walletBalance pendingCash orderCount fName lName').lean(),
    Order.countDocuments({ deliverymanId: dmId, orderStatus: { $in: ['confirmed', 'processing', 'handover', 'picked_up'] } }),
    Order.countDocuments({ deliverymanId: dmId, orderStatus: 'delivered' }),
    Order.countDocuments({ deliverymanId: dmId, orderStatus: 'delivered', _id: { $nin: await DMReview.distinct('orderId', { dmId }) } }),
  ]);
  return {
    walletBalance: dm?.walletBalance || 0,
    pendingCash: dm?.pendingCash || 0,
    totalDeliveries: dm?.orderCount || 0,
    currentOrders,
    totalDelivered,
    pendingReviews,
  };
};

module.exports = {
  getVehicles, createVehicle, updateVehicle, removeVehicle,
  adjustWallet, collectCash,
  getDisbursements, createDisbursement,
  creditEarning,
  getReviews, createReview,
  getDmDashboard,
};

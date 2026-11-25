const mongoose = require('mongoose');
const { StoreDisbursement, DisbursementDetail } = require('../../models/store/StoreDisbursement');
const StoreWallet = require('../../models/store/StoreWallet');
const WithdrawRequest = require('../../models/store/WithdrawRequest');
const WithdrawalMethod = require('../../models/store/WithdrawalMethod');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

const money = (v) => Number(Number(v).toFixed(2));

// ── Store Wallet ──────────────────────────────────────────────────────────────
const getOrCreateWallet = async (vendorId) => {
  let w = await StoreWallet.findOne({ vendorId });
  if (!w) w = await StoreWallet.create({ vendorId });
  return w;
};

const getWallet = async (vendorId) => {
  const w = await getOrCreateWallet(vendorId);
  return { ...w.toObject(), balance: w.balance };
};

const creditEarning = async (vendorId, amount) => {
  const w = await getOrCreateWallet(vendorId);
  w.totalEarning = money(w.totalEarning + Number(amount));
  await w.save();
  return w;
};

// ── Disbursements ─────────────────────────────────────────────────────────────
const getAll = async (query = {}) => {
  const { skip, page, limit } = paginate(query);
  const filter = { createdFor: 'store' };
  if (query.status && query.status !== 'all') filter.status = query.status;
  const [disbursements, total] = await Promise.all([
    StoreDisbursement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    StoreDisbursement.countDocuments(filter),
  ]);
  return { disbursements, total, page, limit, pages: Math.ceil(total / limit) };
};

const getDetails = async (disbursementId, query = {}) => {
  const { skip, page, limit } = paginate(query);
  const filter = { disbursementId };
  if (query.storeId && mongoose.isValidObjectId(query.storeId)) filter.storeId = query.storeId;
  if (query.status) filter.status = query.status;
  const [details, total] = await Promise.all([
    DisbursementDetail.find(filter)
      .populate('storeId', 'name phone email')
      .populate('vendorId', 'fName lName email phone')
      .populate('paymentMethodId', 'methodName')
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    DisbursementDetail.countDocuments(filter),
  ]);
  return { details, total, page, limit, pages: Math.ceil(total / limit) };
};

const generate = async (minAmount = 0) => {
  const Store = require('../../models/store/Store');
  const stores = await Store.find({ status: true }).lean();
  const details = [];
  let totalAmount = 0;

  const disbursement = new StoreDisbursement({ title: `Disbursement #${Date.now()}`, createdFor: 'store' });
  const defaultMethod = await WithdrawalMethod.findOne({ isDefault: true, isActive: true });

  for (const store of stores) {
    if (!store.vendorId) continue;
    const wallet = await StoreWallet.findOne({ vendorId: store.vendorId });
    if (!wallet) continue;
    const disbursable = money(wallet.totalEarning - (wallet.totalWithdrawn + wallet.pendingWithdraw + wallet.collectedCash));
    if (disbursable <= Number(minAmount)) continue;

    details.push({
      disbursementId: disbursement._id,
      storeId: store._id,
      vendorId: store.vendorId,
      disbursementAmount: disbursable,
      paymentMethodId: defaultMethod?._id,
      status: 'pending',
    });
    totalAmount = money(totalAmount + disbursable);
    wallet.pendingWithdraw = money(wallet.pendingWithdraw + disbursable);
    await wallet.save();
  }

  if (totalAmount === 0) throw new AppError('No stores eligible for disbursement', 400);
  disbursement.totalAmount = totalAmount;
  await disbursement.save();
  await DisbursementDetail.insertMany(details);
  return disbursement;
};

const _syncParentStatus = async (disbursementId) => {
  const all = await DisbursementDetail.find({ disbursementId });
  const counts = all.reduce((a, d) => { a[d.status] = (a[d.status] || 0) + 1; return a; }, {});
  const n = all.length;
  let status = 'partially_completed';
  if (counts.pending === n) status = 'pending';
  else if (counts.canceled === n) status = 'canceled';
  else if (counts.completed === n) status = 'completed';
  await StoreDisbursement.findByIdAndUpdate(disbursementId, { status });
};

const updateDetailStatus = async (detailId, status) => {
  if (!['pending', 'completed', 'canceled'].includes(status)) throw new AppError('Invalid status', 400);
  const detail = await DisbursementDetail.findById(detailId);
  if (!detail) throw new AppError('Disbursement detail not found', 404);
  const wallet = await StoreWallet.findOne({ vendorId: detail.vendorId });
  if (!wallet) throw new AppError('Store wallet not found', 404);

  const prev = detail.status;
  if (status === 'completed' && prev !== 'completed') {
    if (prev !== 'canceled') wallet.pendingWithdraw = money(wallet.pendingWithdraw - detail.disbursementAmount);
    wallet.totalWithdrawn = money(wallet.totalWithdrawn + detail.disbursementAmount);
    await WithdrawRequest.create({ vendorId: detail.vendorId, amount: detail.disbursementAmount, withdrawalMethodId: detail.paymentMethodId, approved: 1, transactionNote: String(detailId), type: 'disbursement' });
  } else if (status === 'canceled' && prev !== 'canceled') {
    wallet.pendingWithdraw = money(wallet.pendingWithdraw - (prev === 'completed' ? 0 : detail.disbursementAmount));
    if (prev === 'completed') wallet.totalWithdrawn = money(wallet.totalWithdrawn - detail.disbursementAmount);
  } else if (status === 'pending' && prev === 'completed') {
    wallet.totalWithdrawn = money(wallet.totalWithdrawn - detail.disbursementAmount);
    wallet.pendingWithdraw = money(wallet.pendingWithdraw + detail.disbursementAmount);
    await WithdrawRequest.deleteOne({ transactionNote: String(detailId), vendorId: detail.vendorId });
  }

  await wallet.save();
  detail.status = status;
  await detail.save();
  await _syncParentStatus(detail.disbursementId);
  return detail;
};

// ── Vendor Withdraw Requests ──────────────────────────────────────────────────
const getWithdrawRequests = async (query = {}) => {
  const { skip, page, limit } = paginate(query);
  const filter = { type: 'manual' };
  if (query.vendorId && mongoose.isValidObjectId(query.vendorId)) filter.vendorId = query.vendorId;
  if (query.approved !== undefined) filter.approved = Number(query.approved);
  const [requests, total] = await Promise.all([
    WithdrawRequest.find(filter).populate('vendorId', 'fName lName email phone').populate('withdrawalMethodId', 'methodName').sort({ createdAt: -1 }).skip(skip).limit(limit),
    WithdrawRequest.countDocuments(filter),
  ]);
  return { requests, total, page, limit, pages: Math.ceil(total / limit) };
};

const createWithdrawRequest = async (vendorId, amount, withdrawalMethodId, fields) => {
  const wallet = await getOrCreateWallet(vendorId);
  const amt = money(Number(amount));
  if (amt <= 0) throw new AppError('amount must be positive', 400);
  if (wallet.balance < amt) throw new AppError('Insufficient wallet balance', 400);
  wallet.pendingWithdraw = money(wallet.pendingWithdraw + amt);
  await wallet.save();
  return WithdrawRequest.create({ vendorId, amount: amt, withdrawalMethodId, withdrawalMethodFields: fields, approved: 0, type: 'manual' });
};

const approveWithdrawRequest = async (requestId, approved) => {
  if (![1, 2].includes(Number(approved))) throw new AppError('approved must be 1 (approve) or 2 (deny)', 400);
  const req = await WithdrawRequest.findById(requestId);
  if (!req) throw new AppError('Withdraw request not found', 404);
  if (req.approved !== 0) throw new AppError('Request already processed', 409);
  const wallet = await StoreWallet.findOne({ vendorId: req.vendorId });
  if (wallet) {
    wallet.pendingWithdraw = money(wallet.pendingWithdraw - req.amount);
    if (Number(approved) === 1) wallet.totalWithdrawn = money(wallet.totalWithdrawn + req.amount);
    await wallet.save();
  }
  req.approved = Number(approved);
  await req.save();
  return req;
};

module.exports = {
  getOrCreateWallet, getWallet, creditEarning,
  getAll, getDetails, generate, updateDetailStatus,
  getWithdrawRequests, createWithdrawRequest, approveWithdrawRequest,
};

const mongoose = require('mongoose');
const PurchaseBill = require('../../models/purchase/PurchaseBill');
const PurchasePayment = require('../../models/purchase/PurchasePayment');
const PurchaseReturn = require('../../models/purchase/PurchaseReturn');
const PurchaseVendor = require('../../models/purchase/PurchaseVendor');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

const PAYMENT_MODES = ['bank_transfer', 'cash', 'upi', 'cheque', 'other'];

const validateId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${label} ID`, 400);
};

const validDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

const calculateSettlement = (total, amountPaid, completedReturns) => {
  const settled = Number((amountPaid + completedReturns).toFixed(2));
  const billTotal = Number(total || 0);
  if (settled <= 0) return { amountPaid, balanceDue: billTotal, status: 'open' };
  if (settled + 0.009 >= billTotal) {
    return { amountPaid, balanceDue: 0, status: 'paid' };
  }
  return {
    amountPaid,
    balanceDue: Math.max(0, Number((billTotal - settled).toFixed(2))),
    status: 'partially_paid',
  };
};

const normalizePayment = (body = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('Payment details must be an object', 400);
  }
  const purchaseBillId = body.purchaseBillId || undefined;
  const purchaseVendorId = body.purchaseVendorId || undefined;
  if (purchaseBillId) validateId(purchaseBillId, 'purchase bill');
  if (purchaseVendorId) validateId(purchaseVendorId, 'purchase vendor');
  if (!purchaseBillId && !purchaseVendorId) {
    throw new AppError('purchaseVendorId is required for an unallocated payment', 400);
  }

  const paymentDate = new Date(body.paymentDate);
  if (!validDate(paymentDate)) throw new AppError('paymentDate must be a valid date', 400);

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) < 1
    || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
    throw new AppError('amount must be a positive number with at most two decimal places', 400);
  }

  const mode = body.mode || 'bank_transfer';
  if (!PAYMENT_MODES.includes(mode)) {
    throw new AppError(`mode must be one of: ${PAYMENT_MODES.join(', ')}`, 400);
  }

  const fields = { paymentDate, amount: Math.round(amount * 100) / 100, mode };
  for (const field of ['reference', 'notes']) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'string') throw new AppError(`${field} must be a string`, 400);
      const maximum = field === 'reference' ? 120 : 1000;
      if (body[field].length > maximum) {
        throw new AppError(`${field} cannot exceed ${maximum} characters`, 400);
      }
      fields[field] = body[field].trim();
    }
  }
  return { purchaseBillId, purchaseVendorId, ...fields };
};

const sumAmount = async (Model, filter, field, session) => {
  const [result] = await Model.aggregate([
    { $match: filter },
    { $group: { _id: null, total: { $sum: `$${field}` } } },
  ]).session(session);
  return Number(result?.total || 0);
};

const refreshBillPaymentStatus = async (bill, session) => {
  if (['draft', 'void'].includes(bill.status)) return bill;

  const amountPaid = await sumAmount(
    PurchasePayment,
    { purchaseBillId: bill._id },
    'amount',
    session,
  );
  const completedReturns = await sumAmount(
    PurchaseReturn,
    { purchaseBillId: bill._id, status: 'completed' },
    'totalAmount',
    session,
  );
  Object.assign(
    bill,
    calculateSettlement(
      Number(bill.total || 0),
      Number(amountPaid.toFixed(2)),
      Number(completedReturns.toFixed(2)),
    ),
  );
  await bill.save({ session });
  return bill;
};

const getAll = async (query) => {
  const { page, limit, skip } = paginate(query);
  const filter = {};
  for (const field of ['purchaseVendorId', 'purchaseBillId']) {
    if (query[field]) {
      validateId(query[field], field === 'purchaseVendorId' ? 'purchase vendor' : 'purchase bill');
      filter[field] = query[field];
    }
  }

  const dateFilter = {};
  for (const [field, raw] of [['from', query.from], ['to', query.to]]) {
    if (raw) {
      const date = new Date(raw);
      if (!validDate(date)) throw new AppError(`${field} must be a valid date`, 400);
      if (field === 'to') date.setUTCHours(23, 59, 59, 999);
      dateFilter[field === 'from' ? '$gte' : '$lte'] = date;
    }
  }
  if (dateFilter.$gte && dateFilter.$lte && dateFilter.$gte > dateFilter.$lte) {
    throw new AppError('from must be on or before to', 400);
  }
  if (Object.keys(dateFilter).length) filter.paymentDate = dateFilter;

  const [payments, total] = await Promise.all([
    PurchasePayment.find(filter)
      .populate('purchaseVendorId', 'displayName legalName')
      .populate('purchaseBillId', 'billNumber total balanceDue status')
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    PurchasePayment.countDocuments(filter),
  ]);
  return { payments, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
};

const record = async (body) => {
  const fields = normalizePayment(body);
  const session = await mongoose.startSession();
  let createdPayment;
  try {
    await session.withTransaction(async () => {
      let bill;
      let vendorId = fields.purchaseVendorId;
      if (fields.purchaseBillId) {
        bill = await PurchaseBill.findById(fields.purchaseBillId).session(session);
        if (!bill) throw new AppError('Purchase bill not found', 404);
        if (['draft', 'void'].includes(bill.status)) {
          throw new AppError('Payments cannot be recorded for a draft or void bill', 409);
        }
        if (vendorId && String(vendorId) !== String(bill.purchaseVendorId)) {
          throw new AppError('Purchase bill does not belong to the selected vendor', 400);
        }
        vendorId = bill.purchaseVendorId;
      }

      const vendor = await PurchaseVendor.findById(vendorId).session(session);
      if (!vendor) throw new AppError('Purchase vendor not found', 404);

      if (bill) {
        const paid = await sumAmount(
          PurchasePayment,
          { purchaseBillId: bill._id },
          'amount',
          session,
        );
        const returned = await sumAmount(
          PurchaseReturn,
          { purchaseBillId: bill._id, status: 'completed' },
          'totalAmount',
          session,
        );
        const balanceDue = Math.max(
          0,
          Number((Number(bill.total || 0) - paid - returned).toFixed(2)),
        );
        if (fields.amount - balanceDue > 0.009) {
          throw new AppError(`amount exceeds the bill balance due (${balanceDue.toFixed(2)})`, 400);
        }
      }

      [createdPayment] = await PurchasePayment.create([{
        ...fields,
        purchaseVendorId: vendorId,
      }], { session });
      if (bill) await refreshBillPaymentStatus(bill, session);
    });
  } finally {
    await session.endSession();
  }
  return createdPayment;
};

const remove = async (id) => {
  validateId(id, 'purchase payment');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const payment = await PurchasePayment.findById(id).session(session);
      if (!payment) throw new AppError('Purchase payment not found', 404);
      const bill = payment.purchaseBillId
        ? await PurchaseBill.findById(payment.purchaseBillId).session(session)
        : null;
      await payment.deleteOne({ session });
      if (bill) await refreshBillPaymentStatus(bill, session);
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  getAll,
  record,
  remove,
  normalizePayment,
  refreshBillPaymentStatus,
  calculateSettlement,
};

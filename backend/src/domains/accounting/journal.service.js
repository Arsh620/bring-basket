const mongoose = require('mongoose');
const { AccountLedger, AccountJournalEntry, AccountJournalLine } = require('../../models/accounting/AccountModels');

const money = (v) => Number(Number(v).toFixed(2));

// ── Default Indian retail Chart of Accounts ───────────────────────────────────
const DEFAULT_COA = [
  { code: '1000', name: 'Cash',             type: 'asset',     gstFlag: null,         isCashBank: true  },
  { code: '1010', name: 'Bank',             type: 'asset',     gstFlag: null,         isCashBank: true  },
  { code: '1100', name: 'Trade Receivables',type: 'asset',     gstFlag: null,         isCashBank: false },
  { code: '1200', name: 'Inventory',        type: 'asset',     gstFlag: null,         isCashBank: false },
  { code: '1301', name: 'Input CGST',       type: 'asset',     gstFlag: 'input_cgst', isCashBank: false },
  { code: '1302', name: 'Input SGST',       type: 'asset',     gstFlag: 'input_sgst', isCashBank: false },
  { code: '1303', name: 'Input IGST',       type: 'asset',     gstFlag: 'input_igst', isCashBank: false },
  { code: '2000', name: 'Trade Payables',   type: 'liability', gstFlag: null,         isCashBank: false },
  { code: '2101', name: 'Output CGST',      type: 'liability', gstFlag: 'output_cgst',isCashBank: false },
  { code: '2102', name: 'Output SGST',      type: 'liability', gstFlag: 'output_sgst',isCashBank: false },
  { code: '2103', name: 'Output IGST',      type: 'liability', gstFlag: 'output_igst',isCashBank: false },
  { code: '3000', name: 'Capital / Equity', type: 'equity',    gstFlag: null,         isCashBank: false },
  { code: '4000', name: 'Sales',            type: 'income',    gstFlag: null,         isCashBank: false },
  { code: '5000', name: 'Purchase',         type: 'expense',   gstFlag: null,         isCashBank: false },
  { code: '5100', name: 'Expenses',         type: 'expense',   gstFlag: null,         isCashBank: false },
];

const ensureChartOfAccounts = async () => {
  const count = await AccountLedger.countDocuments();
  if (count > 0) return;
  await AccountLedger.insertMany(
    DEFAULT_COA.map((row) => ({ ...row, isSystem: true, status: true })),
    { ordered: false },
  ).catch(() => {}); // ignore duplicate key on concurrent calls
};

const ledgerByCode = async (code) => AccountLedger.findOne({ code });

// ── GST tax split helper ──────────────────────────────────────────────────────
const splitTax = (taxType, taxAmount) => {
  const amt = money(taxAmount);
  if (taxType === 'cgst_sgst') {
    const half = money(amt / 2);
    return { cgst: half, sgst: money(amt - half), igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: amt };
};

// ── Idempotent journal post ──────────────────────────────────────��────────────
const post = async (sourceType, sourceId, date, narration, lines, replaceIfChanged = false) => {
  await ensureChartOfAccounts();

  const srcId = String(sourceId);
  const existing = await AccountJournalEntry.findOne({ sourceType, sourceId: srcId });

  if (existing && !replaceIfChanged) return existing;

  // Resolve ledger codes → ObjectIds
  const normalized = [];
  let debitTotal = 0;
  let creditTotal = 0;

  for (const line of lines) {
    const debit  = money(line.debit  || 0);
    const credit = money(line.credit || 0);
    if (debit <= 0 && credit <= 0) continue;

    const ledger = await ledgerByCode(line.ledger);
    if (!ledger) continue;

    normalized.push({ ledgerId: ledger._id, debit, credit });
    debitTotal  += debit;
    creditTotal += credit;
  }

  if (!normalized.length || Math.abs(debitTotal - creditTotal) > 0.05) return null;

  // Check if amounts changed — skip repost if same
  if (existing) {
    const oldLines = await AccountJournalLine.find({ entryId: existing._id });
    const oldDebit = money(oldLines.reduce((s, l) => s + l.debit, 0));
    if (Math.abs(oldDebit - debitTotal) < 0.02) return existing;

    // Delete old entry + lines
    await AccountJournalLine.deleteMany({ entryId: existing._id });
    await AccountJournalEntry.deleteOne({ _id: existing._id });
  }

  const session = await mongoose.startSession();
  let entry;
  try {
    await session.withTransaction(async () => {
      const voucherNo = `JV-${sourceType.slice(0, 3).toUpperCase()}-${srcId}`;
      [entry] = await AccountJournalEntry.create([{
        entryDate: new Date(date),
        voucherNo,
        sourceType,
        sourceId: srcId,
        narration,
      }], { session });

      await AccountJournalLine.insertMany(
        normalized.map((l) => ({ entryId: entry._id, ...l })),
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return entry;
};

// ── Domain-specific post helpers ──────────────────────────────────────────────

const postPurchaseBill = async (bill) => {
  if (['draft', 'void'].includes(bill.status)) {
    if (bill.status === 'void') {
      const e = await AccountJournalEntry.findOne({ sourceType: 'purchase_bill', sourceId: String(bill._id) });
      if (e) {
        await AccountJournalLine.deleteMany({ entryId: e._id });
        await e.deleteOne();
      }
    }
    return null;
  }
  const split = splitTax(bill.taxType || 'igst', Number(bill.taxTotal) || 0);
  const lines = [
    { ledger: '5000', debit: money(bill.subTotal) },
    { ledger: '2000', credit: money(bill.total) },
  ];
  if (split.cgst > 0) lines.push({ ledger: '1301', debit: split.cgst });
  if (split.sgst > 0) lines.push({ ledger: '1302', debit: split.sgst });
  if (split.igst > 0) lines.push({ ledger: '1303', debit: split.igst });

  return post('purchase_bill', String(bill._id),
    bill.billDate ? new Date(bill.billDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    `Purchase bill #${bill.billNumber}`, lines, true);
};

const postPurchasePayment = async (payment) => {
  const amount = money(Number(payment.amount) || 0);
  if (amount <= 0) return null;
  return post('purchase_payment', String(payment._id),
    payment.paymentDate ? new Date(payment.paymentDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    `Vendor payment #${payment._id}`,
    [{ ledger: '2000', debit: amount }, { ledger: '1010', credit: amount }],
    true);
};

const postPurchaseReturn = async (ret) => {
  const total = money(Number(ret.totalAmount) || 0);
  if (total <= 0 || ret.status === 'void') {
    const e = await AccountJournalEntry.findOne({ sourceType: 'purchase_return', sourceId: String(ret._id) });
    if (e) { await AccountJournalLine.deleteMany({ entryId: e._id }); await e.deleteOne(); }
    return null;
  }
  const split = splitTax(ret.taxType || 'igst', Number(ret.taxTotal) || 0);
  const lines = [
    { ledger: '2000', debit: total },
    { ledger: '5000', credit: money(ret.subTotal) },
  ];
  if (split.cgst > 0) lines.push({ ledger: '1301', credit: split.cgst });
  if (split.sgst > 0) lines.push({ ledger: '1302', credit: split.sgst });
  if (split.igst > 0) lines.push({ ledger: '1303', credit: split.igst });

  return post('purchase_return', String(ret._id),
    ret.returnDate ? new Date(ret.returnDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    `Purchase return #${ret.returnNumber}`, lines, true);
};

const postOrder = async (order) => {
  if (['canceled', 'failed'].includes(order.orderStatus)) return null;
  if (!['delivered', 'completed'].includes(order.orderStatus)) return null;

  const gross = money(Number(order.orderAmount) || 0);
  const tax   = money(Math.min(Number(order.taxAmount) || 0, gross));
  const sales = money(Math.max(0, gross - tax));
  const isCash = ['cash_on_delivery', 'cash', 'pos'].includes(String(order.paymentMethod).toLowerCase());
  const asset = isCash ? '1000' : '1100';

  const lines = [
    { ledger: asset, debit: gross },
    { ledger: '4000', credit: sales },
  ];
  if (tax > 0) lines.push({ ledger: '2103', credit: tax });

  const dateStr = order.createdAt
    ? new Date(order.createdAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return post('order', String(order._id), dateStr, `Order #${order.orderNumber}`, lines, true);
};

// ── Reports ───────────────────────────────────────────────────────────────────

const trialBalance = async (from, to) => {
  await ensureChartOfAccounts();
  const ledgers = await AccountLedger.find({ status: true }).sort({ code: 1 }).lean();

  const entryIds = await AccountJournalEntry.find({
    entryDate: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59Z') },
  }).distinct('_id');

  const agg = await AccountJournalLine.aggregate([
    { $match: { entryId: { $in: entryIds } } },
    { $group: { _id: '$ledgerId', debit: { $sum: '$debit' }, credit: { $sum: '$credit' } } },
  ]);

  const map = new Map(agg.map((r) => [String(r._id), r]));

  return ledgers
    .map((l) => {
      const row = map.get(String(l._id));
      if (!row) return null;
      const debit  = money(row.debit);
      const credit = money(row.credit);
      return { ledger: l, debit, credit, balance: money(debit - credit) };
    })
    .filter(Boolean);
};

const profitAndLoss = async (from, to) => {
  const tb = await trialBalance(from, to);
  const income = [], expense = [];
  let incomeTotal = 0, expenseTotal = 0;

  for (const row of tb) {
    if (row.ledger.type === 'income') {
      const amt = money(row.credit - row.debit);
      income.push({ ledger: row.ledger, amount: amt });
      incomeTotal += amt;
    } else if (row.ledger.type === 'expense') {
      const amt = money(row.debit - row.credit);
      expense.push({ ledger: row.ledger, amount: amt });
      expenseTotal += amt;
    }
  }
  return {
    income, expense,
    incomeTotal: money(incomeTotal),
    expenseTotal: money(expenseTotal),
    net: money(incomeTotal - expenseTotal),
  };
};

const balanceSheet = async (to) => {
  const tb = await trialBalance('2000-01-01', to);
  const assets = [], liabilities = [], equity = [];

  for (const row of tb) {
    const { type } = row.ledger;
    if (type === 'asset')     assets.push({ ledger: row.ledger, amount: row.balance });
    else if (type === 'liability') liabilities.push({ ledger: row.ledger, amount: money(-row.balance) });
    else if (type === 'equity')    equity.push({ ledger: row.ledger, amount: money(-row.balance) });
  }

  const pnl = await profitAndLoss('2000-01-01', to);
  equity.push({ ledger: { code: 'PL', name: 'Current Year P&L' }, amount: pnl.net });

  return { assets, liabilities, equity };
};

const getJournals = async ({ from, to, page = 1, limit = 20 }) => {
  const skip = (Number(page) - 1) * Number(limit);
  const filter = { entryDate: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59Z') } };

  const [entries, total] = await Promise.all([
    AccountJournalEntry.find(filter)
      .sort({ entryDate: -1, _id: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    AccountJournalEntry.countDocuments(filter),
  ]);

  const entryIds = entries.map((e) => e._id);
  const lines = await AccountJournalLine.find({ entryId: { $in: entryIds } })
    .populate('ledgerId', 'code name')
    .lean();

  const linesByEntry = new Map();
  for (const l of lines) {
    const key = String(l.entryId);
    if (!linesByEntry.has(key)) linesByEntry.set(key, []);
    linesByEntry.get(key).push(l);
  }

  const rows = entries.map((e) => ({ ...e, lines: linesByEntry.get(String(e._id)) || [] }));
  return { rows, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) };
};

const getLedgers = async ({ page = 1, limit = 50 }) => {
  const skip = (Number(page) - 1) * Number(limit);
  await ensureChartOfAccounts();
  const [ledgers, total] = await Promise.all([
    AccountLedger.find().sort({ code: 1 }).skip(skip).limit(Number(limit)).lean(),
    AccountLedger.countDocuments(),
  ]);
  return { ledgers, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) };
};

const createLedger = async ({ code, name, type, isCashBank = false }) => {
  if (!code?.trim()) throw Object.assign(new Error('code is required'), { statusCode: 400 });
  if (!name?.trim()) throw Object.assign(new Error('name is required'), { statusCode: 400 });
  if (!['asset', 'liability', 'equity', 'income', 'expense'].includes(type)) {
    throw Object.assign(new Error('type must be asset, liability, equity, income, or expense'), { statusCode: 400 });
  }
  return AccountLedger.create({ code: code.trim(), name: name.trim(), type, isCashBank, isSystem: false, status: true });
};

const repostRecent = async (limit = 500) => {
  const PurchaseBill    = require('../../models/purchase/PurchaseBill');
  const PurchasePayment = require('../../models/purchase/PurchasePayment');
  const PurchaseReturn  = require('../../models/purchase/PurchaseReturn');
  const Order           = require('../../models/orders/order.model');

  await ensureChartOfAccounts();
  let count = 0;

  const bills = await PurchaseBill.find({ status: { $nin: ['draft', 'void'] } }).sort({ _id: -1 }).limit(limit);
  for (const b of bills) { if (await postPurchaseBill(b)) count++; }

  const payments = await PurchasePayment.find().sort({ _id: -1 }).limit(limit);
  for (const p of payments) { if (await postPurchasePayment(p)) count++; }

  const returns = await PurchaseReturn.find({ status: { $nin: ['void'] } }).sort({ _id: -1 }).limit(limit);
  for (const r of returns) { if (await postPurchaseReturn(r)) count++; }

  const orders = await Order.find({ orderStatus: { $in: ['delivered', 'completed'] } }).sort({ _id: -1 }).limit(limit);
  for (const o of orders) { if (await postOrder(o)) count++; }

  return count;
};

module.exports = {
  ensureChartOfAccounts,
  splitTax,
  post,
  postPurchaseBill,
  postPurchasePayment,
  postPurchaseReturn,
  postOrder,
  trialBalance,
  profitAndLoss,
  balanceSheet,
  getJournals,
  getLedgers,
  createLedger,
  repostRecent,
};

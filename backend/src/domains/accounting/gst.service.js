const PurchaseBill    = require('../../models/purchase/PurchaseBill');
const PurchaseOrder   = require('../../models/purchase/PurchaseOrder');
const PurchasePayment = require('../../models/purchase/PurchasePayment');
const { splitTax }    = require('./journal.service');
const { paginate }    = require('../../utils/pagination');
const AppError        = require('../../utils/AppError');

const money = (v) => Number(Number(v).toFixed(2));

// ── Date range resolver ───────────────────────────────────────────────────────
const resolveDateRange = (filter, from, to) => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const startOf = (unit) => {
    const d = new Date(now);
    if (unit === 'week') { d.setDate(d.getDate() - d.getDay()); }
    else if (unit === 'month') { d.setDate(1); }
    else if (unit === 'year') { d.setMonth(0, 1); }
    return d;
  };
  const endOf = (unit) => {
    const d = new Date(now);
    if (unit === 'week') { d.setDate(d.getDate() + (6 - d.getDay())); }
    else if (unit === 'month') { d.setMonth(d.getMonth() + 1, 0); }
    else if (unit === 'year') { d.setMonth(11, 31); }
    return d;
  };

  switch (filter || 'this_month') {
    case 'today':       return [fmt(now), fmt(now)];
    case 'this_week':   return [fmt(startOf('week')), fmt(endOf('week'))];
    case 'this_year':   return [fmt(startOf('year')), fmt(endOf('year'))];
    case 'previous_year': {
      const py = new Date(now); py.setFullYear(py.getFullYear() - 1);
      return [`${py.getFullYear()}-01-01`, `${py.getFullYear()}-12-31`];
    }
    case 'custom': {
      const f = from || fmt(startOf('month'));
      const t = to   || fmt(now);
      return f <= t ? [f, t] : [t, f];
    }
    default: return [fmt(startOf('month')), fmt(endOf('month'))];
  }
};

// ── GSTR-3B summary ───────────────────────────────────────────────────────────
const gstr3bSummary = async (from, to) => {
  const Order = require('../../models/orders/order.model');

  const bills = await PurchaseBill.find({
    status: { $nin: ['draft', 'void'] },
    billDate: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59Z') },
  }).select('taxType subTotal taxTotal total').lean();

  const inward = { taxable: 0, cgst: 0, sgst: 0, igst: 0, taxTotal: 0 };
  for (const b of bills) {
    const split = splitTax(b.taxType || 'igst', Number(b.taxTotal) || 0);
    inward.taxable  += Number(b.subTotal) || 0;
    inward.cgst     += split.cgst;
    inward.sgst     += split.sgst;
    inward.igst     += split.igst;
    inward.taxTotal += Number(b.taxTotal) || 0;
  }

  const [outwardTax, outwardTotal] = await Promise.all([
    Order.aggregate([
      { $match: { orderStatus: { $nin: ['canceled', 'failed'] }, createdAt: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59Z') } } },
      { $group: { _id: null, tax: { $sum: '$taxAmount' }, total: { $sum: '$orderAmount' } } },
    ]),
    Promise.resolve(),
  ]);

  const oTax   = money(outwardTax[0]?.tax   || 0);
  const oTotal = money(outwardTax[0]?.total || 0);

  const outward = {
    taxable: money(Math.max(0, oTotal - oTax)),
    cgst: 0, sgst: 0, igst: oTax, taxTotal: oTax,
    note: 'Sales tax is order taxAmount (no HSN/GSTIN split)',
  };

  const round = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'number' ? money(v) : v]));

  return {
    inward: round(inward),
    outward,
    net: {
      taxable:  money(outward.taxable  - inward.taxable),
      cgst:     money(outward.cgst     - inward.cgst),
      sgst:     money(outward.sgst     - inward.sgst),
      igst:     money(outward.igst     - inward.igst),
      taxTotal: money(outward.taxTotal - inward.taxTotal),
    },
  };
};

// ── GST rate-wise summary ─────────────────────────────────────────────────────
const gstSummaryByRate = async (from, to) => {
  const PurchaseBillModel = require('../../models/purchase/PurchaseBill');

  const bills = await PurchaseBillModel.find({
    status: { $nin: ['draft', 'void'] },
    billDate: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59Z') },
  }).select('taxType items').lean();

  const buckets = {};
  for (const bill of bills) {
    for (const item of bill.items || []) {
      const rate = Number(item.taxPercent) || 0;
      const key  = rate.toFixed(2);
      if (!buckets[key]) buckets[key] = { taxPercent: rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, taxTotal: 0 };
      const taxable = money(Number(item.amount) - Number(item.taxAmount));
      const split   = splitTax(bill.taxType || 'igst', Number(item.taxAmount) || 0);
      buckets[key].taxable  += taxable;
      buckets[key].cgst     += split.cgst;
      buckets[key].sgst     += split.sgst;
      buckets[key].igst     += split.igst;
      buckets[key].taxTotal += Number(item.taxAmount) || 0;
    }
  }

  return Object.values(buckets)
    .map((r) => ({ ...r, taxable: money(r.taxable), cgst: money(r.cgst), sgst: money(r.sgst), igst: money(r.igst), taxTotal: money(r.taxTotal) }))
    .sort((a, b) => a.taxPercent - b.taxPercent);
};

// ── HSN summary ───────────────────────────────────────────────────────────────
const hsnSummary = async (from, to) => {
  const PurchaseBillModel = require('../../models/purchase/PurchaseBill');

  const bills = await PurchaseBillModel.find({
    status: { $nin: ['draft', 'void'] },
    billDate: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59Z') },
  }).select('taxType items').lean();

  const buckets = {};
  for (const bill of bills) {
    for (const item of bill.items || []) {
      const hsn = (item.hsnSac || 'UNCLASSIFIED').trim() || 'UNCLASSIFIED';
      if (!buckets[hsn]) buckets[hsn] = { hsnSac: hsn, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, taxTotal: 0 };
      const split = splitTax(bill.taxType || 'igst', Number(item.taxAmount) || 0);
      buckets[hsn].qty     += Number(item.qty) || 0;
      buckets[hsn].taxable += money(Number(item.amount) - Number(item.taxAmount));
      buckets[hsn].cgst    += split.cgst;
      buckets[hsn].sgst    += split.sgst;
      buckets[hsn].igst    += split.igst;
      buckets[hsn].taxTotal += Number(item.taxAmount) || 0;
    }
  }

  return Object.values(buckets)
    .map((r) => ({ ...r, qty: Number(r.qty.toFixed(4)), taxable: money(r.taxable), cgst: money(r.cgst), sgst: money(r.sgst), igst: money(r.igst), taxTotal: money(r.taxTotal) }))
    .sort((a, b) => a.hsnSac.localeCompare(b.hsnSac));
};

// ── Payable aging ─────────────────────────────────────────────────────────────
const payableAging = async (asOf, options = {}) => {
  const asOfDate = new Date(asOf + 'T23:59:59Z');
  const filter = { status: { $nin: ['draft', 'void', 'paid'] }, balanceDue: { $gt: 0 } };
  if (options.purchaseVendorId) filter.purchaseVendorId = options.purchaseVendorId;
  if (options.warehouseId)      filter.warehouseId      = options.warehouseId;

  const bills = await PurchaseBill.find(filter)
    .populate('purchaseVendorId', 'displayName')
    .select('purchaseVendorId billNumber billDate dueDate balanceDue')
    .lean();

  const bucket = (days) => {
    if (days <= 0)  return 'current';
    if (days <= 30) return '1_30';
    if (days <= 60) return '31_60';
    if (days <= 90) return '61_90';
    return '90_plus';
  };

  return bills.map((b) => {
    const due  = new Date(b.dueDate || b.billDate);
    const days = Math.floor((asOfDate - due) / 86400000);
    return {
      vendor:      b.purchaseVendorId?.displayName || '—',
      vendorId:    b.purchaseVendorId?._id,
      billNumber:  b.billNumber,
      billId:      b._id,
      billDate:    new Date(b.billDate).toISOString().slice(0, 10),
      dueDate:     new Date(b.dueDate || b.billDate).toISOString().slice(0, 10),
      balance:     money(b.balanceDue),
      bucket:      bucket(days),
      daysOverdue: Math.max(0, days),
    };
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
};

// ── GRN register ──────────────────────────────────────────────────────────────
const grnRegister = async (from, to, query = {}) => {
  const { skip, page, limit } = paginate(query);
  const filter = {
    stockReceived: true,
    stockReceivedAt: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59Z') },
  };
  if (query.warehouseId) filter.warehouseId = query.warehouseId;

  const [bills, total] = await Promise.all([
    PurchaseBill.find(filter)
      .populate('purchaseVendorId', 'displayName')
      .populate('warehouseId', 'name code')
      .sort({ stockReceivedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PurchaseBill.countDocuments(filter),
  ]);
  return { bills, total, page, limit, pages: Math.ceil(total / limit) };
};

// ── Payment register ──────────────────────────────────────────────────────────
const paymentRegister = async (from, to, query = {}) => {
  const { skip, page, limit } = paginate(query);
  const filter = { paymentDate: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59Z') } };

  const [payments, total] = await Promise.all([
    PurchasePayment.find(filter)
      .populate('purchaseVendorId', 'displayName')
      .populate('purchaseBillId', 'billNumber')
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PurchasePayment.countDocuments(filter),
  ]);
  return { payments, total, page, limit, pages: Math.ceil(total / limit) };
};

// ── PO details ────────────────────────────────────────────────────────────────
const poDetails = async (from, to, query = {}) => {
  const { skip, page, limit } = paginate(query);
  const filter = { poDate: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59Z') } };
  if (query.status) filter.status = query.status;
  if (query.warehouseId) filter.warehouseId = query.warehouseId;

  const [orders, total] = await Promise.all([
    PurchaseOrder.find(filter)
      .populate('purchaseVendorId', 'displayName')
      .populate('warehouseId', 'name code')
      .sort({ poDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PurchaseOrder.countDocuments(filter),
  ]);
  return { orders, total, page, limit, pages: Math.ceil(total / limit) };
};

// ── Hub KPIs ──────────────────────────────────────────────────────────────────
const hubKpis = async (from, to) => {
  const Order = require('../../models/orders/order.model');

  const [purchaseAgg, paymentsAgg, salesAgg, payableOpen] = await Promise.all([
    PurchaseBill.aggregate([
      { $match: { status: { $nin: ['draft', 'void'] }, billDate: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59Z') } } },
      { $group: { _id: null, total: { $sum: '$total' }, tax: { $sum: '$taxTotal' } } },
    ]),
    PurchasePayment.aggregate([
      { $match: { paymentDate: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59Z') } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Order.aggregate([
      { $match: { orderStatus: { $nin: ['canceled', 'failed'] }, createdAt: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59Z') } } },
      { $group: { _id: null, total: { $sum: '$orderAmount' }, tax: { $sum: '$taxAmount' } } },
    ]),
    PurchaseBill.aggregate([
      { $match: { status: { $nin: ['draft', 'void', 'paid'] } } },
      { $group: { _id: null, total: { $sum: '$balanceDue' } } },
    ]),
  ]);

  return {
    purchaseTotal:  money(purchaseAgg[0]?.total || 0),
    purchaseTax:    money(purchaseAgg[0]?.tax   || 0),
    payments:       money(paymentsAgg[0]?.total || 0),
    salesTotal:     money(salesAgg[0]?.total    || 0),
    salesTax:       money(salesAgg[0]?.tax      || 0),
    payableOpen:    money(payableOpen[0]?.total  || 0),
  };
};

module.exports = {
  resolveDateRange,
  gstr3bSummary,
  gstSummaryByRate,
  hsnSummary,
  payableAging,
  grnRegister,
  paymentRegister,
  poDetails,
  hubKpis,
};

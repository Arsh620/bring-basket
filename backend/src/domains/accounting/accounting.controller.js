const { success } = require('../../utils/response');
const journal = require('./journal.service');
const gst     = require('./gst.service');

const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (err) { next(err); }
};

const range = (req) => {
  const [from, to] = gst.resolveDateRange(req.query.filter, req.query.from, req.query.to);
  return { from, to };
};

// ── Ledgers ───────────────────────────────────────────────────────────────────
exports.getLedgers = run(async (req, res) => {
  const result = await journal.getLedgers(req.query);
  res.json({ success: true, data: result.ledgers, pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages } });
});

exports.createLedger = run(async (req, res) => {
  const ledger = await journal.createLedger(req.body);
  success(res, ledger, 'Ledger created', 201);
});

// ── Journals ──────────────────────────────────────────────────────────────────
exports.getJournals = run(async (req, res) => {
  const { from, to } = range(req);
  const result = await journal.getJournals({ from, to, page: req.query.page, limit: req.query.limit });
  res.json({ success: true, data: result.rows, pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages } });
});

// ── Books ─────────────────────────────────────────────────────────────────────
exports.trialBalance = run(async (req, res) => {
  const { from, to } = range(req);
  const rows = await journal.trialBalance(from, to);
  success(res, { from, to, rows });
});

exports.profitLoss = run(async (req, res) => {
  const { from, to } = range(req);
  const report = await journal.profitAndLoss(from, to);
  success(res, { from, to, ...report });
});

exports.balanceSheet = run(async (req, res) => {
  const { to } = range(req);
  const report = await journal.balanceSheet(to);
  success(res, { to, ...report });
});

exports.repost = run(async (req, res) => {
  const count = await journal.repostRecent(Number(req.body.limit) || 500);
  success(res, { posted: count }, `Posted/verified ${count} journal sources`);
});

// ── GST Reports ───────────────────────────────────────────────────────────────
exports.hubKpis = run(async (req, res) => {
  const { from, to } = range(req);
  const kpis = await gst.hubKpis(from, to);
  success(res, { from, to, ...kpis });
});

exports.gstr3b = run(async (req, res) => {
  const { from, to } = range(req);
  const data = await gst.gstr3bSummary(from, to);
  success(res, { from, to, ...data });
});

exports.gstSummary = run(async (req, res) => {
  const { from, to } = range(req);
  const rows = await gst.gstSummaryByRate(from, to);
  success(res, { from, to, rows });
});

exports.hsnSummary = run(async (req, res) => {
  const { from, to } = range(req);
  const rows = await gst.hsnSummary(from, to);
  success(res, { from, to, rows });
});

exports.payableAging = run(async (req, res) => {
  const asOf = req.query.asOf || new Date().toISOString().slice(0, 10);
  const rows = await gst.payableAging(asOf, req.query);
  success(res, { asOf, rows });
});

exports.grnRegister = run(async (req, res) => {
  const { from, to } = range(req);
  const result = await gst.grnRegister(from, to, req.query);
  res.json({ success: true, data: result.bills, pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages } });
});

exports.paymentRegister = run(async (req, res) => {
  const { from, to } = range(req);
  const result = await gst.paymentRegister(from, to, req.query);
  res.json({ success: true, data: result.payments, pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages } });
});

exports.poDetails = run(async (req, res) => {
  const { from, to } = range(req);
  const result = await gst.poDetails(from, to, req.query);
  res.json({ success: true, data: result.orders, pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages } });
});

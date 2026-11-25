const svc = require('./reports.service');
const { success } = require('../../utils/response');

const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

const pg = (res, result, key) => res.json({
  success: true,
  data: result[key],
  pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages },
  ...(result.summary ? { summary: result.summary } : {}),
});

exports.orderReport        = run(async (req, res) => pg(res, await svc.orderReport(req.query), 'orders'));
exports.itemWiseReport     = run(async (req, res) => pg(res, await svc.itemWiseReport(req.query), 'items'));
exports.storeSummaryReport = run(async (req, res) => success(res, await svc.storeSummaryReport(req.query)));
exports.stockReport        = run(async (req, res) => pg(res, await svc.stockReport(req.query), 'items'));
exports.warehouseStockReport = run(async (req, res) => pg(res, await svc.warehouseStockReport(req.query), 'stocks'));
exports.brandSalesReport   = run(async (req, res) => success(res, await svc.brandSalesReport(req.query)));
exports.customerReport     = run(async (req, res) => pg(res, await svc.customerReport(req.query), 'customers'));
exports.disbursementReport = run(async (req, res) => pg(res, await svc.disbursementReport(req.query), 'details'));

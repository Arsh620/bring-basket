const svc = require('./store-disbursement.service');
const { success } = require('../../utils/response');

const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

const pg = (res, result, key) => res.json({
  success: true, data: result[key],
  pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages },
});

exports.getWallet         = run(async (req, res) => success(res, await svc.getWallet(req.params.vendorId)));
exports.getAll            = run(async (req, res) => pg(res, await svc.getAll(req.query), 'disbursements'));
exports.getDetails        = run(async (req, res) => pg(res, await svc.getDetails(req.params.id, req.query), 'details'));
exports.generate          = run(async (req, res) => success(res, await svc.generate(req.body.minAmount), 'Disbursement generated', 201));
exports.updateDetailStatus = run(async (req, res) => success(res, await svc.updateDetailStatus(req.params.detailId, req.body.status), 'Status updated'));
exports.getWithdrawRequests   = run(async (req, res) => pg(res, await svc.getWithdrawRequests(req.query), 'requests'));
exports.createWithdrawRequest = run(async (req, res) => {
  const r = await svc.createWithdrawRequest(req.vendor._id, req.body.amount, req.body.withdrawalMethodId, req.body.fields);
  success(res, r, 'Withdraw request submitted', 201);
});
exports.approveWithdrawRequest = run(async (req, res) => success(res, await svc.approveWithdrawRequest(req.params.id, req.body.approved), 'Request updated'));

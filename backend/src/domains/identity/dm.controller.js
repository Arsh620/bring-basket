const svc = require('./dm.service');
const { success } = require('../../utils/response');

const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

const pg = (res, result, key) => res.json({
  success: true,
  data: result[key],
  pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages },
});

// ── Vehicles ──────────────────────────────────────────────────────────────────
exports.getVehicles   = run(async (req, res) => success(res, await svc.getVehicles(req.query.activeOnly === 'true')));
exports.createVehicle = run(async (req, res) => success(res, await svc.createVehicle(req.body), 'Vehicle created', 201));
exports.updateVehicle = run(async (req, res) => success(res, await svc.updateVehicle(req.params.id, req.body), 'Vehicle updated'));
exports.removeVehicle = run(async (req, res) => { await svc.removeVehicle(req.params.id); success(res, null, 'Deleted'); });

// ── Admin DM Wallet ───────────────────────────────────────────────────────────
exports.adjustWallet  = run(async (req, res) => {
  const result = await svc.adjustWallet(req.params.id, req.body.amount, req.body.type, req.body.note, req.admin._id);
  success(res, result, 'Wallet adjusted');
});
exports.collectCash   = run(async (req, res) => {
  const result = await svc.collectCash(req.params.id, req.body.amount, req.body.note, req.admin._id);
  success(res, result, 'Cash collected');
});

// ── Disbursements ─────────────────────────────────────────────────────────────
exports.getDisbursements  = run(async (req, res) => pg(res, await svc.getDisbursements(req.query), 'disbursements'));
exports.createDisbursement = run(async (req, res) => {
  const d = await svc.createDisbursement(req.params.id, req.body.amount, req.body.method, req.body.note, req.admin._id);
  success(res, d, 'Disbursement created', 201);
});

// ── Reviews ───────────────────────────────────────────────────────────────────
exports.getDmReviews  = run(async (req, res) => pg(res, await svc.getReviews(req.params.id, req.query), 'reviews'));
exports.createReview  = run(async (req, res) => {
  const review = await svc.createReview(req.user?.id || req.cartActor?.ownerId, req.body.orderId, req.body.rating, req.body.comment);
  success(res, review, 'Review submitted', 201);
});

// ── DM Dashboard ──────────────────────────────────────────────────────────────
exports.getDmDashboard = run(async (req, res) => success(res, await svc.getDmDashboard(req.user.id)));

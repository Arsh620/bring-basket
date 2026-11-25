const svc = require('./item-reviews.service');
const { success } = require('../../utils/response');

const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

const pg = (res, result) => res.json({
  success: true, data: result.reviews,
  pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages },
});

exports.getAll  = run(async (req, res) => pg(res, await svc.getAll(req.query)));
exports.create  = run(async (req, res) => success(res, await svc.create(req.user?.id || req.cartActor?.ownerId, req.body), 'Review submitted', 201));
exports.toggle  = run(async (req, res) => success(res, await svc.toggle(req.params.id), 'Status toggled'));
exports.remove  = run(async (req, res) => { await svc.remove(req.params.id); success(res, null, 'Deleted'); });

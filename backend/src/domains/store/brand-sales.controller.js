const svc = require('./brand-sales.service');
const { success } = require('../../utils/response');

const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

exports.getAll    = run(async (req, res) => {
  const result = await svc.getAll(req.query);
  res.json({ success: true, data: result.sales, pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages } });
});
exports.getOne    = run(async (req, res) => success(res, await svc.getById(req.params.id)));
exports.create    = run(async (req, res) => success(res, await svc.create(req.body, req.admin._id), 'Brand sale created', 201));
exports.update    = run(async (req, res) => success(res, await svc.update(req.params.id, req.body), 'Brand sale updated'));
exports.toggle    = run(async (req, res) => success(res, await svc.toggle(req.params.id), 'Status toggled'));
exports.endNow    = run(async (req, res) => success(res, await svc.endNow(req.params.id), 'Brand sale ended'));
exports.remove    = run(async (req, res) => { await svc.remove(req.params.id); success(res, null, 'Deleted'); });

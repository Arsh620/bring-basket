const { success } = require('../../utils/response');
const svc = require('./sub-warehouses.service');

const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (err) { next(err); }
};

const motherId = (req) => String(req.warehouse._id);

exports.getAll = run(async (req, res) => {
  const result = await svc.getAll(motherId(req), req.query);
  res.json({ success: true, data: result.subs, pagination: result.pagination });
});

exports.getOne = run(async (req, res) => {
  const sub = await svc.getOne(motherId(req), req.params.id);
  success(res, sub);
});

exports.create = run(async (req, res) => {
  const sub = await svc.create(motherId(req), req.body);
  success(res, sub, 'Sub-warehouse created', 201);
});

exports.update = run(async (req, res) => {
  const sub = await svc.update(motherId(req), req.params.id, req.body);
  success(res, sub, 'Sub-warehouse updated');
});

exports.updateStatus = run(async (req, res) => {
  const sub = await svc.updateStatus(motherId(req), req.params.id, req.body.status);
  success(res, sub, 'Status updated');
});

exports.setCredentials = run(async (req, res) => {
  const sub = await svc.setCredentials(motherId(req), req.params.id, req.body);
  success(res, sub, 'Credentials set');
});

exports.getStock = run(async (req, res) => {
  const result = await svc.getStock(motherId(req), req.params.id, req.query);
  res.json({ success: true, data: result.stock, pagination: result.pagination });
});

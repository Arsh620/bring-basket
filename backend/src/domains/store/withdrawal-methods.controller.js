const svc = require('./withdrawal-methods.service');
const { success } = require('../../utils/response');

const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

exports.getAll    = run(async (req, res) => success(res, await svc.getAll(req.query.activeOnly === 'true')));
exports.create    = run(async (req, res) => success(res, await svc.create(req.body), 'Created', 201));
exports.update    = run(async (req, res) => success(res, await svc.update(req.params.id, req.body), 'Updated'));
exports.toggle    = run(async (req, res) => success(res, await svc.toggle(req.params.id), 'Status toggled'));
exports.setDefault = run(async (req, res) => success(res, await svc.setDefault(req.params.id), 'Default set'));
exports.remove    = run(async (req, res) => { await svc.remove(req.params.id); success(res, null, 'Deleted'); });

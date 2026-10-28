const { success, error } = require('../../utils/response');
const unitService = require('./units.service');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};

exports.getAll = run(async (req, res) => {
  const units = await unitService.getAll();
  success(res, units);
});

exports.getOne = run(async (req, res) => {
  const unit = await unitService.getOne(req.params.id);
  if (!unit) return error(res, 'Not found', 404);
  success(res, unit);
});

exports.create = run(async (req, res) => {
  const unit = await unitService.create(req.body?.unit);
  success(res, unit, 'Success', 201);
});

exports.update = run(async (req, res) => {
  const unit = await unitService.update(req.params.id, req.body?.unit);
  if (!unit) return error(res, 'Not found', 404);
  success(res, unit);
});

exports.remove = run(async (req, res) => {
  const unit = await unitService.remove(req.params.id);
  if (!unit) return error(res, 'Not found', 404);
  res.json({ success: true, message: 'Deleted' });
});

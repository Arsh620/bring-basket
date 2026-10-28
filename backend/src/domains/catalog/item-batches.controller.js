const { success, error } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const itemBatchService = require('./item-batches.service');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (err instanceof AppError) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.getAll = run(async (req, res) => {
  const result = await itemBatchService.getAll(req.query);
  return res.json({
    success: true,
    data: result.batches,
    pagination: result.pagination,
  });
});

exports.getOne = run(async (req, res) => {
  const batch = await itemBatchService.getById(req.params.id);
  return success(res, batch);
});

exports.create = run(async (req, res) => {
  const batch = await itemBatchService.create(req.body);
  return success(res, batch, 'Batch created', 201);
});

exports.update = run(async (req, res) => {
  const batch = await itemBatchService.update(req.params.id, req.body);
  return success(res, batch);
});

exports.remove = run(async (req, res) => {
  await itemBatchService.remove(req.params.id);
  return success(res, null, 'Deleted');
});

exports.getExpiringSoon = run(async (req, res) => {
  const batches = await itemBatchService.getExpiringSoon(req.query);
  return success(res, batches);
});

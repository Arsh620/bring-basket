const itemService = require('./items.service');
const { success, error, paginated } = require('../../utils/response');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};

exports.getAll = run(async (req, res) => {
  const result = await itemService.getAll(req.query);
  paginated(res, result.items, result.total, result.page, result.limit);
});

exports.getOne = run(async (req, res) => {
  const item = await itemService.getOne(req.params.id);
  if (!item) return error(res, 'Not found', 404);
  success(res, item);
});

exports.create = run(async (req, res) => {
  const item = await itemService.create(req.body);
  success(res, item, 'Created', 201);
});

exports.update = run(async (req, res) => {
  const item = await itemService.update(req.params.id, req.body);
  if (!item) return error(res, 'Not found', 404);
  success(res, item);
});

exports.remove = run(async (req, res) => {
  await itemService.remove(req.params.id);
  success(res, null, 'Deleted');
});

exports.updateStock = run(async (req, res) => {
  const item = await itemService.updateStock(req.params.id, req.body.stock);
  success(res, item);
});

exports.updateStatus = run(async (req, res) => {
  const item = await itemService.updateStatus(req.params.id, req.body.status);
  success(res, item);
});

exports.getLowStock = run(async (req, res) => {
  const items = await itemService.getLowStock(req.query);
  success(res, items);
});

const brandService = require('./brands.service');
const { success, error } = require('../../utils/response');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};

exports.getAll = run(async (req, res) => {
  const brands = await brandService.getAll();
  success(res, brands);
});

exports.create = run(async (req, res) => {
  const brand = await brandService.create(req.body);
  success(res, brand, 'Created', 201);
});

exports.update = run(async (req, res) => {
  const brand = await brandService.update(req.params.id, req.body);
  if (!brand) return error(res, 'Not found', 404);
  success(res, brand);
});

exports.remove = run(async (req, res) => {
  await brandService.remove(req.params.id);
  success(res, null, 'Deleted');
});

exports.updateStatus = run(async (req, res) => {
  const brand = await brandService.updateStatus(req.params.id, req.body.status);
  success(res, brand);
});

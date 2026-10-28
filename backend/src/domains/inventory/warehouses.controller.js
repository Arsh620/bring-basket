const { success, error } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const warehouseService = require('./warehouses.service');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (err instanceof AppError) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.getAll = run(async (req, res) => {
  const warehouses = await warehouseService.getAll(req.query);
  res.json({ success: true, data: warehouses });
});

exports.getOne = run(async (req, res) => {
  const warehouse = await warehouseService.getOne(req.params.id);
  success(res, warehouse);
});

exports.create = run(async (req, res) => {
  const warehouse = await warehouseService.create(req.body);
  success(res, warehouse, 'Warehouse created', 201);
});

exports.update = run(async (req, res) => {
  const warehouse = await warehouseService.update(req.params.id, req.body);
  success(res, warehouse);
});

exports.updateStatus = run(async (req, res) => {
  const warehouse = await warehouseService.updateStatus(req.params.id, req.body.status);
  success(res, warehouse);
});

exports.remove = run(async (req, res) => {
  await warehouseService.remove(req.params.id);
  success(res, null, 'Deleted');
});

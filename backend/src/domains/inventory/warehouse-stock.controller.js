const { success, error } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const warehouseStockService = require('./warehouse-stock.service');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (err instanceof AppError) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.getStock = run(async (req, res) => {
  const { stocks, pagination } = await warehouseStockService.getStock(req.params.id, req.query);
  res.json({ success: true, data: stocks, pagination });
});

exports.setStock = run(async (req, res) => {
  const stock = await warehouseStockService.setStock(req.params.id, req.params.itemId, req.body, req.user);
  success(res, stock);
});

exports.adjustStock = run(async (req, res) => {
  const result = await warehouseStockService.adjustStock(req.params.id, req.params.itemId, req.body, req.user);
  success(res, result);
});

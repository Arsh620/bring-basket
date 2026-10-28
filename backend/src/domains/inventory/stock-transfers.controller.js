const { success, error } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const stockTransferService = require('./stock-transfers.service');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (err instanceof AppError) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.getAll = run(async (req, res) => {
  const { transfers, pagination } = await stockTransferService.getAll(req.query);
  res.json({ success: true, data: transfers, pagination });
});

exports.getOne = run(async (req, res) => {
  const transfer = await stockTransferService.getOne(req.params.id);
  success(res, transfer);
});

exports.create = run(async (req, res) => {
  const transfer = await stockTransferService.create(req.body);
  success(res, transfer, 'Transfer created', 201);
});

exports.dispatch = run(async (req, res) => {
  const transfer = await stockTransferService.dispatch(req.params.id, req.body, req.user);
  success(res, transfer, 'Dispatched');
});

exports.receive = run(async (req, res) => {
  const transfer = await stockTransferService.receive(req.params.id, req.user);
  success(res, transfer, 'Received');
});

exports.reject = run(async (req, res) => {
  const transfer = await stockTransferService.reject(req.params.id, req.body.rejectReason);
  success(res, transfer, 'Rejected');
});

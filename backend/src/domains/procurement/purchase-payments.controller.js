const { success } = require('../../utils/response');
const purchasePaymentsService = require('./purchase-payments.service');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

exports.getAll = run(async (req, res) => {
  const { payments, pagination } = await purchasePaymentsService.getAll(req.query);
  res.json({ success: true, data: payments, pagination });
});

exports.record = run(async (req, res) => {
  const payment = await purchasePaymentsService.record(req.body);
  success(res, payment, 'Purchase payment recorded', 201);
});

exports.remove = run(async (req, res) => {
  await purchasePaymentsService.remove(req.params.id);
  success(res, null, 'Purchase payment deleted');
});

const { success } = require('../../utils/response');
const purchaseOrdersService = require('./purchase-orders.service');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};

exports.getAll = run(async (req, res) => {
  const { orders, pagination } = await purchaseOrdersService.getAll(req.query);
  res.json({ success: true, data: orders, pagination });
});

exports.getOne = run(async (req, res) => {
  const order = await purchaseOrdersService.getOne(req.params.id);
  success(res, order);
});

exports.create = run(async (req, res) => {
  const order = await purchaseOrdersService.create(req.body);
  success(res, order, 'Purchase order created', 201);
});

exports.update = run(async (req, res) => {
  const order = await purchaseOrdersService.update(req.params.id, req.body);
  success(res, order, 'Purchase order updated');
});

exports.issue = run(async (req, res) => {
  const order = await purchaseOrdersService.issue(req.params.id, req.user?.id);
  success(res, order, 'Purchase order issued');
});

exports.cancel = run(async (req, res) => {
  const order = await purchaseOrdersService.cancel(req.params.id);
  success(res, order, 'Purchase order cancelled');
});

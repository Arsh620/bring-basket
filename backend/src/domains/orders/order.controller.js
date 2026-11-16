const orderService = require('./order.service');
const { success } = require('../../utils/response');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

exports.place = run(async (req, res) => {
  const order = await orderService.placeOrder(
    req.cartActor,
    req.get('moduleId'),
    req.body,
    req.get('Idempotency-Key'),
  );
  success(res, order, 'Order placed', 201);
});

exports.list = run(async (req, res) => {
  success(res, await orderService.listOrders(req.cartActor, req.query, false));
});

exports.running = run(async (req, res) => {
  success(res, await orderService.listOrders(req.cartActor, req.query, true));
});

exports.details = run(async (req, res) => {
  success(res, await orderService.getOrder(req.query.order_id, req.cartActor));
});

exports.cancel = run(async (req, res) => {
  success(res, await orderService.cancelOrder(req.cartActor, req.body));
});

exports.adminList = run(async (req, res) => {
  success(res, await orderService.listAdminOrders(req.query));
});

exports.adminDetails = run(async (req, res) => {
  success(res, await orderService.getAdminOrder(req.params.id));
});

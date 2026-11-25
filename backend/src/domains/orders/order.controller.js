const orderService = require('./order.service');
const { success, paginated } = require('../../utils/response');

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

exports.vendorList = run(async (req, res) => {
  const result = await orderService.listVendorOrders(req.vendorContext, req.query);
  paginated(res, result.orders, result.total_size, result.offset, result.limit);
});

exports.vendorDashboard = run(async (req, res) => {
  success(res, await orderService.getVendorDashboard(req.vendorContext));
});

exports.vendorUpdateStatus = run(async (req, res) => {
  success(res, await orderService.updateVendorOrderStatus(req.vendorContext, req.body));
});
exports.adminList = run(async (req, res) => {
  success(res, await orderService.listAdminOrders(req.query, req.adminScope));
});

exports.adminDetails = run(async (req, res) => {
  success(res, await orderService.getAdminOrder(req.params.id, req.adminScope));
});

exports.adminDashboardStats = run(async (req, res) => {
  success(res, await orderService.getAdminDashboardStats(req.query));
});

exports.adminUpdateStatus = run(async (req, res) => {
  success(res, await orderService.adminUpdateOrderStatus(req.params.id, req.body, req.adminScope), 'Order status updated');
});

exports.listDeliverymen = run(async (req, res) => {
  success(res, await orderService.listDeliveryCandidates(req.params.id, req.adminScope));
});

exports.assignDeliveryman = run(async (req, res) => {
  success(res, await orderService.assignDeliveryman(req.params.id, req.body.deliverymanId, req.adminScope), 'Delivery person assigned');
});

exports.requestRefund = run(async (req, res) => {
  success(res, await orderService.requestRefund(req.cartActor, req.params.id, req.body.reason), 'Refund requested');
});

exports.adminHandleRefund = run(async (req, res) => {
  success(res, await orderService.adminHandleRefund(req.params.id, req.body.action, req.body.note, req.adminScope), 'Refund updated');
});

exports.listRefunds = run(async (req, res) => {
  const result = await orderService.listRefundRequests(req.query, req.adminScope);
  res.json({ success: true, data: result.orders, pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages } });
});

exports.getParcelCategories = run(async (req, res) => {
  success(res, await orderService.getParcelCategories(req.query.activeOnly === 'true'));
});

exports.createParcelCategory = run(async (req, res) => {
  success(res, await orderService.createParcelCategory(req.body), 'Parcel category created', 201);
});

exports.updateParcelCategory = run(async (req, res) => {
  success(res, await orderService.updateParcelCategory(req.params.id, req.body), 'Parcel category updated');
});

exports.removeParcelCategory = run(async (req, res) => {
  await orderService.removeParcelCategory(req.params.id);
  success(res, null, 'Deleted');
});

exports.placeParcelOrder = run(async (req, res) => {
  const order = await orderService.placeParcelOrder(
    req.cartActor,
    req.get('moduleId'),
    req.body,
    req.get('Idempotency-Key'),
  );
  success(res, order, 'Parcel order placed', 201);
});

exports.submitDmReview = run(async (req, res) => {
  const dmSvc = require('./../../domains/identity/dm.service');
  const review = await dmSvc.createReview(
    req.cartActor?.ownerId,
    req.body.orderId,
    req.body.rating,
    req.body.comment,
  );
  success(res, review, 'Review submitted', 201);
});

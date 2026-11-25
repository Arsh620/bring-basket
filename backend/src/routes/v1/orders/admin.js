const router = require('express').Router();
const orders = require('../../../domains/orders/order.controller');
const identityAdminAuth = require('../../../middleware/identity-admin-auth');

const orderAccess = [identityAdminAuth('order')];

router.get('/orders', orderAccess, orders.adminList);
router.get('/orders/refunds', orderAccess, orders.listRefunds);
router.get('/orders/:id', orderAccess, orders.adminDetails);
router.get('/orders/:id/deliverymen', orderAccess, orders.listDeliverymen);
router.patch('/orders/:id/assign-dm', orderAccess, orders.assignDeliveryman);
router.patch('/orders/:id/status', orderAccess, orders.adminUpdateStatus);
router.patch('/orders/:id/refund', orderAccess, orders.adminHandleRefund);

module.exports = router;

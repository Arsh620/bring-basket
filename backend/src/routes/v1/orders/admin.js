const router = require('express').Router();
const orders = require('../../../domains/orders/order.controller');
const { adminAuth } = require('../../../middleware/auth');

router.get('/orders', adminAuth, orders.adminList);
router.get('/orders/:id', adminAuth, orders.adminDetails);

module.exports = router;

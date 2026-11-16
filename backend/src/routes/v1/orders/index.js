const router = require('express').Router();
const cart = require('../../../domains/orders/cart.controller');
const orders = require('../../../domains/orders/order.controller');
const cartAuth = require('../../../domains/orders/cart-auth');

router.use('/cart', cartAuth);
router.post('/cart/merge-guest', cart.mergeGuest);
router.get('/cart/list', cart.list);
router.post('/cart/add', cart.add);
router.post('/cart/update', cart.update);
router.delete('/cart/remove-item', cart.removeItem);
router.delete('/cart/remove', cart.clear);

router.use('/order', cartAuth);
router.get('/order/list', orders.list);
router.get('/order/running-orders', orders.running);
router.get('/order/details', orders.details);
router.post('/order/place', orders.place);
router.put('/order/cancel', orders.cancel);

module.exports = router;

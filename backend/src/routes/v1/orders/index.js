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
router.post('/order/:id/refund-request', orders.requestRefund);
router.post('/order/place-parcel', orders.placeParcelOrder);
router.post('/dm-review', orders.submitDmReview);

// Public parcel categories
router.get('/parcel-categories', orders.getParcelCategories);

// Public cancel reasons
router.get('/cancel-reasons', (req, res, next) => {
  const svc = require('../../../domains/orders/cancel-reasons.service');
  svc.getActive(req.query.userType).then((data) => res.json({ success: true, data })).catch(next);
});

// Item reviews (customer submits)
router.post('/item-review', cartAuth, (req, res, next) => {
  const svc = require('../../../domains/catalog/item-reviews.service');
  svc.create(req.cartActor?.ownerId, req.body)
    .then((r) => res.status(201).json({ success: true, data: r, message: 'Review submitted' }))
    .catch(next);
});

module.exports = router;

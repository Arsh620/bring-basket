const router = require('express').Router();
const vendor = require('../../../domains/identity/vendor.controller');
const { vendorAuth } = require('../../../middleware/auth');

router.use(vendorAuth);

router.get('/profile', vendor.getProfile);
router.put('/update-profile', vendor.updateProfile);
router.put('/update-fcm-token', vendor.updateFcmToken);
router.get('/dashboard', vendor.getDashboard);
router.get('/stores', vendor.getStores);

// Orders
router.get('/orders', vendor.getOrders);
router.put('/orders/update-status', vendor.updateOrderStatus);

// Items
router.get('/items', vendor.getItems);
router.post('/items', vendor.createItem);
router.put('/items/:id', vendor.updateItem);
router.patch('/items/:id/status', vendor.updateItemStatus);
router.delete('/items/:id', vendor.deleteItem);

module.exports = router;

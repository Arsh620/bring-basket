const router = require('express').Router();
const dm = require('../../../domains/identity/deliveryman.controller');
const dmWallet = require('../../../domains/identity/dm-wallet.controller');
const { deliverymanAuth } = require('../../../middleware/auth');

router.use(deliverymanAuth);

router.get('/profile', dm.getProfile);
router.put('/update-profile', dm.updateProfile);
router.post('/update-active-status', dm.updateActiveStatus);
router.put('/update-fcm-token', dm.updateFcmToken);
router.get('/current-orders', dm.getCurrentOrders);
router.get('/all-orders', dm.getAllOrders);
router.get('/order-delivery-history', dm.getOrderHistory);
router.get('/order', dm.getOrder);
router.put('/accept-order', dm.acceptOrder);
router.put('/update-order-status', dm.updateOrderStatus);
router.get('/notifications', dm.getNotifications);
router.post('/record-location', dm.recordLocation);

// Wallet & Earnings
router.get('/wallet/balance', dmWallet.balance);
router.get('/wallet/transactions', dmWallet.transactions);
router.get('/earnings', dmWallet.earnings);

module.exports = router;

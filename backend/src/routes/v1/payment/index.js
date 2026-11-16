const router = require('express').Router();
const razorpay = require('../../../domains/store/razorpay.controller');
const { customerAuth, adminAuth } = require('../../../middleware/auth');
const { checkRole } = require('../../../middleware/roleCheck');

// Webhook — raw body needed, no auth
router.post('/razorpay/webhook', razorpay.webhook);

// Customer routes
router.post('/razorpay/create-order', customerAuth, razorpay.createOrder);
router.post('/razorpay/verify', customerAuth, razorpay.verify);
router.get('/razorpay/history', customerAuth, razorpay.history);

// Admin — refund
router.post('/razorpay/refund', [adminAuth, checkRole('admin')], razorpay.refund);

module.exports = router;

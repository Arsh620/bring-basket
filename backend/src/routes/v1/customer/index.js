const router = require('express').Router();
const items = require('../../../domains/catalog/customer-items.controller');
const categories = require('../../../domains/catalog/customer-categories.controller');
const wishlist = require('../../../domains/catalog/wishlist.controller');
const stores = require('../../../domains/store/customer-stores.controller');
const banners = require('../../../domains/store/banners.controller');
const coupons = require('../../../domains/store/coupons.controller');
const config = require('../../../domains/store/config.controller');
const flashSales = require('../../../domains/store/flash-sales.controller');
const campaigns = require('../../../domains/store/campaigns.controller');
const advertisements = require('../../../domains/store/advertisements.controller');
const notifications = require('../../../domains/identity/notifications.controller');
const notifExt = require('../../../domains/identity/notification-extended.controller');
const wallet = require('../../../domains/identity/wallet.controller');
const profile = require('../../../domains/identity/customer-profile.controller');
const otp = require('../../../domains/identity/customer-otp.controller');
const loyalty = require('../../../domains/identity/loyalty.controller');
const cashback = require('../../../domains/store/cashback.controller');
const { customerAuth } = require('../../../middleware/auth');
const { authLimiter } = require('../../../middleware/rateLimiter');

// Config & Pages
router.get('/config', config.getConfig);
router.get('/terms-and-conditions', config.getPage('terms_and_conditions'));
router.get('/about-us', config.getPage('about_us'));
router.get('/privacy-policy', config.getPage('privacy_policy'));
router.get('/refund-policy', config.getPage('refund_policy'));
router.get('/shipping-policy', config.getPage('shipping_policy'));
router.get('/cancellation', config.getPage('cancellation_policy'));

// Zones
router.get('/zones', config.getZones);
router.post('/zones/check', config.checkZone);

// OTP Password Reset
router.post('/customer/auth/forgot-password', authLimiter, otp.forgotPassword);
router.post('/customer/auth/verify-otp', authLimiter, otp.verifyOtp);
router.put('/customer/auth/reset-password', otp.resetPassword);

// Items
router.get('/items', items.getAll);
router.get('/items/latest', items.getLatest);
router.get('/items/popular', items.getPopular);
router.get('/items/discounted', items.getDiscounted);
router.get('/items/recommended', items.getRecommended);
router.get('/items/most-reviewed', items.getMostReviewed);
router.get('/items/search', items.search);
router.get('/items/search-suggestion', items.searchSuggestion);
router.get('/items/:id', items.getOne);
router.get('/items/:id/reviews', items.getReviews);
router.post('/items/reviews/submit', customerAuth, items.submitReview);

// Categories
router.get('/categories', categories.getAll);
router.get('/categories/popular', categories.getPopular);
router.get('/categories/:id/children', categories.getChildren);
router.get('/categories/:id/items', categories.getItems);

// Stores
router.get('/stores', stores.getAll);
router.get('/stores/latest', stores.getLatest);
router.get('/stores/popular', stores.getPopular);
router.get('/stores/search', stores.search);
router.get('/stores/:id', stores.getOne);

// Banners
router.get('/banners', banners.getAll);
router.get('/banners/store/:storeId', banners.getByStore);

// Flash Sales
router.get('/flash-sales', flashSales.getActive);
router.get('/flash-sales/items', flashSales.getItems);

// Campaigns
router.get('/campaigns/basic', campaigns.getBasic);
router.get('/campaigns/item', campaigns.getItem);

// Advertisements
router.get('/advertisements', advertisements.getAll);

// Coupons
router.get('/coupons', coupons.list);
router.get('/coupons/apply', customerAuth, coupons.apply);

// Cashback
router.get('/cashback/list', cashback.list);
router.get('/cashback/getCashback', cashback.getCashback);

// Customer Profile
router.get('/customer/info', customerAuth, profile.info);
router.post('/customer/update-profile', customerAuth, profile.updateProfile);
router.put('/customer/cm-firebase-token', customerAuth, profile.updateFirebaseToken);
router.delete('/customer/remove-account', customerAuth, profile.removeAccount);

// Wishlist
router.get('/customer/wish-list', customerAuth, wishlist.list);
router.post('/customer/wish-list/add', customerAuth, wishlist.add);
router.delete('/customer/wish-list/remove', customerAuth, wishlist.remove);

// Wallet
router.get('/customer/wallet/balance', customerAuth, wallet.balance);
router.get('/customer/wallet/transactions', customerAuth, wallet.transactions);
router.get('/customer/wallet/bonuses', customerAuth, wallet.bonuses);
router.post('/customer/wallet/add-fund', customerAuth, wallet.addFund);

// Loyalty Points
router.get('/customer/loyalty-point/transactions', customerAuth, loyalty.transactions);
router.post('/customer/loyalty-point/point-transfer', customerAuth, loyalty.pointTransfer);

// Notifications
router.get('/customer/notifications', customerAuth, notifications.getCustomerNotifications);
router.put('/customer/notifications/read-all', customerAuth, notifications.markAllRead);
router.put('/customer/notifications/:id/read', customerAuth, notifications.markRead);

// Chat (customer ↔ admin)
router.get('/customer/conversations', customerAuth, notifExt.customerGetConversations);
router.get('/customer/conversations/:id/messages', customerAuth, notifExt.customerGetMessages);
router.post('/customer/conversations/send', customerAuth, notifExt.customerSendMessage);

module.exports = router;

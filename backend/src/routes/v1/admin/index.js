const router = require('express').Router();
const banners = require('../../../domains/store/banners.controller');
const coupons = require('../../../domains/store/coupons.controller');
const config = require('../../../domains/store/config.controller');
const notifications = require('../../../domains/identity/notifications.controller');
const flashSales = require('../../../domains/store/flash-sales.controller');
const campaigns = require('../../../domains/store/campaigns.controller');
const advertisements = require('../../../domains/store/advertisements.controller');
const customers = require('../../../domains/identity/customers.controller');
const vendors = require('../../../domains/identity/vendors-admin.controller');
const deliveryMen = require('../../../domains/identity/delivery-men-admin.controller');
const cashback = require('../../../domains/store/cashback.controller');
const walletBonus = require('../../../domains/store/wallet-bonus.controller');
const { adminAuth } = require('../../../middleware/auth');
const { checkRole } = require('../../../middleware/roleCheck');

const adminOnly = [adminAuth, checkRole('admin')];

// Banners
router.get('/banners', adminOnly, banners.adminGetAll);
router.post('/banners', adminOnly, banners.adminCreate);
router.put('/banners/:id', adminOnly, banners.adminUpdate);
router.patch('/banners/:id/status', adminOnly, banners.adminUpdateStatus);
router.delete('/banners/:id', adminOnly, banners.adminDelete);

// Coupons
router.get('/coupons', adminOnly, coupons.adminGetAll);
router.post('/coupons', adminOnly, coupons.adminCreate);
router.put('/coupons/:id', adminOnly, coupons.adminUpdate);
router.patch('/coupons/:id/status', adminOnly, coupons.adminUpdateStatus);
router.delete('/coupons/:id', adminOnly, coupons.adminDelete);

// Flash Sales
router.get('/flash-sales', adminOnly, flashSales.adminGetAll);
router.post('/flash-sales', adminOnly, flashSales.adminCreate);
router.get('/flash-sales/:id', adminOnly, flashSales.adminGetOne);
router.put('/flash-sales/:id', adminOnly, flashSales.adminUpdate);
router.patch('/flash-sales/:id/status', adminOnly, flashSales.adminUpdateStatus);
router.delete('/flash-sales/:id', adminOnly, flashSales.adminDelete);

// Campaigns
router.get('/campaigns', adminOnly, campaigns.adminGetAll);
router.post('/campaigns', adminOnly, campaigns.adminCreate);
router.put('/campaigns/:id', adminOnly, campaigns.adminUpdate);
router.patch('/campaigns/:id/status', adminOnly, campaigns.adminUpdateStatus);
router.delete('/campaigns/:id', adminOnly, campaigns.adminDelete);

// Advertisements
router.get('/advertisements', adminOnly, advertisements.adminGetAll);
router.post('/advertisements', adminOnly, advertisements.adminCreate);
router.put('/advertisements/:id', adminOnly, advertisements.adminUpdate);
router.patch('/advertisements/:id/status', adminOnly, advertisements.adminUpdateStatus);
router.delete('/advertisements/:id', adminOnly, advertisements.adminDelete);

// Business Settings
router.get('/settings', adminOnly, config.adminGetAll);
router.post('/settings', adminOnly, config.adminUpsert);
router.post('/settings/bulk', adminOnly, config.adminBulkUpsert);

// Notifications broadcast
router.post('/notifications/broadcast', adminOnly, notifications.adminBroadcast);

// Customer Management
router.get('/customers', adminOnly, customers.getAll);
router.get('/customers/:id', adminOnly, customers.getOne);
router.patch('/customers/:id/status', adminOnly, customers.updateStatus);
router.post('/customers/:id/wallet/add-fund', adminOnly, customers.addWalletFund);
router.post('/customers/:id/loyalty/adjust', adminOnly, customers.adjustLoyalty);
router.get('/customers/:id/orders', adminOnly, customers.getOrders);

// Vendor Management
router.get('/vendors', adminOnly, vendors.getAll);
router.get('/vendors/:id', adminOnly, vendors.getOne);
router.patch('/vendors/:id/status', adminOnly, vendors.updateStatus);
router.delete('/vendors/:id', adminOnly, vendors.remove);
router.get('/vendors/:id/stores', adminOnly, vendors.getStores);

// Delivery Man Management
router.get('/delivery-men', adminOnly, deliveryMen.getAll);
router.post('/delivery-men', adminOnly, deliveryMen.create);
router.get('/delivery-men/:id', adminOnly, deliveryMen.getOne);
router.put('/delivery-men/:id', adminOnly, deliveryMen.update);
router.patch('/delivery-men/:id/status', adminOnly, deliveryMen.updateStatus);
router.patch('/delivery-men/:id/application', adminOnly, deliveryMen.updateApplication);
router.delete('/delivery-men/:id', adminOnly, deliveryMen.remove);

// Cashback Management
router.get('/cashback', adminOnly, cashback.adminGetAll);
router.post('/cashback', adminOnly, cashback.adminCreate);
router.put('/cashback/:id', adminOnly, cashback.adminUpdate);
router.patch('/cashback/:id/status', adminOnly, cashback.adminUpdateStatus);
router.delete('/cashback/:id', adminOnly, cashback.adminDelete);

// Wallet Bonus Management
router.get('/wallet-bonus', adminOnly, walletBonus.getAll);
router.post('/wallet-bonus', adminOnly, walletBonus.create);
router.put('/wallet-bonus/:id', adminOnly, walletBonus.update);
router.patch('/wallet-bonus/:id/status', adminOnly, walletBonus.updateStatus);
router.delete('/wallet-bonus/:id', adminOnly, walletBonus.remove);

module.exports = router;

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
const dmCtrl = require('../../../domains/identity/dm.controller');
const cashback = require('../../../domains/store/cashback.controller');
const walletBonus = require('../../../domains/store/wallet-bonus.controller');
const disbursement = require('../../../domains/store/store-disbursement.controller');
const withdrawalMethods = require('../../../domains/store/withdrawal-methods.controller');
const itemReviews = require('../../../domains/catalog/item-reviews.controller');
const misc = require('../../../domains/store/misc.controller');
const reports = require('../../../domains/store/reports.controller');
const notifExt = require('../../../domains/identity/notification-extended.controller');
const { adminAuth, checkAdminModule } = require('../../../middleware/auth');
const { checkRole } = require('../../../middleware/roleCheck');
const orderProxy = require('../../../domains/orders/order-proxy.controller');
const orders = require('../../../domains/orders/order.controller');

const adminOnly = [adminAuth, checkRole('admin')];
const access = (module) => [...adminOnly, checkAdminModule(module)];

// Dashboard analytics
router.get('/dashboard/order-stats', access('order'), orderProxy.adminDashboardStats);
router.get('/dashboard/customer-stats', access('customer_management'), customers.getDashboardStats);

// Orders
router.get('/orders', access('order'), orders.adminList);
router.get('/orders/refunds', access('order'), orders.listRefunds);
router.get('/orders/:id', access('order'), orders.adminDetails);
router.get('/orders/:id/deliverymen', access('order'), orders.listDeliverymen);
router.patch('/orders/:id/status', access('order'), orders.adminUpdateStatus);
router.patch('/orders/:id/assign-dm', access('order'), orders.assignDeliveryman);
router.patch('/orders/:id/refund', access('order'), orders.adminHandleRefund);

// Parcel Categories
router.get('/parcel-categories', access('parcel'), orders.getParcelCategories);
router.post('/parcel-categories', access('parcel'), orders.createParcelCategory);
router.put('/parcel-categories/:id', access('parcel'), orders.updateParcelCategory);
router.delete('/parcel-categories/:id', access('parcel'), orders.removeParcelCategory);

// Banners
router.get('/banners', access('banner'), banners.adminGetAll);
router.post('/banners', access('banner'), banners.adminCreate);
router.put('/banners/:id', access('banner'), banners.adminUpdate);
router.patch('/banners/:id/status', access('banner'), banners.adminUpdateStatus);
router.delete('/banners/:id', access('banner'), banners.adminDelete);

// Coupons
router.get('/coupons', access('coupon'), coupons.adminGetAll);
router.post('/coupons', access('coupon'), coupons.adminCreate);
router.put('/coupons/:id', access('coupon'), coupons.adminUpdate);
router.patch('/coupons/:id/status', access('coupon'), coupons.adminUpdateStatus);
router.delete('/coupons/:id', access('coupon'), coupons.adminDelete);

// Flash Sales
router.get('/flash-sales', access('campaign'), flashSales.adminGetAll);
router.post('/flash-sales', access('campaign'), flashSales.adminCreate);
router.get('/flash-sales/:id', access('campaign'), flashSales.adminGetOne);
router.put('/flash-sales/:id', access('campaign'), flashSales.adminUpdate);
router.patch('/flash-sales/:id/status', access('campaign'), flashSales.adminUpdateStatus);
router.delete('/flash-sales/:id', access('campaign'), flashSales.adminDelete);

// Campaigns
router.get('/campaigns', access('campaign'), campaigns.adminGetAll);
router.post('/campaigns', access('campaign'), campaigns.adminCreate);
router.put('/campaigns/:id', access('campaign'), campaigns.adminUpdate);
router.patch('/campaigns/:id/status', access('campaign'), campaigns.adminUpdateStatus);
router.delete('/campaigns/:id', access('campaign'), campaigns.adminDelete);

// Advertisements
router.get('/advertisements', access('campaign'), advertisements.adminGetAll);
router.post('/advertisements', access('campaign'), advertisements.adminCreate);
router.put('/advertisements/:id', access('campaign'), advertisements.adminUpdate);
router.patch('/advertisements/:id/status', access('campaign'), advertisements.adminUpdateStatus);
router.delete('/advertisements/:id', access('campaign'), advertisements.adminDelete);

// Business Settings
router.get('/settings', access('settings'), config.adminGetAll);
router.post('/settings', access('settings'), config.adminUpsert);
router.post('/settings/bulk', access('settings'), config.adminBulkUpsert);

// Notifications broadcast
router.post('/notifications/broadcast', access('notification'), notifExt.adminBroadcast);

// Push Notification Templates
router.get('/notifications', access('notification'), notifExt.getPushNotifications);
router.post('/notifications', access('notification'), notifExt.createPushNotification);
router.put('/notifications/:id', access('notification'), notifExt.updatePushNotification);
router.post('/notifications/:id/send', access('notification'), notifExt.sendPushNotification);
router.delete('/notifications/:id', access('notification'), notifExt.removePushNotification);

// Automated Messages
router.get('/automated-messages', access('notification'), notifExt.getAutomatedMessages);
router.post('/automated-messages', access('notification'), notifExt.createAutomatedMessage);
router.put('/automated-messages/:id', access('notification'), notifExt.updateAutomatedMessage);
router.patch('/automated-messages/:id/toggle', access('notification'), notifExt.toggleAutomatedMessage);
router.delete('/automated-messages/:id', access('notification'), notifExt.removeAutomatedMessage);

// Conversations (admin ↔ customer/vendor)
router.get('/conversations', access('notification'), notifExt.adminGetConversations);
router.get('/conversations/:id/messages', access('notification'), notifExt.adminGetMessages);
router.post('/conversations/send', access('notification'), notifExt.adminSendMessage);

// Customer Management
router.get('/customers', access('customer_management'), customers.getAll);
router.get('/customers/:id', access('customer_management'), customers.getOne);
router.patch('/customers/:id/status', access('customer_management'), customers.updateStatus);
router.post('/customers/:id/wallet/add-fund', access('customer_management'), customers.addWalletFund);
router.post('/customers/:id/loyalty/adjust', access('customer_management'), customers.adjustLoyalty);
router.get('/customers/:id/orders', access('customer_management'), customers.getOrders);

// Vendor Management
router.get('/vendors', access('store'), vendors.getAll);
router.get('/vendors/:id', access('store'), vendors.getOne);
router.patch('/vendors/:id/status', access('store'), vendors.updateStatus);
router.delete('/vendors/:id', access('store'), vendors.remove);
router.get('/vendors/:id/stores', access('store'), vendors.getStores);

// Delivery Man Management
router.get('/delivery-men', access('deliveryman'), deliveryMen.getAll);
router.post('/delivery-men', access('deliveryman'), deliveryMen.create);
router.get('/delivery-men/:id', access('deliveryman'), deliveryMen.getOne);
router.put('/delivery-men/:id', access('deliveryman'), deliveryMen.update);
router.patch('/delivery-men/:id/status', access('deliveryman'), deliveryMen.updateStatus);
router.patch('/delivery-men/:id/application', access('deliveryman'), deliveryMen.updateApplication);
router.delete('/delivery-men/:id', access('deliveryman'), deliveryMen.remove);

// DM Wallet & Disbursement
router.patch('/delivery-men/:id/wallet/adjust', access('deliveryman'), dmCtrl.adjustWallet);
router.post('/delivery-men/:id/wallet/collect-cash', access('collect_cash'), dmCtrl.collectCash);
router.get('/delivery-men/disbursements', access('deliveryman'), dmCtrl.getDisbursements);
router.post('/delivery-men/:id/disbursements', access('provide_dm_earning'), dmCtrl.createDisbursement);

// DM Reviews
router.get('/delivery-men/:id/reviews', access('deliveryman'), dmCtrl.getDmReviews);

// DM Vehicles
router.get('/vehicles', access('deliveryman'), dmCtrl.getVehicles);
router.post('/vehicles', access('deliveryman'), dmCtrl.createVehicle);
router.put('/vehicles/:id', access('deliveryman'), dmCtrl.updateVehicle);
router.delete('/vehicles/:id', access('deliveryman'), dmCtrl.removeVehicle);

// Cashback Management
router.get('/cashback', access('cashback'), cashback.adminGetAll);
router.post('/cashback', access('cashback'), cashback.adminCreate);
router.put('/cashback/:id', access('cashback'), cashback.adminUpdate);
router.patch('/cashback/:id/status', access('cashback'), cashback.adminUpdateStatus);
router.delete('/cashback/:id', access('cashback'), cashback.adminDelete);

// Wallet Bonus Management
router.get('/wallet-bonus', access('customer_management'), walletBonus.getAll);
router.post('/wallet-bonus', access('customer_management'), walletBonus.create);
router.put('/wallet-bonus/:id', access('customer_management'), walletBonus.update);
router.patch('/wallet-bonus/:id/status', access('customer_management'), walletBonus.updateStatus);
router.delete('/wallet-bonus/:id', access('customer_management'), walletBonus.remove);

// Withdrawal Methods
router.get('/withdrawal-methods', access('settings'), withdrawalMethods.getAll);
router.post('/withdrawal-methods', access('settings'), withdrawalMethods.create);
router.put('/withdrawal-methods/:id', access('settings'), withdrawalMethods.update);
router.patch('/withdrawal-methods/:id/toggle', access('settings'), withdrawalMethods.toggle);
router.patch('/withdrawal-methods/:id/set-default', access('settings'), withdrawalMethods.setDefault);
router.delete('/withdrawal-methods/:id', access('settings'), withdrawalMethods.remove);

// Store Disbursement
router.get('/store-disbursements', access('report'), disbursement.getAll);
router.post('/store-disbursements/generate', access('report'), disbursement.generate);
router.get('/store-disbursements/:id/details', access('report'), disbursement.getDetails);
router.patch('/store-disbursements/details/:detailId/status', access('report'), disbursement.updateDetailStatus);
router.get('/vendors/:vendorId/wallet', access('store'), disbursement.getWallet);

// Vendor Withdraw Requests
router.get('/withdraw-requests', access('withdraw_list'), disbursement.getWithdrawRequests);
router.patch('/withdraw-requests/:id/approve', access('withdraw_list'), disbursement.approveWithdrawRequest);

// Item Reviews
router.get('/reviews', access('report'), itemReviews.getAll);
router.patch('/reviews/:id/toggle', access('report'), itemReviews.toggle);
router.delete('/reviews/:id', access('report'), itemReviews.remove);

// Order Cancel Reasons
router.get('/cancel-reasons', access('order'), misc.getCancelReasons);
router.post('/cancel-reasons', access('order'), misc.createCancelReason);
router.put('/cancel-reasons/:id', access('order'), misc.updateCancelReason);
router.patch('/cancel-reasons/:id/toggle', access('order'), misc.toggleCancelReason);
router.delete('/cancel-reasons/:id', access('order'), misc.removeCancelReason);

// Activity Logs
router.get('/activity-logs', access('report'), misc.getActivityLogs);

// Reports
router.get('/reports/orders', access('report'), reports.orderReport);
router.get('/reports/items', access('report'), reports.itemWiseReport);
router.get('/reports/store-summary', access('report'), reports.storeSummaryReport);
router.get('/reports/stock', access('report'), reports.stockReport);
router.get('/reports/warehouse-stock', access('report'), reports.warehouseStockReport);
router.get('/reports/brands', access('report'), reports.brandSalesReport);
router.get('/reports/customers', access('report'), reports.customerReport);
router.get('/reports/disbursements', access('report'), reports.disbursementReport);

module.exports = router;

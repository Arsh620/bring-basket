const router = require('express').Router();
const rc = require('../../../domains/retention/retention.controller');
const { adminAuth, checkAdminModule } = require('../../../middleware/auth');
const { checkRole } = require('../../../middleware/roleCheck');

const admin = [adminAuth, checkRole('admin')];
const customerAccess = [...admin, checkAdminModule('customer_management')];
const cashbackAccess = [...admin, checkAdminModule('cashback')];
const walletAccess   = [...admin, checkAdminModule('customer_management')];

// Membership Plans
router.get('/membership/dashboard',          ...customerAccess, rc.getMembershipDashboard);
router.get('/membership/plans',              ...customerAccess, rc.getPlans);
router.post('/membership/plans',             ...customerAccess, rc.createPlan);
router.get('/membership/plans/:id',          ...customerAccess, rc.getPlan);
router.put('/membership/plans/:id',          ...customerAccess, rc.updatePlan);
router.patch('/membership/plans/:id/toggle', ...customerAccess, rc.togglePlan);

// Subscriptions
router.get('/membership/subscriptions',              ...customerAccess, rc.getSubscriptions);
router.post('/membership/subscriptions',             ...customerAccess, rc.subscribeCustomer);
router.patch('/membership/subscriptions/:id/status', ...customerAccess, rc.updateSubscriptionStatus);

// Loyalty Points
router.get('/loyalty/transactions',              ...customerAccess, rc.getLoyaltyTransactions);
router.post('/loyalty/customers/:userId/adjust', ...customerAccess, rc.adjustLoyaltyPoints);

// Wallet Fund
router.post('/wallet/customers/:userId/add-fund', ...walletAccess, rc.addWalletFund);

// Cashback
router.get('/cashback',              ...cashbackAccess, rc.getCashbacks);
router.post('/cashback',             ...cashbackAccess, rc.createCashback);
router.put('/cashback/:id',          ...cashbackAccess, rc.updateCashback);
router.patch('/cashback/:id/toggle', ...cashbackAccess, rc.toggleCashback);
router.delete('/cashback/:id',       ...cashbackAccess, rc.removeCashback);

// Wallet Bonus
router.get('/wallet-bonus',              ...walletAccess, rc.getWalletBonuses);
router.post('/wallet-bonus',             ...walletAccess, rc.createWalletBonus);
router.put('/wallet-bonus/:id',          ...walletAccess, rc.updateWalletBonus);
router.patch('/wallet-bonus/:id/toggle', ...walletAccess, rc.toggleWalletBonus);
router.delete('/wallet-bonus/:id',       ...walletAccess, rc.removeWalletBonus);

module.exports = router;

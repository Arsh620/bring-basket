const { success } = require('../../utils/response');
const svc = require('./retention.service');

const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (err) { next(err); }
};

const paginated = (res, result, dataKey) =>
  res.json({ success: true, data: result[dataKey], pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages } });

// ── Membership Plans ──────────────────────────────────────────────────────────
exports.getPlans       = run(async (req, res) => success(res, await svc.getPlans(req.query)));
exports.getPlan        = run(async (req, res) => success(res, await svc.getPlan(req.params.id)));
exports.createPlan     = run(async (req, res) => success(res, await svc.createPlan(req.body), 'Plan created', 201));
exports.updatePlan     = run(async (req, res) => success(res, await svc.updatePlan(req.params.id, req.body), 'Plan updated'));
exports.togglePlan     = run(async (req, res) => success(res, await svc.togglePlan(req.params.id), 'Plan status toggled'));

// ── Subscriptions ─────────────────────────────────────────────────────────────
exports.getMembershipDashboard = run(async (req, res) => success(res, await svc.getMembershipDashboard()));
exports.getSubscriptions       = run(async (req, res) => paginated(res, await svc.getSubscriptions(req.query), 'subs'));
exports.subscribeCustomer      = run(async (req, res) => {
  const { userId, planId, pricePaid, purchasedVia } = req.body;
  const sub = await svc.subscribeCustomer(userId, planId, pricePaid, purchasedVia);
  success(res, sub, 'Customer subscribed', 201);
});
exports.updateSubscriptionStatus = run(async (req, res) => success(res, await svc.updateSubscriptionStatus(req.params.id, req.body.status), 'Status updated'));

// ── Loyalty Points ────────────────────────────────────────────────────────────
exports.getLoyaltyTransactions = run(async (req, res) => paginated(res, await svc.getLoyaltyTransactions(req.query), 'transactions'));
exports.adjustLoyaltyPoints    = run(async (req, res) => {
  const tx = await svc.adjustLoyaltyPoints(req.params.userId, req.body.points, req.body.type, req.body.note);
  success(res, tx, 'Loyalty points adjusted');
});

// ── Wallet Fund ───────────────────────────────────────────────────────────────
exports.addWalletFund = run(async (req, res) => {
  const result = await svc.addWalletFund(req.params.userId, req.body.amount, req.body.note);
  success(res, result, 'Wallet funded');
});

// ── Cashback ──────────────────────────────────────────────────────────────────
exports.getCashbacks    = run(async (req, res) => paginated(res, await svc.getCashbacks(req.query), 'cashbacks'));
exports.createCashback  = run(async (req, res) => success(res, await svc.createCashback(req.body), 'Cashback created', 201));
exports.updateCashback  = run(async (req, res) => success(res, await svc.updateCashback(req.params.id, req.body), 'Cashback updated'));
exports.toggleCashback  = run(async (req, res) => success(res, await svc.toggleCashback(req.params.id), 'Status toggled'));
exports.removeCashback  = run(async (req, res) => { await svc.removeCashback(req.params.id); success(res, null, 'Cashback deleted'); });

// ── Wallet Bonus ──────────────────────────────────────────────────────────────
exports.getWalletBonuses   = run(async (req, res) => paginated(res, await svc.getWalletBonuses(req.query), 'bonuses'));
exports.createWalletBonus  = run(async (req, res) => success(res, await svc.createWalletBonus(req.body), 'Wallet bonus created', 201));
exports.updateWalletBonus  = run(async (req, res) => success(res, await svc.updateWalletBonus(req.params.id, req.body), 'Wallet bonus updated'));
exports.toggleWalletBonus  = run(async (req, res) => success(res, await svc.toggleWalletBonus(req.params.id), 'Status toggled'));
exports.removeWalletBonus  = run(async (req, res) => { await svc.removeWalletBonus(req.params.id); success(res, null, 'Wallet bonus deleted'); });

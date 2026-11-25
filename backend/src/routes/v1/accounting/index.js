const router = require('express').Router();
const ac = require('../../../domains/accounting/accounting.controller');
const { adminAuth, checkAdminModule } = require('../../../middleware/auth');
const { checkRole } = require('../../../middleware/roleCheck');

const access = [adminAuth, checkRole('admin'), checkAdminModule('account')];

router.get('/kpis',             ...access, ac.hubKpis);
router.get('/ledgers',          ...access, ac.getLedgers);
router.post('/ledgers',         ...access, ac.createLedger);
router.get('/journals',         ...access, ac.getJournals);
router.post('/repost',          ...access, ac.repost);
router.get('/trial-balance',    ...access, ac.trialBalance);
router.get('/profit-loss',      ...access, ac.profitLoss);
router.get('/balance-sheet',    ...access, ac.balanceSheet);
router.get('/gstr3b',           ...access, ac.gstr3b);
router.get('/gst-summary',      ...access, ac.gstSummary);
router.get('/hsn-summary',      ...access, ac.hsnSummary);
router.get('/payable-aging',    ...access, ac.payableAging);
router.get('/grn-register',     ...access, ac.grnRegister);
router.get('/payment-register', ...access, ac.paymentRegister);
router.get('/po-details',       ...access, ac.poDetails);

module.exports = router;

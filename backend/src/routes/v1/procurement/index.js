const router = require('express').Router();
const { adminAuth } = require('../../../middleware/auth');
const { checkRole } = require('../../../middleware/roleCheck');
const purchaseVendors = require('../../../domains/procurement/purchase-vendors.controller');
const purchaseOrders = require('../../../domains/procurement/purchase-orders.controller');
const purchaseBills = require('../../../domains/procurement/purchase-bills.controller');
const purchasePayments = require('../../../domains/procurement/purchase-payments.controller');
const purchaseBillInvoiceUpload = require('../../../domains/procurement/purchase-bill-invoice-upload');

const adminOnly = [adminAuth, checkRole('admin')];

router.get('/purchases/vendors', adminOnly, purchaseVendors.getAll);
router.get('/purchases/vendors/:id', adminOnly, purchaseVendors.getOne);
router.post('/purchases/vendors', adminOnly, purchaseVendors.create);
router.put('/purchases/vendors/:id', adminOnly, purchaseVendors.update);
router.patch('/purchases/vendors/:id/status', adminOnly, purchaseVendors.updateStatus);
router.patch('/purchases/vendors/:id/approval', adminOnly, purchaseVendors.updateApproval);
router.delete('/purchases/vendors/:id', adminOnly, purchaseVendors.remove);

router.get('/purchases/orders', adminOnly, purchaseOrders.getAll);
router.get('/purchases/orders/:id', adminOnly, purchaseOrders.getOne);
router.post('/purchases/orders', adminOnly, purchaseOrders.create);
router.put('/purchases/orders/:id', adminOnly, purchaseOrders.update);
router.post('/purchases/orders/:id/issue', adminOnly, purchaseOrders.issue);
router.post('/purchases/orders/:id/cancel', adminOnly, purchaseOrders.cancel);
router.post('/purchases/orders/:id/convert-to-bill', adminOnly, purchaseBills.convertFromOrder);

router.get('/purchases/bills', adminOnly, purchaseBills.getAll);
router.get('/purchases/bills/:id', adminOnly, purchaseBills.getOne);
router.put('/purchases/bills/:id', adminOnly, purchaseBills.update);
router.post('/purchases/bills/:id/void', adminOnly, purchaseBills.void);
router.get('/purchases/bills/:id/grn-invoice', adminOnly, purchaseBills.downloadGrnInvoice);
router.post(
  '/purchases/bills/:id/mark-stock-received',
  adminOnly,
  purchaseBillInvoiceUpload.single('invoice'),
  purchaseBills.receiveStock,
);

router.get('/purchases/payments', adminOnly, purchasePayments.getAll);
router.post('/purchases/payments', adminOnly, purchasePayments.record);
router.delete('/purchases/payments/:id', adminOnly, purchasePayments.remove);

module.exports = router;

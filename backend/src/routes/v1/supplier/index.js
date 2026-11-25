const router = require('express').Router();
const supplierPortal = require('../../../domains/procurement/supplier-portal.controller');
const supplierRegistration = require('../../../domains/procurement/supplier-registration.controller');
const supplierRegistrationUpload = require('../../../domains/procurement/supplier-registration-upload');
const PurchaseOrder = require('../../../models/purchase/PurchaseOrder');
const PurchaseBill = require('../../../models/purchase/PurchaseBill');
const PurchasePayment = require('../../../models/purchase/PurchasePayment');
const PurchaseVendor = require('../../../models/purchase/PurchaseVendor');
const { supplierAuth } = require('../../../middleware/auth');
const requireActiveSupplier = require('../../../domains/procurement/supplier-portal.middleware');
const purchaseBillInvoiceUpload = require('../../../domains/procurement/purchase-bill-invoice-upload');
const supplierOrderProcessUpload = require('../../../domains/procurement/supplier-order-process-upload');

router.get('/registration/options', supplierRegistration.getOptions);
router.post('/registration', supplierRegistrationUpload, supplierRegistration.register);

router.use(supplierAuth, requireActiveSupplier);

router.get('/dashboard', supplierPortal.getDashboard);
router.get('/orders', supplierPortal.getOrders);
router.get('/orders/:id/process-template', supplierPortal.downloadOrderProcessTemplate);
router.post('/orders/:id/process-upload', supplierOrderProcessUpload.single('file'), supplierPortal.parseOrderProcessUpload);
router.get('/orders/:id/challan', supplierPortal.downloadOrderChallan);
router.post('/orders/:id/process', supplierPortal.processOrder);
router.get('/orders/:id', supplierPortal.getOrder);
router.get('/invoices', supplierPortal.getInvoices);
router.get('/invoices/:id', supplierPortal.getInvoice);
router.get('/invoices/:id/attachment', supplierPortal.downloadInvoiceAttachment);
router.post('/invoices/:id/upload', purchaseBillInvoiceUpload.single('invoice'), supplierPortal.uploadInvoice);
router.get('/payments', supplierPortal.getPayments);
router.get('/profile', supplierPortal.getProfile);

module.exports = router;

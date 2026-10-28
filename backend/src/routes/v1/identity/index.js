const router = require('express').Router();
const adminAuth = require('../../../domains/identity/admin-auth.controller');
const admins = require('../../../domains/identity/admins.controller');
const roles = require('../../../domains/identity/roles.controller');
const customerAuth = require('../../../domains/identity/customer-auth.controller');
const vendorAuth = require('../../../domains/identity/vendor-auth.controller');
const supplierAuth = require('../../../domains/identity/supplier-auth.controller');
const deliverymanAuth = require('../../../domains/identity/deliveryman-auth.controller');
const warehouseAuth = require('../../../domains/identity/warehouse-auth.controller');
const {
  adminAuth: adminMiddleware,
  customerAuth: customerMiddleware,
  vendorAuth: vendorMiddleware,
  supplierAuth: supplierMiddleware,
  deliverymanAuth: deliverymanMiddleware,
  warehouseAuth: warehouseMiddleware,
} = require('../../../middleware/auth');

// Admin auth
router.post('/admin/auth/login', adminAuth.login);
router.post('/admin/auth/register', adminAuth.register);
router.get('/admin/auth/me', adminMiddleware, adminAuth.me);
router.post('/admin/auth/logout', adminMiddleware, adminAuth.logout);

// Admins
router.get('/admin/admins', adminMiddleware, admins.getAll);
router.post('/admin/admins', adminMiddleware, admins.create);
router.get('/admin/admins/:id', adminMiddleware, admins.getOne);
router.put('/admin/admins/:id', adminMiddleware, admins.update);
router.patch('/admin/admins/:id/status', adminMiddleware, admins.updateStatus);
router.delete('/admin/admins/:id', adminMiddleware, admins.remove);

// Roles
router.get('/admin/roles', adminMiddleware, roles.getAll);
router.post('/admin/roles', adminMiddleware, roles.create);
router.get('/admin/roles/:id', adminMiddleware, roles.getOne);
router.put('/admin/roles/:id', adminMiddleware, roles.update);
router.delete('/admin/roles/:id', adminMiddleware, roles.remove);

// Customer auth
router.post('/customer/auth/login', customerAuth.login);
router.post('/customer/auth/register', customerAuth.register);
router.get('/customer/auth/me', customerMiddleware, customerAuth.me);

// Vendor auth
router.post('/vendor/auth/login', vendorAuth.login);
router.get('/vendor/auth/me', vendorMiddleware, vendorAuth.me);
router.post('/vendor/auth/logout', vendorMiddleware, vendorAuth.logout);

// Supplier auth
router.post('/supplier/auth/login', supplierAuth.login);
router.get('/supplier/auth/me', supplierMiddleware, supplierAuth.me);
router.post('/supplier/auth/logout', supplierMiddleware, supplierAuth.logout);

// Deliveryman auth
router.post('/deliveryman/auth/login', deliverymanAuth.login);
router.get('/deliveryman/auth/me', deliverymanMiddleware, deliverymanAuth.me);
router.post('/deliveryman/auth/logout', deliverymanMiddleware, deliverymanAuth.logout);

// Warehouse auth
router.post('/warehouse/auth/login', warehouseAuth.login);
router.get('/warehouse/auth/me', warehouseMiddleware, warehouseAuth.me);
router.post('/warehouse/auth/logout', warehouseMiddleware, warehouseAuth.logout);

module.exports = router;

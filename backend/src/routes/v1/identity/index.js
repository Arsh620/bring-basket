const router = require('express').Router();
const adminAuth = require('../../../domains/identity/admin-auth.controller');
const admins = require('../../../domains/identity/admins.controller');
const roles = require('../../../domains/identity/roles.controller');
const customerAuth = require('../../../domains/identity/customer-auth.controller');
const customerAddresses = require('../../../domains/identity/customer-addresses.controller');
const customerOtp = require('../../../domains/identity/customer-otp.controller');
const vendorAuth = require('../../../domains/identity/vendor-auth.controller');
const vendorAccess = require('../../../domains/identity/vendor-access.controller');
const supplierAuth = require('../../../domains/identity/supplier-auth.controller');
const supplierPasswordSetup = require('../../../domains/identity/supplier-password-setup.controller');
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
const { checkRole } = require('../../../middleware/auth');
const { checkAdminModule } = require('../../../middleware/auth');
const { checkVendorModule } = require('../../../middleware/auth');
const { authLimiter } = require('../../../middleware/rateLimiter');
const { getAdminGrantContext } = require('../../../domains/identity/admin-role-grants');
const { error } = require('../../../utils/response');

const adminOnly = [adminMiddleware, checkRole('admin')];
const activeAdminAccess = [...adminOnly, checkAdminModule()];
const procurementAdminAccess = [...adminOnly, checkAdminModule('purchase')];
const employeeAccess = [...adminOnly, checkAdminModule('employee')];
const roleReadAccess = [...adminOnly, checkAdminModule('custom_role')];
const roleWriteAccess = [...adminOnly, checkAdminModule('custom_role')];
const vendorRoleAccess = [vendorMiddleware, checkVendorModule('custom_role')];
const vendorEmployeeAccess = [vendorMiddleware, checkVendorModule('employee')];

// Admin auth
router.post('/admin/auth/login', authLimiter, adminAuth.login);
router.post('/admin/auth/register', ...employeeAccess, authLimiter, adminAuth.register);
router.get('/admin/auth/me', activeAdminAccess, adminAuth.me);
router.post('/admin/auth/logout', activeAdminAccess, adminAuth.logout);

// Admins
router.get('/admin/admins', employeeAccess, admins.getAll);
router.post('/admin/admins', employeeAccess, admins.create);
router.get('/admin/admins/:id', employeeAccess, admins.getOne);
router.put('/admin/admins/:id', employeeAccess, admins.update);
router.patch('/admin/admins/:id/status', employeeAccess, admins.updateStatus);
router.delete('/admin/admins/:id', employeeAccess, admins.remove);
router.get('/admin/employee-roles', employeeAccess, roles.getAssignable);

// Roles
router.get('/admin/roles/permissions', roleReadAccess, roles.getPermissionModules);
router.get('/admin/roles', roleReadAccess, roles.getAll);
router.post('/admin/roles', roleWriteAccess, roles.create);
router.get('/admin/roles/:id', roleWriteAccess, roles.getOne);
router.put('/admin/roles/:id', roleWriteAccess, roles.update);
router.delete('/admin/roles/:id', roleWriteAccess, roles.remove);

const requireMaster = async (req, res, next) => {
  try {
    const grants = await getAdminGrantContext(req.user?.id);
    if (!grants?.isMaster) return error(res, 'Master administrator access required', 403);
    return next();
  } catch (err) { return next(err); }
};

const masterAccess = require('express').Router();
masterAccess.use(...adminOnly, requireMaster);
masterAccess.get('/roles/permissions', roles.getPermissionModules);
masterAccess.get('/roles', roles.getAll);
masterAccess.post('/roles', roles.create);
masterAccess.put('/roles/:id', roles.update);
masterAccess.delete('/roles/:id', roles.remove);
masterAccess.get('/employee-roles', roles.getAssignable);
masterAccess.get('/employees', admins.getAll);
masterAccess.post('/employees', admins.create);
masterAccess.put('/employees/:id', admins.update);
masterAccess.patch('/employees/:id/status', admins.updateStatus);
masterAccess.delete('/employees/:id', admins.remove);
router.use('/admin/master', masterAccess);

// Customer auth
router.post('/customer/auth/login', authLimiter, customerAuth.login);
router.post('/customer/auth/register', authLimiter, customerAuth.register);
router.post('/customer/auth/forgot-password', authLimiter, customerOtp.forgotPassword);
router.post('/customer/auth/verify-otp', authLimiter, customerOtp.verifyOtp);
router.put('/customer/auth/reset-password', authLimiter, customerOtp.resetPassword);
router.get('/customer/auth/me', customerMiddleware, customerAuth.me);
router.get('/customer/addresses', customerMiddleware, customerAddresses.list);
router.post('/customer/addresses', customerMiddleware, customerAddresses.create);
router.put('/customer/addresses/:id', customerMiddleware, customerAddresses.update);
router.delete('/customer/addresses', customerMiddleware, customerAddresses.remove);

// Vendor auth
router.post('/vendor/auth/login', authLimiter, vendorAuth.login);
router.post('/vendor/auth/register', authLimiter, vendorAuth.register);
router.get('/vendor/auth/me', vendorMiddleware, vendorAuth.me);
router.post('/vendor/auth/logout', vendorMiddleware, vendorAuth.logout);

// Vendor employee roles and accounts are identity-owned; vendor business APIs stay with their domains.
router.get('/vendor/roles/permissions', ...vendorRoleAccess, vendorAccess.getPermissionModules);
router.get('/vendor/roles/assignable', ...vendorEmployeeAccess, vendorAccess.getAssignableRoles);
router.get('/vendor/roles', ...vendorRoleAccess, vendorAccess.getRoles);
router.post('/vendor/roles', ...vendorRoleAccess, vendorAccess.createRole);
router.get('/vendor/roles/:id', ...vendorRoleAccess, vendorAccess.getRole);
router.put('/vendor/roles/:id', ...vendorRoleAccess, vendorAccess.updateRole);
router.delete('/vendor/roles/:id', ...vendorRoleAccess, vendorAccess.deleteRole);
router.get('/vendor/employees', ...vendorEmployeeAccess, vendorAccess.getEmployees);
router.post('/vendor/employees', ...vendorEmployeeAccess, vendorAccess.createEmployee);
router.put('/vendor/employees/:id', ...vendorEmployeeAccess, vendorAccess.updateEmployee);
router.patch('/vendor/employees/:id/status', ...vendorEmployeeAccess, vendorAccess.updateEmployeeStatus);
router.delete('/vendor/employees/:id', ...vendorEmployeeAccess, vendorAccess.deleteEmployee);

// Supplier auth
router.post('/supplier/auth/login', authLimiter, supplierAuth.login);
router.post('/supplier/auth/set-password', authLimiter, supplierPasswordSetup.setPassword);
router.post('/supplier/auth/invitations/:supplierId', ...procurementAdminAccess, supplierPasswordSetup.createInvitation);
router.get('/supplier/auth/me', supplierMiddleware, supplierAuth.me);
router.post('/supplier/auth/logout', supplierMiddleware, supplierAuth.logout);

// Deliveryman auth
router.post('/deliveryman/auth/login', authLimiter, deliverymanAuth.login);
router.get('/deliveryman/auth/me', deliverymanMiddleware, deliverymanAuth.me);
router.post('/deliveryman/auth/logout', deliverymanMiddleware, deliverymanAuth.logout);

// Warehouse auth
router.post('/warehouse/auth/login', authLimiter, warehouseAuth.login);
router.get('/warehouse/auth/me', warehouseMiddleware, warehouseAuth.me);
router.post('/warehouse/auth/logout', warehouseMiddleware, warehouseAuth.logout);

module.exports = router;

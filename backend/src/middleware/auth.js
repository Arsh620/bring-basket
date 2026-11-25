const jwt = require('jsonwebtoken');
const { error } = require('../utils/response');

const isObjectId = (value) => (
  (value && typeof value === 'object' && value._bsontype === 'ObjectId')
  || (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value))
);

exports.resolveAdminRole = async (roleId) => {
  const AdminRole = require('../models/auth/AdminRole');
  if (roleId && typeof roleId === 'object' && !roleId._bsontype
    && (roleId.legacyId !== undefined || roleId.modules !== undefined || roleId.name !== undefined)) {
    return roleId;
  }

  if (isObjectId(roleId)) {
    const role = await AdminRole.findById(roleId);
    if (role) return role;
  }

  const legacyId = typeof roleId === 'number'
    ? roleId
    : typeof roleId === 'string' && /^\d+$/.test(roleId) ? Number(roleId) : null;
  if (!Number.isSafeInteger(legacyId) || legacyId < 1) return null;
  return AdminRole.findOne({ legacyId });
};

// ─── Token generation ────────────────────────────────────────────────────────

exports.generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ─── Core verify ─────────────────────────────────────────────────────────────

const verify = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return error(res, 'No token provided', 401);
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return error(res, 'Invalid or expired token', 401);
  }
};

// ─── Role-specific middleware ─────────────────────────────────────────────────
// Each one verifies the token AND asserts the correct role so a vendor/customer
// token cannot reach an admin route even without checkRole.

const requireRole = (role) => (req, res, next) => {
  verify(req, res, () => {
    if (req.user?.role !== role) return error(res, 'Access denied', 403);
    next();
  });
};

exports.adminAuth      = requireRole('admin');
exports.vendorAuth = (req, res, next) => {
  verify(req, res, () => {
    if (!['vendor', 'vendor_employee'].includes(req.user?.role)) {
      return error(res, 'Access denied', 403);
    }

    const loadVendorContext = async () => {
      const Vendor = require('../models/auth/Vendor');
      const Store = require('../models/store/Store');

      if (req.user.role === 'vendor') {
        const vendor = await Vendor.findById(req.user.id);
        if (!vendor || vendor.status === false) return error(res, 'Access denied', 403);
        const stores = await Store.find({ vendorId: vendor._id }).select('_id').lean();
        req.vendorContext = {
          vendorId: String(vendor._id),
          storeIds: stores.map(({ _id }) => _id),
          isEmployee: false,
          vendor,
        };
        return next();
      }

      require('../models/auth/EmployeeRole');
      const VendorEmployee = require('../models/auth/VendorEmployee');
      const employee = await VendorEmployee.findById(req.user.id).populate('employeeRoleId');
      const role = employee?.employeeRoleId;
      if (!employee || employee.status === false || employee.isLoggedIn === false || !role || role.status === false
        || !role.storeId || String(role.storeId) !== String(employee.storeId)) {
        return error(res, 'Access denied', 403);
      }

      const vendor = await Vendor.findById(employee.vendorId);
      const store = await Store.findOne({ _id: employee.storeId, vendorId: employee.vendorId }).select('_id');
      if (!vendor || vendor.status === false || !store) return error(res, 'Access denied', 403);

      req.vendorContext = {
        vendorId: String(vendor._id),
        storeIds: [store._id],
        isEmployee: true,
        employee,
        role,
        vendor,
      };
      return next();
    };

    loadVendorContext().catch(next);
  });
};
exports.warehouseAuth = (req, res, next) => {
  verify(req, res, () => {
    if (req.user?.role !== 'warehouse' || !req.user.id) return error(res, 'Access denied', 403);
    const loadWarehouse = async () => {
      const Warehouse = require('../models/warehouse/Warehouse');
      const warehouse = await Warehouse.findById(req.user.id).select('+passwordHash');
      if (!warehouse || warehouse.status !== 'active' || !warehouse.username || !warehouse.passwordHash) {
        return error(res, 'Access denied', 403);
      }
      req.warehouse = warehouse;
      return next();
    };
    loadWarehouse().catch(next);
  });
};
exports.supplierAuth   = requireRole('supplier');
exports.customerAuth   = requireRole('customer');
exports.deliverymanAuth = requireRole('deliveryman');

// ─── checkRole (for fine-grained multi-role checks if needed) ────────────────

exports.checkRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return error(res, 'Access denied', 403);
  }
  next();
};

exports.checkAdminModule = (...modules) => async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin' || !req.user.id) {
      return error(res, 'Access denied', 403);
    }

    require('../models/auth/AdminRole');
    const Admin = require('../models/auth/Admin');
    const admin = await Admin.findById(req.user.id).select('roleId zoneId status');
    if (!admin || admin.status === false || !admin.roleId) {
      return error(res, 'Access denied', 403);
    }

    const role = await exports.resolveAdminRole(admin.roleId);
    if (!role) return error(res, 'Access denied', 403);
    if (role.status === false) return error(res, 'Access denied', 403);
    req.adminScope = { zoneId: Number(role.legacyId) === 1 ? null : admin.zoneId || null };
    if (Number(role.legacyId) === 1) return next();
    if (admin.zoneId && modules.includes('zone')) return error(res, 'Access denied', 403);
    if (modules.length === 0) return next();

    let grantedModules = role.modules;
    if (typeof grantedModules === 'string') {
      try {
        grantedModules = JSON.parse(grantedModules);
      } catch {
        grantedModules = [];
      }
    }
    if (!Array.isArray(grantedModules) || !modules.some((module) => grantedModules.includes(module))) {
      return error(res, 'Access denied', 403);
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

exports.checkVendorModule = (...modules) => (req, res, next) => {
  const context = req.vendorContext;
  if (!context) return error(res, 'Access denied', 403);
  if (!context.isEmployee || modules.length === 0) return next();
  if (modules.some((module) => require('../domains/identity/employee-role-permissions')
    .normalizeModules(context.role?.modules).includes(module))) {
    return next();
  }
  return error(res, 'Access denied', 403);
};

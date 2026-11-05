const jwt = require('jsonwebtoken');
const { error } = require('../utils/response');

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
exports.vendorAuth     = requireRole('vendor');
exports.warehouseAuth  = requireRole('warehouse');
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

const jwt = require('jsonwebtoken');
const { error } = require('../utils/response');

const verifyToken = (model) => async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return error(res, 'No token provided', 401);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return error(res, 'Invalid token', 401);
  }
};

exports.adminAuth = verifyToken('admin');
exports.vendorAuth = verifyToken('vendor');
exports.warehouseAuth = verifyToken('warehouse');
exports.supplierAuth = verifyToken('supplier');
exports.customerAuth = verifyToken('customer');
exports.deliverymanAuth = verifyToken('deliveryman');

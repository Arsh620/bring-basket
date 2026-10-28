const jwt = require('jsonwebtoken');
const { error } = require('../utils/response');

const verifyToken = async (req, res, next) => {
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

exports.adminAuth = verifyToken;
exports.vendorAuth = verifyToken;
exports.warehouseAuth = verifyToken;
exports.supplierAuth = verifyToken;
exports.customerAuth = verifyToken;
exports.deliverymanAuth = verifyToken;

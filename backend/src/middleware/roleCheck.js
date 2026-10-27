const { error } = require('../utils/response');

exports.checkRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return error(res, 'Access denied', 403);
  }
  next();
};

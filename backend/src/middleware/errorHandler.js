const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  const status = err.statusCode
    || err.status
    || (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE' ? 413 : undefined)
    || (err.name === 'MulterError' ? 400 : undefined)
    || (err.name === 'ValidationError' || err.name === 'CastError'
      ? 400
      : err.code === 11000
        ? 409
        : 500);

  if (status >= 500) {
    logger.error({ message: err.message, stack: err.stack, url: req.originalUrl, method: req.method });
  }

  res.status(status).json({
    success: false,
    message: err.message || 'Server Error',
  });
};

module.exports = errorHandler;

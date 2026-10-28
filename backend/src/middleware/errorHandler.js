const errorHandler = (err, req, res, next) => {
  const status = err.statusCode
    || err.status
    || (err.name === 'ValidationError' || err.name === 'CastError'
      ? 400
      : err.code === 11000
        ? 409
        : 500);
  res.status(status).json({
    success: false,
    message: err.message || 'Server Error',
  });
};

module.exports = errorHandler;

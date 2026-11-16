const reservations = require('./order-stock-reservations.service');
const { success } = require('../../utils/response');

exports.reserve = async (req, res, next) => {
  try {
    const reservation = await reservations.reserve(req.params.orderId, req.body.storeId, req.body.items);
    return success(res, reservation, 'Stock reserved', 201);
  } catch (error) {
    return next(error);
  }
};

exports.commit = async (req, res, next) => {
  try {
    return success(res, await reservations.commit(req.params.orderId));
  } catch (error) {
    return next(error);
  }
};

exports.release = async (req, res, next) => {
  try {
    return success(res, await reservations.release(req.params.orderId));
  } catch (error) {
    return next(error);
  }
};

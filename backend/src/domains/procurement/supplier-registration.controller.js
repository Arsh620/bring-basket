const { success } = require('../../utils/response');
const options = require('./supplier-registration-options');
const registration = require('./supplier-registration.service');

exports.getOptions = (req, res) => {
  success(res, options);
};

exports.register = async (req, res, next) => {
  try {
    const supplier = await registration.register(req.body, req.files || {});
    success(
      res,
      supplier,
      'Registration received. Your account is pending admin approval. Contact the procurement team to receive your password setup link.',
      201,
    );
  } catch (error) {
    next(error);
  }
};

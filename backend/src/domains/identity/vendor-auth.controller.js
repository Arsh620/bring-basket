const jwt = require('jsonwebtoken');
const Vendor = require('../../models/auth/Vendor');
const { success, error } = require('../../utils/response');

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return error(res, 'Email and password required', 400);

    const vendor = await Vendor.findOne({ email }).select('+password');
    if (!vendor) return error(res, 'Invalid credentials', 401);
    if (!vendor.status) return error(res, 'Account disabled', 403);

    const isMatch = await vendor.matchPassword(password);
    if (!isMatch) return error(res, 'Invalid credentials', 401);

    const token = generateToken(vendor._id, 'vendor');
    const data = vendor.toObject();
    delete data.password;

    return success(res, { token, vendor: data }, 'Login successful');
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) return error(res, 'Not found', 404);
    return success(res, vendor);
  } catch (err) { next(err); }
};

exports.logout = async (req, res, next) => {
  try {
    return success(res, null, 'Logged out');
  } catch (err) { next(err); }
};

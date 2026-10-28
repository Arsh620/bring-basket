const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { registeredModels } = require('../../models/GeneratedBusinessModels');
const { success, error } = require('../../utils/response');

const PurchaseVendor = registeredModels['purchase_vendors'];

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return error(res, 'Email and password required', 400);

    const supplier = await PurchaseVendor.findOne({ email, status: true }).select('+password');
    if (!supplier) return error(res, 'Invalid credentials', 401);
    if (!supplier.password) return error(res, 'Password not set. Please use set-password link.', 403);

    const isMatch = await bcrypt.compare(password, supplier.password);
    if (!isMatch) return error(res, 'Invalid credentials', 401);

    const token = generateToken(supplier._id, 'supplier');
    const data = supplier.toObject();
    delete data.password;

    return success(res, { token, supplier: data }, 'Login successful');
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const supplier = await PurchaseVendor.findById(req.user.id);
    if (!supplier) return error(res, 'Not found', 404);
    return success(res, supplier);
  } catch (err) { next(err); }
};

exports.logout = async (req, res, next) => {
  try {
    return success(res, null, 'Logged out');
  } catch (err) { next(err); }
};

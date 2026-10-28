const jwt = require('jsonwebtoken');
const DeliveryMan = require('../../models/auth/DeliveryMan');
const { success, error } = require('../../utils/response');

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

exports.login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return error(res, 'Phone and password required', 400);

    const dm = await DeliveryMan.findOne({ phone, status: true }).select('+password');
    if (!dm) return error(res, 'Invalid credentials', 401);
    if (dm.applicationStatus !== 'approved') return error(res, 'Account not approved', 403);

    const isMatch = await dm.matchPassword(password);
    if (!isMatch) return error(res, 'Invalid credentials', 401);

    const token = generateToken(dm._id, 'deliveryman');
    const data = dm.toObject();
    delete data.password;

    return success(res, { token, deliveryMan: data }, 'Login successful');
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const dm = await DeliveryMan.findById(req.user.id);
    if (!dm) return error(res, 'Not found', 404);
    return success(res, dm);
  } catch (err) { next(err); }
};

exports.logout = async (req, res, next) => {
  try {
    return success(res, null, 'Logged out');
  } catch (err) { next(err); }
};

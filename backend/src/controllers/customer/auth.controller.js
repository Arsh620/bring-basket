const jwt = require('jsonwebtoken');
const User = require('../../models/auth/User');
const { success, error } = require('../../utils/response');

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return error(res, 'Email and password required', 400);

    const user = await User.findOne({ email }).select('+password');
    if (!user) return error(res, 'Invalid credentials', 401);
    if (!user.status) return error(res, 'Account disabled', 403);

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return error(res, 'Invalid credentials', 401);

    const token = generateToken(user._id, 'customer');
    const data = user.toObject();
    delete data.password;

    return success(res, { token, user: data }, 'Login successful');
  } catch (err) { next(err); }
};

exports.register = async (req, res, next) => {
  try {
    const { fName, lName, phone, email, password } = req.body;
    if (!phone && !email) return error(res, 'Phone or email required', 400);
    if (!password) return error(res, 'Password required', 400);

    const exists = await User.findOne({ $or: [{ phone }, { email }] });
    if (exists) return error(res, 'User already exists', 409);

    const user = await User.create({ fName, lName, phone, email, password });
    const token = generateToken(user._id, 'customer');

    return success(res, { token, user }, 'Registered successfully', 201);
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return error(res, 'Not found', 404);
    return success(res, user);
  } catch (err) { next(err); }
};

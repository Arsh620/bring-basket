const jwt = require('jsonwebtoken');
const Admin = require('../../models/auth/Admin');
const { success, error } = require('../../utils/response');

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return error(res, 'Email and password required', 400);

    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin) return error(res, 'Invalid credentials', 401);
    if (!admin.status) return error(res, 'Account disabled', 403);

    const isMatch = await admin.matchPassword(password);
    if (!isMatch) return error(res, 'Invalid credentials', 401);

    const token = generateToken(admin._id, 'admin');
    const data = admin.toObject();
    delete data.password;

    return success(res, { token, admin: data }, 'Login successful');
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.user.id).populate('roleId');
    if (!admin) return error(res, 'Not found', 404);
    return success(res, admin);
  } catch (err) { next(err); }
};

exports.logout = async (req, res, next) => {
  try {
    await Admin.findByIdAndUpdate(req.user.id, { isLoggedIn: false });
    return success(res, null, 'Logged out');
  } catch (err) { next(err); }
};

exports.register = async (req, res, next) => {
  try {
    const { fName, lName, phone, email, password, roleId } = req.body;
    if (!email?.trim()) return error(res, 'Email is required', 400);
    if (!password) return error(res, 'Password is required', 400);
    if (!roleId) return error(res, 'roleId is required', 400);

    const exists = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (exists) return error(res, 'Email already in use', 409);

    const admin = await Admin.create({ fName, lName, phone, email, password, roleId });
    const token = generateToken(admin._id, 'admin');
    const data = admin.toObject();
    delete data.password;

    return success(res, { token, admin: data }, 'Admin registered', 201);
  } catch (err) { next(err); }
};

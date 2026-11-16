const Vendor = require('../../models/auth/Vendor');
const { generateToken } = require('../../middleware/auth');
const { success, error } = require('../../utils/response');

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

exports.register = async (req, res, next) => {
  try {
    const { fName, lName, phone, email, password } = req.body;
    if (!fName || !phone || !email || !password) return error(res, 'fName, phone, email, password required', 400);
    if (password.length < 6) return error(res, 'Password must be at least 6 characters', 400);

    const exists = await Vendor.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
    if (exists) return error(res, 'Email or phone already registered', 409);

    const vendor = await Vendor.create({ fName, lName, phone, email, password, status: false }); // pending approval
    const token = generateToken(vendor._id, 'vendor');
    const data = vendor.toObject();
    delete data.password;
    return success(res, { token, vendor: data }, 'Registration successful. Awaiting admin approval.', 201);
  } catch (err) { next(err); }
};

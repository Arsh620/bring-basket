const Admin = require('../../models/auth/Admin');
const AdminRole = require('../../models/auth/AdminRole');
const { generateToken, resolveAdminRole } = require('../../middleware/auth');
const { success, error } = require('../../utils/response');

exports.login = async (req, res, next) => {
  try {
    const { email, password, accountType = 'admin' } = req.body;
    if (!email || !password) return error(res, 'Email and password required', 400);
    if (!['admin', 'employee'].includes(accountType)) {
      return error(res, 'Invalid account type', 400);
    }

    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin) return error(res, 'Invalid credentials', 401);
    if (!admin.status) return error(res, 'Account disabled', 403);
    const role = await resolveAdminRole(admin.roleId);
    if (!role || role.status === false) return error(res, 'Role disabled', 403);
    const isPrimaryAdmin = Number(role.legacyId) === 1;
    if ((accountType === 'admin') !== isPrimaryAdmin) {
      return error(res, 'Invalid credentials', 401);
    }

    const isMatch = await admin.matchPassword(password);
    if (!isMatch) return error(res, 'Invalid credentials', 401);

    await Admin.findByIdAndUpdate(admin._id, { isLoggedIn: true });
    const token = generateToken(admin._id, 'admin');
    const data = admin.toObject();
    delete data.password;
    data.roleId = role;

    return success(res, { token, admin: data }, 'Login successful');
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) return error(res, 'Not found', 404);
    const role = await resolveAdminRole(admin.roleId);
    if (!role || role.status === false) return error(res, 'Access denied', 403);
    const data = admin.toObject();
    data.roleId = role;
    return success(res, data);
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
    const role = await AdminRole.findById(roleId).select('legacyId status');
    if (!role || !role.status || Number(role.legacyId) === 1) {
      return error(res, 'Select an active employee role', 400);
    }

    const exists = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (exists) return error(res, 'Email already in use', 409);

    const admin = await Admin.create({ fName, lName, phone, email, password, roleId });
    const token = generateToken(admin._id, 'admin');
    const data = admin.toObject();
    delete data.password;

    return success(res, { token, admin: data }, 'Admin registered', 201);
  } catch (err) { next(err); }
};

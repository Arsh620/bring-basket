const Vendor = require('../../models/auth/Vendor');
const VendorEmployee = require('../../models/auth/VendorEmployee');
require('../../models/auth/EmployeeRole');
const Store = require('../../models/store/Store');
const { generateToken } = require('../../middleware/auth');
const { success, error } = require('../../utils/response');
const { normalizeModules } = require('./employee-role-permissions');

exports.login = async (req, res, next) => {
  try {
    const { email, password, accountType = 'owner' } = req.body;
    if (!email || !password) return error(res, 'Email and password required', 400);
    if (!['owner', 'employee'].includes(accountType)) return error(res, 'Invalid account type', 400);

    if (accountType === 'employee') {
      const employee = await VendorEmployee.findOne({ email: email.toLowerCase().trim() })
        .select('+password')
        .populate('employeeRoleId');
      if (!employee) return error(res, 'Invalid credentials', 401);
      if (employee.status === false) return error(res, 'Account disabled', 403);

      const role = employee.employeeRoleId;
      if (!role || role.status === false || !role.storeId
        || String(role.storeId) !== String(employee.storeId)) {
        return error(res, 'Employee role is unavailable', 403);
      }
      const [vendor, store] = await Promise.all([
        Vendor.findById(employee.vendorId),
        Store.findOne({ _id: employee.storeId, vendorId: employee.vendorId }),
      ]);
      if (!vendor || vendor.status === false || !store) return error(res, 'Store access is unavailable', 403);
      if (!await employee.matchPassword(password)) return error(res, 'Invalid credentials', 401);

      employee.isLoggedIn = true;
      await employee.save();
      const token = generateToken(employee._id, 'vendor_employee');
      const data = employee.toObject();
      delete data.password;
      data.isEmployee = true;
      data.modules = normalizeModules(role.modules);
      return success(res, { token, vendor: data }, 'Login successful');
    }

    const vendor = await Vendor.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!vendor) return error(res, 'Invalid credentials', 401);
    if (vendor.status === false) return error(res, 'Account disabled', 403);
    if (!await vendor.matchPassword(password)) return error(res, 'Invalid credentials', 401);

    const token = generateToken(vendor._id, 'vendor');
    const data = vendor.toObject();
    delete data.password;
    data.isEmployee = false;
    return success(res, { token, vendor: data }, 'Login successful');
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    if (req.vendorContext.isEmployee) {
      const employee = req.vendorContext.employee.toObject();
      delete employee.password;
      employee.isEmployee = true;
      employee.modules = normalizeModules(req.vendorContext.role.modules);
      return success(res, employee);
    }
    const vendor = req.vendorContext.vendor.toObject();
    delete vendor.password;
    vendor.isEmployee = false;
    const stores = await Store.find({ _id: { $in: req.vendorContext.storeIds }, status: true })
      .select('_id name logo orderCount rating')
      .lean();
    return success(res, { ...vendor, stores });
  } catch (err) { next(err); }
};

exports.logout = async (req, res, next) => {
  try {
    if (req.user.role === 'vendor_employee') {
      await VendorEmployee.findByIdAndUpdate(req.user.id, { isLoggedIn: false });
    }
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
    const data = vendor.toObject();
    delete data.password;
    return success(res, { vendor: data }, 'Registration successful. Awaiting admin approval.', 201);
  } catch (err) { next(err); }
};

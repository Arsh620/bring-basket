const mongoose = require('mongoose');
const EmployeeRole = require('../../models/auth/EmployeeRole');
const VendorEmployee = require('../../models/auth/VendorEmployee');
const Store = require('../../models/store/Store');
require('../../models/store/Module');
const { success, error } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const { permissionModules, permissionModuleKeys, normalizeModules } = require('./employee-role-permissions');

const canGrant = (req, modules) => {
  if (!req.vendorContext.isEmployee) return true;
  const permitted = new Set(normalizeModules(req.vendorContext.role?.modules));
  return normalizeModules(modules).every((module) => permitted.has(module));
};

const canManageEmployee = async (req, employee) => {
  if (!req.vendorContext.isEmployee) return true;
  const role = await EmployeeRole.findOne({ _id: employee.employeeRoleId, storeId: employee.storeId });
  return Boolean(role) && canGrant(req, role.modules);
};

const resolveStoreId = (req, requestedId) => {
  const allowedStoreIds = req.vendorContext.storeIds.map(String);
  const storeId = requestedId || (allowedStoreIds.length === 1 ? allowedStoreIds[0] : null);
  return storeId && allowedStoreIds.includes(String(storeId)) ? String(storeId) : null;
};

const storeSupportsAddons = async (storeId) => {
  const store = await Store.findById(storeId).populate('moduleId', 'moduleType');
  return store?.moduleId?.moduleType === 'food';
};

const validateRole = async ({ name, modules, storeId }, currentRoleId) => {
  if (typeof name !== 'string' || !name.trim()) return 'Role name is required';
  if (name.trim().length > 191) return 'Role name must be 191 characters or fewer';
  if (!Array.isArray(modules) || modules.length === 0) return 'Select at least one permission module';
  if (modules.some((module) => typeof module !== 'string' || !permissionModuleKeys.has(module))) {
    return 'One or more permission modules are invalid';
  }
  if (modules.includes('addon') && !await storeSupportsAddons(storeId)) {
    return 'Add-on access is not available for this store type';
  }
  const escapedName = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const duplicate = await EmployeeRole.exists({
    storeId,
    name: new RegExp(`^${escapedName}$`, 'i'),
    ...(currentRoleId ? { _id: { $ne: currentRoleId } } : {}),
  });
  return duplicate ? 'Role name already exists for this store' : null;
};

exports.getPermissionModules = async (req, res, next) => {
  try {
    const storeId = resolveStoreId(req, req.query.storeId);
    if (!storeId) return error(res, 'Select one of your stores', 400);
    const permissions = await storeSupportsAddons(storeId)
      ? permissionModules
      : permissionModules.filter(({ key }) => key !== 'addon');
    return success(res, permissions.filter(({ key }) => canGrant(req, [key])));
  } catch (err) { next(err); }
};

exports.getRoles = async (req, res, next) => {
  try {
    const storeId = req.query.storeId ? resolveStoreId(req, req.query.storeId) : null;
    if (req.query.storeId && !storeId) return error(res, 'Store not found', 403);
    const roles = await EmployeeRole.find({
      storeId: storeId || { $in: req.vendorContext.storeIds },
    }).sort({ name: 1 }).lean();
    return success(res, roles.map((role) => ({ ...role, modules: normalizeModules(role.modules) })));
  } catch (err) { next(err); }
};

exports.getAssignableRoles = async (req, res, next) => {
  try {
    const storeId = resolveStoreId(req, req.query.storeId);
    if (!storeId) return error(res, 'Select one of your stores', 400);
    const roles = await EmployeeRole.find({ storeId, status: true }).sort({ name: 1 }).lean();
    return success(res, roles.filter((role) => canGrant(req, role.modules))
      .map((role) => ({ ...role, modules: normalizeModules(role.modules) })));
  } catch (err) { next(err); }
};

exports.createRole = async (req, res, next) => {
  try {
    const storeId = resolveStoreId(req, req.body.storeId);
    if (!storeId) return error(res, 'Select one of your stores', 400);
    const validationError = await validateRole({ ...req.body, storeId });
    if (validationError) return error(res, validationError, 400);
    if (!canGrant(req, req.body.modules)) return error(res, 'You cannot grant modules outside your role', 403);
    if (req.body.status !== undefined && typeof req.body.status !== 'boolean') {
      return error(res, 'status must be a boolean', 400);
    }
    const role = await EmployeeRole.create({
      name: req.body.name.trim(),
      modules: JSON.stringify(normalizeModules(req.body.modules)),
      storeId,
      status: req.body.status,
    });
    return success(res, { ...role.toObject(), modules: normalizeModules(role.modules) }, 'Role created', 201);
  } catch (err) { next(err); }
};

exports.getRole = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid role ID', 400);
    const role = await EmployeeRole.findOne({
      _id: req.params.id,
      storeId: { $in: req.vendorContext.storeIds },
    }).lean();
    if (!role) return error(res, 'Not found', 404);
    return success(res, { ...role, modules: normalizeModules(role.modules) });
  } catch (err) { next(err); }
};

exports.updateRole = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid role ID', 400);
    const role = await EmployeeRole.findOne({
      _id: req.params.id,
      storeId: { $in: req.vendorContext.storeIds },
    });
    if (!role) return error(res, 'Not found', 404);
    if (!canGrant(req, role.modules)) return error(res, 'You cannot manage a role with higher permissions', 403);
    if (req.body.status !== undefined && typeof req.body.status !== 'boolean') {
      return error(res, 'status must be a boolean', 400);
    }

    const name = req.body.name === undefined ? role.name : req.body.name;
    const modules = req.body.modules === undefined ? normalizeModules(role.modules) : req.body.modules;
    if (req.body.name !== undefined || req.body.modules !== undefined) {
      const validationError = await validateRole({ name, modules, storeId: role.storeId }, role._id);
      if (validationError) return error(res, validationError, 400);
    }
    if (!canGrant(req, modules)) return error(res, 'You cannot grant modules outside your role', 403);
    if (req.body.name !== undefined) role.name = req.body.name.trim();
    if (req.body.modules !== undefined) role.modules = JSON.stringify(normalizeModules(req.body.modules));
    if (req.body.status !== undefined) role.status = req.body.status;
    await role.save();
    return success(res, { ...role.toObject(), modules: normalizeModules(role.modules) });
  } catch (err) { next(err); }
};

exports.deleteRole = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid role ID', 400);
    const role = await EmployeeRole.findOne({
      _id: req.params.id,
      storeId: { $in: req.vendorContext.storeIds },
    });
    if (!role) return error(res, 'Not found', 404);
    if (!canGrant(req, role.modules)) return error(res, 'You cannot manage a role with higher permissions', 403);
    if (await VendorEmployee.exists({ employeeRoleId: role._id })) {
      return error(res, 'This role is assigned to employees and cannot be deleted', 409);
    }
    await role.deleteOne();
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

exports.getEmployees = async (req, res, next) => {
  try {
    const storeId = req.query.storeId ? resolveStoreId(req, req.query.storeId) : null;
    if (req.query.storeId && !storeId) return error(res, 'Store not found', 403);
    const employees = await VendorEmployee.find({
      vendorId: req.vendorContext.vendorId,
      storeId: storeId || { $in: req.vendorContext.storeIds },
    }).select('-password').populate('employeeRoleId', 'name modules status').sort({ createdAt: -1 }).lean();
    return success(res, employees.map((employee) => ({
      ...employee,
      employeeRoleId: employee.employeeRoleId
        ? { ...employee.employeeRoleId, modules: normalizeModules(employee.employeeRoleId.modules) }
        : null,
    })));
  } catch (err) { next(err); }
};

exports.createEmployee = async (req, res, next) => {
  try {
    const { fName, lName, phone, email, password, employeeRoleId } = req.body;
    if (!fName?.trim() || !email?.trim() || !password || !employeeRoleId) {
      return error(res, 'Name, email, password and employee role are required', 400);
    }
    if (password.length < 6) return error(res, 'Password must be at least 6 characters', 400);
    const storeId = resolveStoreId(req, req.body.storeId);
    if (!storeId) return error(res, 'Select one of your stores', 400);
    if (!mongoose.isValidObjectId(employeeRoleId)) return error(res, 'Select an active employee role', 400);

    const role = await EmployeeRole.findOne({ _id: employeeRoleId, storeId, status: true });
    if (!role) return error(res, 'Select an active employee role for this store', 400);
    if (!canGrant(req, role.modules)) return error(res, 'You cannot assign a role with higher permissions', 403);
    if (await VendorEmployee.exists({ email: email.toLowerCase().trim() })) {
      return error(res, 'Email already in use', 409);
    }

    const employee = await VendorEmployee.create({
      fName: fName.trim(),
      lName: lName?.trim(),
      phone: phone?.trim(),
      email: email.toLowerCase().trim(),
      password,
      employeeRoleId: role._id,
      vendorId: req.vendorContext.vendorId,
      storeId,
      status: true,
    });
    const data = employee.toObject();
    delete data.password;
    return success(res, data, 'Employee created', 201);
  } catch (err) { next(err); }
};

exports.updateEmployee = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid employee ID', 400);
    const employee = await VendorEmployee.findOne({
      _id: req.params.id,
      vendorId: req.vendorContext.vendorId,
      storeId: { $in: req.vendorContext.storeIds },
    });
    if (!employee) return error(res, 'Not found', 404);
    if (req.vendorContext.isEmployee && String(employee._id) === String(req.user.id)) {
      return error(res, 'You cannot change your own employee access', 403);
    }
    if (!await canManageEmployee(req, employee)) return error(res, 'You cannot manage an employee with higher permissions', 403);

    const { fName, lName, phone, email, password, employeeRoleId, status } = req.body;
    if (status !== undefined && typeof status !== 'boolean') return error(res, 'status must be a boolean', 400);
    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();
      if (!normalizedEmail) return error(res, 'Email is required', 400);
      if (await VendorEmployee.exists({ email: normalizedEmail, _id: { $ne: employee._id } })) {
        return error(res, 'Email already in use', 409);
      }
      employee.email = normalizedEmail;
    }
    if (employeeRoleId !== undefined) {
      if (!mongoose.isValidObjectId(employeeRoleId)) {
        return error(res, 'Select an active employee role for this store', 400);
      }
      const role = await EmployeeRole.findOne({ _id: employeeRoleId, storeId: employee.storeId, status: true });
      if (!role) return error(res, 'Select an active employee role for this store', 400);
      if (!canGrant(req, role.modules)) return error(res, 'You cannot assign a role with higher permissions', 403);
      employee.employeeRoleId = employeeRoleId;
    }
    if (fName !== undefined) employee.fName = fName.trim();
    if (lName !== undefined) employee.lName = lName.trim();
    if (phone !== undefined) employee.phone = phone.trim();
    if (password !== undefined) {
      if (password.length < 6) return error(res, 'Password must be at least 6 characters', 400);
      employee.password = password;
    }
    if (status !== undefined) employee.status = status;
    await employee.save();
    const data = employee.toObject();
    delete data.password;
    return success(res, data);
  } catch (err) { next(err); }
};

exports.deleteEmployee = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid employee ID', 400);
    if (String(req.params.id) === String(req.user.id)) return error(res, 'You cannot disable your own account', 403);
    await setEmployeeStatus(req, false);
    return success(res, null, 'Employee disabled');
  } catch (err) {
    if (err instanceof AppError) return error(res, err.message, err.statusCode);
    next(err);
  }
};

const setEmployeeStatus = async (req, status) => {
  const filter = {
    _id: req.params.id,
    vendorId: req.vendorContext.vendorId,
    storeId: { $in: req.vendorContext.storeIds },
  };
  if (req.vendorContext.isEmployee) {
    const target = await VendorEmployee.findOne(filter);
    if (!target) throw new AppError('Not found', 404);
    if (!await canManageEmployee(req, target)) throw new AppError('You cannot manage an employee with higher permissions', 403);
    filter.employeeRoleId = target.employeeRoleId;
  }
  const employee = await VendorEmployee.findOneAndUpdate(
    filter, { status, ...(!status ? { isLoggedIn: false } : {}) }, { new: true },
  ).select('-password');
  if (!employee) throw new AppError('Not found', 404);
  return employee;
};

exports.updateEmployeeStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid employee ID', 400);
    if (typeof req.body.status !== 'boolean') return error(res, 'status must be a boolean', 400);
    if (String(req.params.id) === String(req.user.id)) return error(res, 'You cannot change your own account status', 403);
    const employee = await setEmployeeStatus(req, req.body.status);
    return success(res, employee);
  } catch (err) {
    if (err instanceof AppError) return error(res, err.message, err.statusCode);
    next(err);
  }
};

const mongoose = require('mongoose');
const AdminRole = require('../../models/auth/AdminRole');
const Admin = require('../../models/auth/Admin');
const { success, error } = require('../../utils/response');
const {
  getAdminGrantContext,
  canGrantModules,
  canManageRole,
  isActiveRole,
} = require('./admin-role-grants');
const {
  permissionModules,
  permissionModuleKeys,
  normalizeModules,
} = require('./admin-role-permissions');

const isProtectedRole = (role) => Number(role.legacyId) === 1;

const serializeRole = (role) => {
  const data = typeof role.toObject === 'function' ? role.toObject() : { ...role };
  data.modules = normalizeModules(data.modules);
  return data;
};

const validateRole = async ({ name, modules }, currentRoleId) => {
  if (typeof name !== 'string' || !name.trim()) return 'Role name is required';
  if (name.trim().length > 191) return 'Role name must be 191 characters or fewer';

  const duplicate = await AdminRole.exists({
    name: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    ...(currentRoleId ? { _id: { $ne: currentRoleId } } : {}),
  });
  if (duplicate) return 'Role name already exists';

  if (!Array.isArray(modules) || modules.length === 0) {
    return 'Select at least one permission module';
  }
  if (modules.some((module) => typeof module !== 'string' || !permissionModuleKeys.has(module))) {
    return 'One or more permission modules are invalid';
  }
  return null;
};

const listRoles = async (req, res, next, assignableOnly) => {
  try {
    const grantContext = await getAdminGrantContext(req.user?.id);
    if (!grantContext) return error(res, 'Access denied', 403);
    const roles = await AdminRole.find({ legacyId: { $ne: 1 } }).sort({ name: 1 });
    const manageableRoles = roles.filter((role) => (
      (!assignableOnly || isActiveRole(role)) && canManageRole(role, grantContext)
    ));
    return success(res, manageableRoles.map(serializeRole));
  } catch (err) { next(err); }
};

exports.getAll = (req, res, next) => listRoles(req, res, next, req.query.assignable === 'true');
exports.getAssignable = (req, res, next) => listRoles(req, res, next, true);

exports.getPermissionModules = async (req, res, next) => {
  try {
    const grantContext = await getAdminGrantContext(req.user?.id);
    if (!grantContext) return error(res, 'Access denied', 403);
    const modules = grantContext.isMaster
      ? permissionModules
      : permissionModules.filter(({ key }) => grantContext.modules.includes(key));
    return success(res, modules);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid role ID', 400);
    const grantContext = await getAdminGrantContext(req.user?.id);
    if (!grantContext) return error(res, 'Access denied', 403);
    const role = await AdminRole.findById(req.params.id);
    if (!role || isProtectedRole(role)) return error(res, 'Not found', 404);
    if (!canManageRole(role, grantContext)) return error(res, 'Access denied', 403);
    return success(res, serializeRole(role));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, modules, status } = req.body;
    const grantContext = await getAdminGrantContext(req.user?.id);
    if (!grantContext) return error(res, 'Access denied', 403);
    const validationError = await validateRole({ name, modules });
    if (validationError) return error(res, validationError, 400);
    if (status !== undefined && typeof status !== 'boolean') {
      return error(res, 'status must be a boolean', 400);
    }
    if (!canGrantModules(modules, grantContext)) {
      return error(res, 'You cannot grant modules that your role does not have', 403);
    }
    const role = await AdminRole.create({
      name: name.trim(), modules: JSON.stringify(modules), ...(status === undefined ? {} : { status }),
    });
    return success(res, serializeRole(role), 'Role created', 201);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid role ID', 400);
    const { name, modules, status } = req.body;
    const role = await AdminRole.findById(req.params.id);
    if (!role || isProtectedRole(role)) return error(res, 'Not found', 404);
    const grantContext = await getAdminGrantContext(req.user?.id);
    if (!grantContext) return error(res, 'Access denied', 403);
    if (!canManageRole(role, grantContext)) return error(res, 'Access denied', 403);
    if (status !== undefined && typeof status !== 'boolean') {
      return error(res, 'status must be a boolean', 400);
    }
    if (name !== undefined || modules !== undefined) {
      const validationError = await validateRole({
        name: name === undefined ? role.name : name,
        modules: modules === undefined ? normalizeModules(role.modules) : modules,
      }, role._id);
      if (validationError) return error(res, validationError, 400);
    }
    if (modules !== undefined && !canGrantModules(modules, grantContext)) {
      return error(res, 'You cannot grant modules that your role does not have', 403);
    }
    if (name !== undefined) role.name = name.trim();
    if (modules !== undefined) role.modules = JSON.stringify(modules);
    if (status !== undefined) role.status = status;
    await role.save();
    return success(res, serializeRole(role));
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid role ID', 400);
    const role = await AdminRole.findById(req.params.id);
    if (!role || isProtectedRole(role)) return error(res, 'Not found', 404);
    const grantContext = await getAdminGrantContext(req.user?.id);
    if (!grantContext) return error(res, 'Access denied', 403);
    if (!canManageRole(role, grantContext)) return error(res, 'Access denied', 403);
    const roleIds = [role._id, String(role._id)];
    if (role.legacyId != null) roleIds.push(role.legacyId, String(role.legacyId));
    if (await Admin.exists({ roleId: { $in: roleIds } })) {
      return error(res, 'This role is assigned to employees and cannot be deleted', 409);
    }
    await role.deleteOne();
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

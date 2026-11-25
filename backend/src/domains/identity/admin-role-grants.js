const Admin = require('../../models/auth/Admin');
const { resolveAdminRole } = require('../../middleware/auth');
const { normalizeModules } = require('./admin-role-permissions');

const isActiveRole = (role) => role?.status === true || role?.status === 1 || role?.status === '1';

exports.getAdminGrantContext = async (adminId) => {
  if (!adminId) return null;
  const admin = await Admin.findById(adminId).select('roleId status');
  if (!admin || admin.status === false) return null;

  const role = await resolveAdminRole(admin.roleId);
  if (!isActiveRole(role)) return null;

  return {
    isMaster: Number(role.legacyId) === 1,
    modules: normalizeModules(role.modules),
  };
};

exports.isActiveRole = isActiveRole;

exports.canGrantModules = (modules, context) => {
  if (!context) return false;
  if (context.isMaster) return true;
  return normalizeModules(modules).every((module) => context.modules.includes(module));
};

exports.canManageRole = (role, context) => {
  if (!role || !context) return false;
  if (context.isMaster) return true;
  return Number(role.legacyId) !== 1 && exports.canGrantModules(role.modules, context);
};

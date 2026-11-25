const mongoose = require('mongoose');
const Admin = require('../../models/auth/Admin');
const AdminRole = require('../../models/auth/AdminRole');
const { success, error, paginated } = require('../../utils/response');
const { resolveAdminRole } = require('../../middleware/auth');
const { getAdminGrantContext, canManageRole, isActiveRole } = require('./admin-role-grants');

const validPhone = (phone) => typeof phone === 'string'
  && phone.length >= 10 && phone.length <= 20 && /^[0-9\s+\-()]+$/.test(phone);
const validEmployeePassword = (password) => typeof password === 'string'
  && password.length >= 8
  && /[a-z]/.test(password)
  && /[A-Z]/.test(password)
  && /\d/.test(password)
  && /[^A-Za-z0-9]/.test(password);

const withRole = async (admin, role) => {
  const data = admin.toObject();
  delete data.password;
  data.roleId = role ?? await resolveAdminRole(admin.roleId);
  return data;
};

const getManageableAdmin = async (admin, grantContext) => {
  if (!admin) return null;
  const role = await resolveAdminRole(admin.roleId);
  if (!role || Number(role.legacyId) === 1) return null;
  return canManageRole(role, grantContext) ? { admin, role } : null;
};

const getAssignableRole = async (roleId) => {
  if (!mongoose.isValidObjectId(roleId)) return null;
  const role = await AdminRole.findById(roleId);
  return role && isActiveRole(role) && Number(role.legacyId) !== 1 ? role : null;
};

exports.getAll = async (req, res, next) => {
  try {
    const grantContext = await getAdminGrantContext(req.user?.id);
    if (!grantContext) return error(res, 'Access denied', 403);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = {};
    if (mongoose.isValidObjectId(req.query.zone_id)) filter.zoneId = req.query.zone_id;
    const terms = String(req.query.search || '').trim().split(/\s+/).filter(Boolean);
    if (terms.length) {
      const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      filter.$or = ['fName', 'lName', 'phone', 'email'].map((field) => ({
        [field]: { $regex: escaped.join('|'), $options: 'i' },
      }));
    }
    const admins = await Admin.find(filter).sort({ createdAt: -1 });
    const manageableAdmins = await Promise.all(admins.map(async (admin) => {
      const manageable = await getManageableAdmin(admin, grantContext);
      return manageable ? withRole(manageable.admin, manageable.role) : null;
    }));
    const visibleAdmins = manageableAdmins.filter(Boolean);
    const offset = (page - 1) * limit;
    return paginated(res, visibleAdmins.slice(offset, offset + limit), visibleAdmins.length, page, limit);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid admin ID', 400);
    const grantContext = await getAdminGrantContext(req.user?.id);
    if (!grantContext) return error(res, 'Access denied', 403);
    const admin = await Admin.findById(req.params.id);
    const manageable = await getManageableAdmin(admin, grantContext);
    if (!manageable) return error(res, 'Not found', 404);
    return success(res, await withRole(manageable.admin, manageable.role));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { fName, lName, phone, email, password, roleId, zoneId, image, status } = req.body;
    if (typeof fName !== 'string' || !fName.trim() || fName.trim().length > 100) return error(res, 'First name is required and must be at most 100 characters', 400);
    if (lName != null && String(lName).length > 100) return error(res, 'Last name must be at most 100 characters', 400);
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return error(res, 'A valid email is required', 400);
    if (!validPhone(phone)) return error(res, 'Phone must contain 10–20 valid characters', 400);
    if (!validEmployeePassword(password)) return error(res, 'Password must be at least 8 characters and include upper and lower case, a number and a symbol', 400);
    if (image != null && (typeof image !== 'string' || image.length > 2000)) return error(res, 'Profile image URL is invalid', 400);
    if (status !== undefined && typeof status !== 'boolean') return error(res, 'Status must be a boolean', 400);
    const grantContext = await getAdminGrantContext(req.user?.id);
    if (!grantContext) return error(res, 'Access denied', 403);
    const role = await getAssignableRole(roleId);
    if (!role) {
      return error(res, 'Select an active employee role', 400);
    }
    if (!canManageRole(role, grantContext)) {
      return error(res, 'You cannot assign a role with modules your role does not have', 403);
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (await Admin.exists({ email: normalizedEmail })) return error(res, 'Email already in use', 409);
    if (await Admin.exists({ phone: phone.trim() })) return error(res, 'Phone already in use', 409);

    const admin = await Admin.create({
      fName: fName.trim(),
      lName: lName?.trim(),
      phone: phone.trim(),
      email: normalizedEmail,
      image,
      password,
      roleId,
      zoneId,
      ...(status === undefined ? {} : { status }),
    });
    return success(res, await withRole(admin), 'Admin created', 201);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid admin ID', 400);
    const grantContext = await getAdminGrantContext(req.user?.id);
    if (!grantContext) return error(res, 'Access denied', 403);
    const target = await Admin.findById(req.params.id);
    if (!await getManageableAdmin(target, grantContext)) return error(res, 'Not found', 404);

    const allowed = ['fName', 'lName', 'phone', 'email', 'image', 'roleId', 'zoneId', 'password'];
    const fields = Object.fromEntries(
      allowed.filter(k => req.body[k] !== undefined).map(k => [k, req.body[k]])
    );
    if (Object.keys(fields).length === 0)
      return error(res, 'No valid fields to update', 400);
    const fName = fields.fName ?? target.fName;
    const email = fields.email ?? target.email;
    const phone = fields.phone ?? target.phone;
    if (typeof fName !== 'string' || !fName.trim() || fName.trim().length > 100) return error(res, 'First name is required and must be at most 100 characters', 400);
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return error(res, 'A valid email is required', 400);
    if (!validPhone(phone)) return error(res, 'Phone must contain 10–20 valid characters', 400);
    if (fields.lName != null && String(fields.lName).length > 100) return error(res, 'Last name must be at most 100 characters', 400);
    if (fields.image != null && (typeof fields.image !== 'string' || fields.image.length > 2000)) return error(res, 'Profile image URL is invalid', 400);
    if (fields.password !== undefined && fields.password !== '' && !validEmployeePassword(fields.password)) {
      return error(res, 'Password must be at least 8 characters and include upper and lower case, a number and a symbol', 400);
    }
    fields.fName = fName.trim();
    fields.email = email.toLowerCase().trim();
    fields.phone = phone.trim();
    if (await Admin.exists({ email: fields.email, _id: { $ne: target._id } })) return error(res, 'Email already in use', 409);
    if (await Admin.exists({ phone: fields.phone, _id: { $ne: target._id } })) return error(res, 'Phone already in use', 409);
    if (fields.password === '') delete fields.password;
    if (Object.prototype.hasOwnProperty.call(fields, 'roleId')) {
      const role = await getAssignableRole(fields.roleId);
      if (!role) return error(res, 'Select an active employee role', 400);
      if (!canManageRole(role, grantContext)) {
        return error(res, 'You cannot assign a role with modules your role does not have', 403);
      }
    }

    if (fields.password) target.isLoggedIn = false;
    Object.assign(target, fields);
    await target.save();
    return success(res, await withRole(target));
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid admin ID', 400);
    if (typeof req.body.status !== 'boolean')
      return error(res, 'status (boolean) is required', 400);

    const grantContext = await getAdminGrantContext(req.user?.id);
    if (!grantContext) return error(res, 'Access denied', 403);
    const target = await Admin.findById(req.params.id);
    if (!await getManageableAdmin(target, grantContext)) return error(res, 'Not found', 404);
    if (req.body.status === false && String(req.user.id) === String(target._id)) {
      return error(res, 'You cannot deactivate your own account', 409);
    }

    const admin = await Admin.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!admin) return error(res, 'Not found', 404);
    return success(res, admin);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid admin ID', 400);
    const grantContext = await getAdminGrantContext(req.user?.id);
    if (!grantContext) return error(res, 'Access denied', 403);
    const target = await Admin.findById(req.params.id);
    if (!await getManageableAdmin(target, grantContext)) return error(res, 'Not found', 404);
    if (String(req.user.id) === String(target._id)) {
      return error(res, 'You cannot delete your own account', 409);
    }

    const admin = await Admin.findByIdAndDelete(req.params.id);
    if (!admin) return error(res, 'Not found', 404);
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

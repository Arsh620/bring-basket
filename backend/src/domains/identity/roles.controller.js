const mongoose = require('mongoose');
const AdminRole = require('../../models/auth/AdminRole');
const { success, error } = require('../../utils/response');

exports.getAll = async (req, res, next) => {
  try {
    const roles = await AdminRole.find().sort({ name: 1 });
    return success(res, roles);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid role ID', 400);
    const role = await AdminRole.findById(req.params.id);
    if (!role) return error(res, 'Not found', 404);
    return success(res, role);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, modules } = req.body;
    if (!name?.trim()) return error(res, 'Role name is required', 400);
    const role = await AdminRole.create({ name: name.trim(), modules });
    return success(res, role, 'Role created', 201);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid role ID', 400);
    const { name, modules, status } = req.body;
    const role = await AdminRole.findById(req.params.id);
    if (!role) return error(res, 'Not found', 404);
    if (name !== undefined) role.name = name.trim();
    if (modules !== undefined) role.modules = modules;
    if (status !== undefined) role.status = status;
    await role.save();
    return success(res, role);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid role ID', 400);
    const role = await AdminRole.findByIdAndDelete(req.params.id);
    if (!role) return error(res, 'Not found', 404);
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

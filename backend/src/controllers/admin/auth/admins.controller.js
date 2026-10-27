const mongoose = require('mongoose');
const Admin = require('../../../models/auth/Admin');
const { success, error } = require('../../../utils/response');

exports.getAll = async (req, res, next) => {
  try {
    const admins = await Admin.find().populate('roleId', 'name').sort({ createdAt: -1 });
    return success(res, admins);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid admin ID', 400);
    const admin = await Admin.findById(req.params.id).populate('roleId', 'name');
    if (!admin) return error(res, 'Not found', 404);
    return success(res, admin);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { fName, lName, phone, email, password, roleId, zoneId } = req.body;
    if (!email?.trim()) return error(res, 'Email is required', 400);
    if (!password) return error(res, 'Password is required', 400);
    if (!roleId || !mongoose.isValidObjectId(roleId))
      return error(res, 'Valid roleId is required', 400);

    const exists = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (exists) return error(res, 'Email already in use', 409);

    const admin = await Admin.create({ fName, lName, phone, email, password, roleId, zoneId });
    return success(res, admin, 'Admin created', 201);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid admin ID', 400);

    const allowed = ['fName', 'lName', 'phone', 'image', 'roleId', 'zoneId'];
    const fields = Object.fromEntries(
      allowed.filter(k => req.body[k] !== undefined).map(k => [k, req.body[k]])
    );
    if (Object.keys(fields).length === 0)
      return error(res, 'No valid fields to update', 400);

    const admin = await Admin.findByIdAndUpdate(req.params.id, fields, { new: true }).populate('roleId', 'name');
    if (!admin) return error(res, 'Not found', 404);
    return success(res, admin);
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid admin ID', 400);
    if (typeof req.body.status !== 'boolean')
      return error(res, 'status (boolean) is required', 400);

    const admin = await Admin.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!admin) return error(res, 'Not found', 404);
    return success(res, admin);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid admin ID', 400);
    const admin = await Admin.findByIdAndDelete(req.params.id);
    if (!admin) return error(res, 'Not found', 404);
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

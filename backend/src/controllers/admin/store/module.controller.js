const mongoose = require('mongoose');
const Module = require('../../../models/store/Module');
const { success, error } = require('../../../utils/response');

exports.getAll = async (req, res, next) => {
  try {
    const filter = {};
    const { moduleType, status } = req.query;
    if (moduleType) filter.moduleType = moduleType;
    if (status !== undefined) filter.status = status === 'true';
    const modules = await Module.find(filter).sort({ moduleName: 1 });
    return success(res, modules);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid module ID', 400);
    const module = await Module.findById(req.params.id);
    if (!module) return error(res, 'Not found', 404);
    return success(res, module);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { moduleName, moduleType, thumbnail, icon, description, themeId, allZoneService } = req.body;
    if (!moduleName?.trim()) return error(res, 'moduleName is required', 400);
    if (!moduleType?.trim()) return error(res, 'moduleType is required', 400);
    const mod = await Module.create({ moduleName, moduleType, thumbnail, icon, description, themeId, allZoneService });
    return success(res, mod, 'Module created', 201);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid module ID', 400);
    const allowed = ['moduleName', 'moduleType', 'thumbnail', 'icon', 'description', 'themeId', 'allZoneService', 'status'];
    const fields = Object.fromEntries(
      allowed.filter(k => req.body[k] !== undefined).map(k => [k, req.body[k]])
    );
    if (!Object.keys(fields).length) return error(res, 'No valid fields to update', 400);
    const mod = await Module.findByIdAndUpdate(req.params.id, fields, { new: true });
    if (!mod) return error(res, 'Not found', 404);
    return success(res, mod);
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid module ID', 400);
    if (typeof req.body.status !== 'boolean')
      return error(res, 'status (boolean) is required', 400);
    const mod = await Module.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!mod) return error(res, 'Not found', 404);
    return success(res, mod);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid module ID', 400);
    const mod = await Module.findByIdAndDelete(req.params.id);
    if (!mod) return error(res, 'Not found', 404);
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

const mongoose = require('mongoose');
const UnitGroup = require('../../../models/catalog/UnitGroup');
const UnitGroupConversion = require('../../../models/catalog/UnitGroupConversion');
const { success, error } = require('../../../utils/response');

// ── Helpers ────────────────────────────────────────────────────────────────

const isValidId = (id) => mongoose.isValidObjectId(id);

// ── Unit Groups ────────────────────────────────────────────────────────────

exports.getAll = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const groups = await UnitGroup.find(filter).sort({ name: 1 });
    return success(res, groups);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid unit group ID', 400);
    const group = await UnitGroup.findById(req.params.id);
    if (!group) return error(res, 'Not found', 404);

    const conversions = await UnitGroupConversion.find({ unitGroupId: group._id });
    return success(res, { ...group.toObject(), conversions });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, baseUnit, status } = req.body;
    if (!name?.trim()) return error(res, 'name is required', 400);
    if (!baseUnit?.trim()) return error(res, 'baseUnit is required', 400);

    const group = await UnitGroup.create({ name: name.trim(), baseUnit: baseUnit.trim(), status });
    return success(res, group, 'Unit group created', 201);
  } catch (err) {
    if (err.code === 11000) return error(res, 'Unit group with this name and baseUnit already exists', 409);
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid unit group ID', 400);
    const allowed = ['name', 'baseUnit', 'status'];
    const fields = Object.fromEntries(
      allowed.filter(k => req.body[k] !== undefined).map(k => [k, req.body[k]])
    );
    if (!Object.keys(fields).length) return error(res, 'No valid fields to update', 400);

    const group = await UnitGroup.findByIdAndUpdate(req.params.id, fields, { new: true });
    if (!group) return error(res, 'Not found', 404);
    return success(res, group);
  } catch (err) {
    if (err.code === 11000) return error(res, 'Unit group with this name and baseUnit already exists', 409);
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid unit group ID', 400);
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status))
      return error(res, 'status must be active or inactive', 400);

    const group = await UnitGroup.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!group) return error(res, 'Not found', 404);
    return success(res, group);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid unit group ID', 400);
    const group = await UnitGroup.findByIdAndDelete(req.params.id);
    if (!group) return error(res, 'Not found', 404);
    await UnitGroupConversion.deleteMany({ unitGroupId: req.params.id });
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

// ── Conversions ────────────────────────────────────────────────────────────

exports.getConversions = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid unit group ID', 400);
    const conversions = await UnitGroupConversion.find({ unitGroupId: req.params.id });
    return success(res, conversions);
  } catch (err) { next(err); }
};

exports.addConversion = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return error(res, 'Invalid unit group ID', 400);
    const { unit, factor } = req.body;
    if (!unit?.trim()) return error(res, 'unit is required', 400);
    if (!factor || isNaN(factor) || Number(factor) <= 0)
      return error(res, 'factor must be a positive number', 400);

    const group = await UnitGroup.findById(req.params.id);
    if (!group) return error(res, 'Unit group not found', 404);

    const conversion = await UnitGroupConversion.create({
      unitGroupId: req.params.id,
      unit: unit.trim(),
      factor: Number(factor),
    });
    return success(res, conversion, 'Conversion added', 201);
  } catch (err) {
    if (err.code === 11000) return error(res, 'Conversion for this unit already exists', 409);
    next(err);
  }
};

exports.updateConversion = async (req, res, next) => {
  try {
    if (!isValidId(req.params.conversionId))
      return error(res, 'Invalid conversion ID', 400);
    const { unit, factor } = req.body;
    const fields = {};
    if (unit !== undefined) fields.unit = unit.trim();
    if (factor !== undefined) {
      if (isNaN(factor) || Number(factor) <= 0)
        return error(res, 'factor must be a positive number', 400);
      fields.factor = Number(factor);
    }
    if (!Object.keys(fields).length) return error(res, 'No valid fields to update', 400);

    const conversion = await UnitGroupConversion.findByIdAndUpdate(
      req.params.conversionId, fields, { new: true }
    );
    if (!conversion) return error(res, 'Not found', 404);
    return success(res, conversion);
  } catch (err) {
    if (err.code === 11000) return error(res, 'Conversion for this unit already exists', 409);
    next(err);
  }
};

exports.removeConversion = async (req, res, next) => {
  try {
    if (!isValidId(req.params.conversionId))
      return error(res, 'Invalid conversion ID', 400);
    const conversion = await UnitGroupConversion.findByIdAndDelete(req.params.conversionId);
    if (!conversion) return error(res, 'Not found', 404);
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};

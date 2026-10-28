const mongoose = require('mongoose');
const UnitGroup = require('../../models/catalog/UnitGroup');
const UnitGroupConversion = require('../../models/catalog/UnitGroupConversion');
const AppError = require('../../utils/AppError');

const validateId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${label} ID`, 400);
};

const duplicateError = (err, message) => {
  if (err.code === 11000) throw new AppError(message, 409);
  throw err;
};

exports.getAll = ({ status }) => {
  const filter = {};
  if (status) filter.status = status;
  return UnitGroup.find(filter).sort({ name: 1 });
};

exports.getOne = async (id) => {
  validateId(id, 'unit group');
  const group = await UnitGroup.findById(id);
  if (!group) throw new AppError('Not found', 404);
  const conversions = await UnitGroupConversion.find({ unitGroupId: group._id });
  return { ...group.toObject(), conversions };
};

exports.create = async ({ name, baseUnit, status }) => {
  if (!name?.trim()) throw new AppError('name is required', 400);
  if (!baseUnit?.trim()) throw new AppError('baseUnit is required', 400);
  try {
    return await UnitGroup.create({ name: name.trim(), baseUnit: baseUnit.trim(), status });
  } catch (err) {
    duplicateError(err, 'Unit group with this name and baseUnit already exists');
  }
};

exports.update = async (id, body) => {
  validateId(id, 'unit group');
  const allowed = ['name', 'baseUnit', 'status'];
  const fields = Object.fromEntries(
    allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]),
  );
  if (!Object.keys(fields).length) throw new AppError('No valid fields to update', 400);
  try {
    const group = await UnitGroup.findByIdAndUpdate(id, fields, { new: true });
    if (!group) throw new AppError('Not found', 404);
    return group;
  } catch (err) {
    duplicateError(err, 'Unit group with this name and baseUnit already exists');
  }
};

exports.updateStatus = async (id, status) => {
  validateId(id, 'unit group');
  if (!['active', 'inactive'].includes(status)) {
    throw new AppError('status must be active or inactive', 400);
  }
  const group = await UnitGroup.findByIdAndUpdate(id, { status }, { new: true });
  if (!group) throw new AppError('Not found', 404);
  return group;
};

exports.remove = async (id) => {
  validateId(id, 'unit group');
  const group = await UnitGroup.findByIdAndDelete(id);
  if (!group) throw new AppError('Not found', 404);
  await UnitGroupConversion.deleteMany({ unitGroupId: id });
};

exports.getConversions = (id) => {
  validateId(id, 'unit group');
  return UnitGroupConversion.find({ unitGroupId: id });
};

exports.addConversion = async (id, { unit, factor }) => {
  validateId(id, 'unit group');
  if (!unit?.trim()) throw new AppError('unit is required', 400);
  if (!factor || isNaN(factor) || Number(factor) <= 0) {
    throw new AppError('factor must be a positive number', 400);
  }
  const group = await UnitGroup.findById(id);
  if (!group) throw new AppError('Unit group not found', 404);
  try {
    return await UnitGroupConversion.create({
      unitGroupId: id,
      unit: unit.trim(),
      factor: Number(factor),
    });
  } catch (err) {
    duplicateError(err, 'Conversion for this unit already exists');
  }
};

exports.updateConversion = async (id, { unit, factor }) => {
  validateId(id, 'conversion');
  const fields = {};
  if (unit !== undefined) fields.unit = unit.trim();
  if (factor !== undefined) {
    if (isNaN(factor) || Number(factor) <= 0) {
      throw new AppError('factor must be a positive number', 400);
    }
    fields.factor = Number(factor);
  }
  if (!Object.keys(fields).length) throw new AppError('No valid fields to update', 400);
  try {
    const conversion = await UnitGroupConversion.findByIdAndUpdate(id, fields, { new: true });
    if (!conversion) throw new AppError('Not found', 404);
    return conversion;
  } catch (err) {
    duplicateError(err, 'Conversion for this unit already exists');
  }
};

exports.removeConversion = async (id) => {
  validateId(id, 'conversion');
  const conversion = await UnitGroupConversion.findByIdAndDelete(id);
  if (!conversion) throw new AppError('Not found', 404);
};

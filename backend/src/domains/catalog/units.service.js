const mongoose = require('mongoose');
const Unit = require('../../models/catalog/Unit');
const AppError = require('../../utils/AppError');

const validateUnitId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid unit ID', 400);
};

const validateUnitName = (value) => {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw new AppError('Unit name is required', 400);
  return name;
};

exports.getAll = () => Unit.find().sort({ unit: 1 });

exports.getOne = async (id) => {
  validateUnitId(id);
  return Unit.findById(id);
};

exports.create = (value) => Unit.create({ unit: validateUnitName(value) });

exports.update = async (id, value) => {
  validateUnitId(id);
  const unitName = validateUnitName(value);
  const unit = await Unit.findById(id);
  if (!unit) return null;
  unit.unit = unitName;
  return unit.save();
};

exports.remove = async (id) => {
  validateUnitId(id);
  return Unit.findByIdAndDelete(id);
};

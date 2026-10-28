const mongoose = require('mongoose');
const Category = require('../../models/catalog/Category');
const AppError = require('../../utils/AppError');
const { buildCategoryFilter, parseStatus } = require('./categories.validation');

const validateCategoryId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid category ID', 400);
};

const getAll = (query) => Category.find(buildCategoryFilter(query)).sort({ priority: 1 });

const getOne = async (id) => {
  validateCategoryId(id);
  const category = await Category.findById(id);
  if (!category) throw new AppError('Not found', 404);
  return category;
};

const create = (body) => Category.create(body);

const update = async (id, body) => {
  validateCategoryId(id);
  const category = await Category.findByIdAndUpdate(id, body, { new: true });
  if (!category) throw new AppError('Not found', 404);
  return category;
};

const remove = async (id) => {
  validateCategoryId(id);
  const category = await Category.findByIdAndDelete(id);
  if (!category) throw new AppError('Not found', 404);
};

const updateStatus = async (id, value) => {
  validateCategoryId(id);
  const status = parseStatus(value, { required: true });
  const category = await Category.findByIdAndUpdate(id, { status }, { new: true });
  if (!category) throw new AppError('Not found', 404);
  return category;
};

module.exports = { getAll, getOne, create, update, remove, updateStatus };

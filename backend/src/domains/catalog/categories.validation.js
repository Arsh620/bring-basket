const mongoose = require('mongoose');
const AppError = require('../../utils/AppError');

const normalizeStatus = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return null;
};

const parseStatus = (value, { required = false } = {}) => {
  if (value === undefined || value === null) {
    if (required) throw new AppError('Status is required', 400);
    return null;
  }

  const status = normalizeStatus(value);
  if (status === null) throw new AppError('Status must be true or false', 400);
  return status;
};

const buildCategoryFilter = ({ moduleId, parentId, status } = {}) => {
  const filter = {};

  if (moduleId) {
    if (!mongoose.isValidObjectId(moduleId)) {
      throw new AppError('Invalid module ID', 400);
    }
    filter.moduleId = moduleId;
  }

  if (parentId === 'null') {
    filter.parentId = null;
  } else if (parentId) {
    if (!mongoose.isValidObjectId(parentId)) {
      throw new AppError('Invalid parent category ID', 400);
    }
    filter.parentId = parentId;
  }

  if (status !== undefined) filter.status = parseStatus(status);
  return filter;
};

module.exports = { buildCategoryFilter, parseStatus };

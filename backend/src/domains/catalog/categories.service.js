const mongoose = require('mongoose');
const Category = require('../../models/catalog/Category');
const AppError = require('../../utils/AppError');
const { buildCategoryFilter, parseStatus } = require('./categories.validation');
const { getRedis } = require('../../config/redis');

const CACHE_KEY = 'catalog:categories:all';
const CACHE_TTL = 300; // 5 minutes

const validateCategoryId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid category ID', 400);
};

const invalidateCache = async () => {
  const redis = getRedis();
  if (redis) await redis.del(CACHE_KEY);
};

const getAll = async (query) => {
  const redis = getRedis();
  const hasFilters = Object.keys(query).length > 0;

  if (!hasFilters && redis) {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  }

  const data = await Category.find(buildCategoryFilter(query)).sort({ priority: 1 });

  if (!hasFilters && redis) {
    await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(data));
  }

  return data;
};

const getOne = async (id) => {
  validateCategoryId(id);
  const category = await Category.findById(id);
  if (!category) throw new AppError('Not found', 404);
  return category;
};

const create = async (body) => {
  const category = await Category.create(body);
  await invalidateCache();
  return category;
};

const update = async (id, body) => {
  validateCategoryId(id);
  const category = await Category.findByIdAndUpdate(id, body, { new: true });
  if (!category) throw new AppError('Not found', 404);
  await invalidateCache();
  return category;
};

const remove = async (id) => {
  validateCategoryId(id);
  const category = await Category.findByIdAndDelete(id);
  if (!category) throw new AppError('Not found', 404);
  await invalidateCache();
};

const updateStatus = async (id, value) => {
  validateCategoryId(id);
  const status = parseStatus(value, { required: true });
  const category = await Category.findByIdAndUpdate(id, { status }, { new: true });
  if (!category) throw new AppError('Not found', 404);
  await invalidateCache();
  return category;
};

module.exports = { getAll, getOne, create, update, remove, updateStatus };

const Brand = require('../../models/catalog/Brand');
const { getRedis } = require('../../config/redis');

const CACHE_KEY = 'catalog:brands:all';
const CACHE_TTL = 300; // 5 minutes

const invalidateCache = async () => {
  const redis = getRedis();
  if (redis) await redis.del(CACHE_KEY);
};

exports.getAll = async () => {
  const redis = getRedis();
  if (redis) {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  }
  const data = await Brand.find();
  if (redis) await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(data));
  return data;
};

exports.create = async (body) => {
  const brand = await Brand.create(body);
  await invalidateCache();
  return brand;
};

exports.update = async (id, body) => {
  const brand = await Brand.findByIdAndUpdate(id, body, { new: true });
  await invalidateCache();
  return brand;
};

exports.remove = async (id) => {
  const brand = await Brand.findByIdAndDelete(id);
  await invalidateCache();
  return brand;
};

exports.updateStatus = async (id, status) => {
  const brand = await Brand.findByIdAndUpdate(id, { status }, { new: true });
  await invalidateCache();
  return brand;
};

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedis } = require('../config/redis');

const makeStore = () => {
  const redis = getRedis();
  if (!redis) return undefined; // fallback to in-memory
  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  });
};

const baseOptions = {
  standardHeaders: true,
  legacyHeaders: false,
};

exports.globalLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later' },
  store: makeStore(),
});

exports.authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, please try again later' },
  store: makeStore(),
});

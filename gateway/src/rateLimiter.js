const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedis } = require('./redis');

const makeStore = () => {
  const redis = getRedis();
  if (!redis || redis.status !== 'ready') return undefined;
  return new RedisStore({ sendCommand: (...args) => redis.call(...args) });
};

exports.globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
  store: makeStore(),
});

exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later' },
  store: makeStore(),
});

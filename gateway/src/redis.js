const Redis = require('ioredis');
const logger = require('./logger');

let client = null;

const connectRedis = () => {
  if (!process.env.REDIS_URL) {
    logger.warn('REDIS_URL not set — rate limiting will be in-memory');
    return null;
  }
  client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  client.on('connect', () => logger.info('Gateway Redis connected'));
  client.on('error', (err) => logger.error({ message: 'Gateway Redis error', error: err.message }));
  client.connect().catch((err) => {
    logger.error({ message: 'Gateway Redis connection failed', error: err.message });
  });
  return client;
};

const getRedis = () => client;
const closeRedis = async () => { if (client) { await client.quit(); client = null; } };

module.exports = { connectRedis, getRedis, closeRedis };

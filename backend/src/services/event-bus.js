/**
 * event-bus.js — Redis Streams based event bus
 *
 * Usage:
 *   const bus = require('./event-bus');
 *
 *   // Publish
 *   await bus.publish('order.placed', { orderId, userId, amount });
 *
 *   // Subscribe (call once at startup)
 *   bus.subscribe('notification-service', {
 *     'order.placed':    handleOrderPlaced,
 *     'order.delivered': handleOrderDelivered,
 *   });
 */

const STREAM_KEY = 'bb:events';
const MAX_LEN    = 10000; // keep last 10k events per stream

let _redis = null;

const getRedis = () => {
  if (!_redis) throw new Error('Event bus: Redis not initialized. Call bus.init(redisClient) first.');
  return _redis;
};

/**
 * Initialize with an ioredis client instance.
 * Call this once at service startup after Redis connects.
 */
const init = (redisClient) => { _redis = redisClient; };

/**
 * Publish an event to the shared stream.
 * @param {string} type  — e.g. 'order.placed'
 * @param {object} data  — serializable payload
 */
const publish = async (type, data) => {
  try {
    await getRedis().xadd(
      STREAM_KEY,
      'MAXLEN', '~', String(MAX_LEN),
      '*',
      'type', type,
      'data', JSON.stringify(data),
      'ts',   String(Date.now()),
    );
  } catch (err) {
    // Non-blocking — log but don't crash the caller
    console.error('[event-bus] publish error:', err.message);
  }
};

/**
 * Subscribe to events using a consumer group.
 * @param {string}   groupName  — unique per service, e.g. 'notification-service'
 * @param {object}   handlers   — { 'order.placed': async (data) => {} }
 * @param {object}   [opts]
 * @param {number}   [opts.pollMs=500]    — polling interval
 * @param {number}   [opts.batchSize=10]  — messages per poll
 */
const subscribe = (groupName, handlers, { pollMs = 500, batchSize = 10 } = {}) => {
  const redis = getRedis();
  let running = true;

  const ensureGroup = async () => {
    try {
      await redis.xgroup('CREATE', STREAM_KEY, groupName, '$', 'MKSTREAM');
    } catch (err) {
      if (!err.message.includes('BUSYGROUP')) throw err;
      // Group already exists — fine
    }
  };

  const processMessages = async (messages) => {
    for (const [id, fields] of messages) {
      const type = fields[fields.indexOf('type') + 1];
      const raw  = fields[fields.indexOf('data') + 1];
      const handler = handlers[type];
      if (handler) {
        try {
          await handler(JSON.parse(raw));
        } catch (err) {
          console.error(`[event-bus] handler error for ${type}:`, err.message);
        }
      }
      // Acknowledge processed message
      await redis.xack(STREAM_KEY, groupName, id).catch(() => {});
    }
  };

  const poll = async () => {
    await ensureGroup();
    while (running) {
      try {
        const results = await redis.xreadgroup(
          'GROUP', groupName, `${groupName}-worker`,
          'COUNT', String(batchSize),
          'BLOCK', String(pollMs),
          'STREAMS', STREAM_KEY, '>',
        );
        if (results) {
          for (const [, messages] of results) {
            await processMessages(messages);
          }
        }
      } catch (err) {
        if (running) {
          console.error('[event-bus] poll error:', err.message);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
  };

  // Start polling in background
  poll().catch((err) => console.error('[event-bus] fatal poll error:', err.message));

  return {
    stop: () => { running = false; },
  };
};

module.exports = { init, publish, subscribe };

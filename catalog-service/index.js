require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoose = require('mongoose');

const logger = require('./src/config/logger');
const { connectRedis, getRedis, closeRedis } = require('./src/config/redis');
const sanitize = require('./src/middleware/sanitize');
const errorHandler = require('./src/middleware/errorHandler');

require('./src/models/catalog/Brand');
require('./src/models/catalog/Category');
require('./src/models/catalog/Item');
require('./src/models/catalog/ItemBatch');
require('./src/models/catalog/Unit');
require('./src/models/catalog/UnitGroup');
require('./src/models/catalog/UnitGroupConversion');
require('./src/models/store/Store');
require('./src/domains/inventory/store-item-stock.model');

const PORT = process.env.PORT || 5002;
const app = express();
let server;
let shuttingDown = false;

app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(sanitize);
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

app.get('/health', (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  const redisReady = getRedis()?.status === 'ready';
  const ok = dbReady && redisReady;

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    service: 'catalog',
    db: dbReady ? 'connected' : 'disconnected',
    redis: redisReady ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  });
});

app.use('/api/v1/admin', require('./src/routes/v1/catalog'));
app.use(errorHandler);

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Catalog service received ${signal}; shutting down`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await mongoose.disconnect();
    await closeRedis();
    logger.info('Catalog service shut down gracefully');
  } catch (error) {
    logger.error({ message: 'Catalog service shutdown failed', error: error.message });
    process.exitCode = 1;
  }
};

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });

const start = async () => {
  await mongoose.connect(process.env.MONGO_URI, { retryWrites: true });

  connectRedis();
  await getRedis().ping();

  server = app.listen(PORT, () => {
    logger.info(`Catalog service running on port ${PORT}`);
  });
};

start().catch((error) => {
  logger.error({ message: 'Catalog service failed to start', error: error.message });
  void closeRedis().finally(() => {
    process.exitCode = 1;
  });
});

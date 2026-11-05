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

require('./src/models/auth/Vendor');
require('./src/models/catalog/Brand');
require('./src/models/catalog/Category');
require('./src/models/catalog/Item');
require('./src/models/catalog/BatchWriteOff');
require('./src/models/store/Module');
require('./src/models/store/Zone');
require('./src/models/store/Store');
require('./src/models/warehouse/Warehouse');
require('./src/models/warehouse/WarehouseItemStock');
require('./src/models/warehouse/WarehouseStockMovement');
require('./src/models/warehouse/WarehouseStockTransfer');
require('./src/models/warehouse/StoreStockRequest');

const PORT = process.env.PORT || 5004;
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
    service: 'inventory',
    db: dbReady ? 'connected' : 'disconnected',
    redis: redisReady ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  });
});

app.use('/api/v1/admin', require('./src/routes/v1/inventory'));
app.use(errorHandler);

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Inventory service received ${signal}; shutting down`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await mongoose.disconnect();
    await closeRedis();
    logger.info('Inventory service shut down gracefully');
  } catch (error) {
    logger.error({ message: 'Inventory service shutdown failed', error: error.message });
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
    logger.info(`Inventory service running on port ${PORT}`);
  });
};

start().catch((error) => {
  logger.error({ message: 'Inventory service failed to start', error: error.message });
  void closeRedis().finally(() => {
    process.exitCode = 1;
  });
});

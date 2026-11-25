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
const serviceAuth = require('./src/middleware/service-auth')('backend', 'order-service');
const orderController = require('./src/domains/orders/order.controller');

require('./src/domains/orders/cart.model');
require('./src/domains/orders/order.model');

const PORT = process.env.PORT || 5006;
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
    service: 'order',
    db: dbReady ? 'connected' : 'disconnected',
    redis: redisReady ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  });
});

app.use('/api/v1/customer', require('./src/routes/v1/orders'));
app.use('/api/v1/admin', require('./src/routes/v1/orders/admin'));

const internalAdminRoutes = express.Router();
internalAdminRoutes.use(serviceAuth);
internalAdminRoutes.get('/dashboard-stats', orderController.adminDashboardStats);
app.use('/internal/admin', internalAdminRoutes);

const vendorOrderRoutes = express.Router();
vendorOrderRoutes.use(serviceAuth, (req, res, next) => {
  const context = req.serviceClaims?.vendorContext;
  if (!Array.isArray(context?.storeIds) || context.storeIds.length === 0) {
    return res.status(403).json({ success: false, message: 'Vendor store scope is required' });
  }
  req.vendorContext = {
    storeIds: context.storeIds.map(String),
    orderConfirmationModel: context.orderConfirmationModel,
    canStoreCancel: context.canStoreCancel === true,
  };
  return next();
});
vendorOrderRoutes.get('/orders', orderController.vendorList);
vendorOrderRoutes.get('/dashboard', orderController.vendorDashboard);
vendorOrderRoutes.put('/orders/update-status', orderController.vendorUpdateStatus);
app.use('/internal/vendor', vendorOrderRoutes);
app.use(errorHandler);

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Order service received ${signal}; shutting down`);
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await mongoose.disconnect();
    await closeRedis();
    logger.info('Order service shut down gracefully');
  } catch (error) {
    logger.error({ message: 'Order service shutdown failed', error: error.message });
    process.exitCode = 1;
  }
};

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });

const start = async () => {
  await mongoose.connect(process.env.MONGO_URI, { retryWrites: true });
  connectRedis();
  await getRedis().ping();
  server = app.listen(PORT, () => logger.info(`Order service running on port ${PORT}`));
};

start().catch((error) => {
  logger.error({ message: 'Order service failed to start', error: error.message });
  void closeRedis().finally(() => { process.exitCode = 1; });
});

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

require('./src/models/auth/User');
require('./src/models/auth/DeliveryMan');
require('./src/models/auth/Notification');

const PORT = process.env.PORT || 5008;
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
    service: 'notification',
    db: dbReady ? 'connected' : 'disconnected',
    redis: redisReady ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  });
});

const router = express.Router();
const notifications = require('./src/domains/identity/notifications.controller');
const { customerAuth, adminAuth, deliverymanAuth } = require('./src/middleware/auth');
const { checkRole } = require('./src/middleware/roleCheck');

const adminOnly = [adminAuth, checkRole('admin')];

// Customer notifications
router.get('/customer/notifications', customerAuth, notifications.getCustomerNotifications);
router.put('/customer/notifications/read-all', customerAuth, notifications.markAllRead);
router.put('/customer/notifications/:id/read', customerAuth, notifications.markRead);

// Delivery man notifications
router.get('/deliveryman/notifications', deliverymanAuth, notifications.getCustomerNotifications);

// Admin broadcast
router.post('/admin/notifications/broadcast', adminOnly, notifications.adminBroadcast);

app.use('/api/v1', router);
app.use(errorHandler);

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Notification service received ${signal}; shutting down`);
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await mongoose.disconnect();
    await closeRedis();
    logger.info('Notification service shut down gracefully');
  } catch (error) {
    logger.error({ message: 'Notification service shutdown failed', error: error.message });
    process.exitCode = 1;
  }
};

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });

const start = async () => {
  await mongoose.connect(process.env.MONGO_URI, { retryWrites: true });
  connectRedis();
  await getRedis().ping();
  server = app.listen(PORT, () => logger.info(`Notification service running on port ${PORT}`));
};

start().catch((error) => {
  logger.error({ message: 'Notification service failed to start', error: error.message });
  void closeRedis().finally(() => { process.exitCode = 1; });
});

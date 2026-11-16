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
require('./src/models/auth/WalletTransaction');
require('./src/models/auth/LoyaltyTransaction');
require('./src/models/auth/Notification');
require('./src/models/store/Cashback');
require('./src/models/store/CashbackHistory');
require('./src/models/store/WalletBonus');

const PORT = process.env.PORT || 5007;
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
    service: 'accounting',
    db: dbReady ? 'connected' : 'disconnected',
    redis: redisReady ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  });
});

// Customer routes
const customerRouter = express.Router();
const wallet = require('./src/domains/identity/wallet.controller');
const loyalty = require('./src/domains/identity/loyalty.controller');
const cashback = require('./src/domains/store/cashback.controller');
const customers = require('./src/domains/identity/customers.controller');
const walletBonus = require('./src/domains/store/wallet-bonus.controller');
const { customerAuth, adminAuth } = require('./src/middleware/auth');
const { checkRole } = require('./src/middleware/roleCheck');
const { authLimiter } = require('./src/middleware/rateLimiter');

const adminOnly = [adminAuth, checkRole('admin')];

// Customer wallet
customerRouter.get('/customer/wallet/balance', customerAuth, wallet.balance);
customerRouter.get('/customer/wallet/transactions', customerAuth, wallet.transactions);
customerRouter.get('/customer/wallet/bonuses', customerAuth, wallet.bonuses);
customerRouter.post('/customer/wallet/add-fund', customerAuth, wallet.addFund);

// Customer loyalty
customerRouter.get('/customer/loyalty-point/transactions', customerAuth, loyalty.transactions);
customerRouter.post('/customer/loyalty-point/point-transfer', customerAuth, loyalty.pointTransfer);

// Customer cashback
customerRouter.get('/cashback/list', cashback.list);
customerRouter.get('/cashback/getCashback', cashback.getCashback);

// Admin customer management
customerRouter.get('/admin/customers', adminOnly, customers.getAll);
customerRouter.get('/admin/customers/:id', adminOnly, customers.getOne);
customerRouter.patch('/admin/customers/:id/status', adminOnly, customers.updateStatus);
customerRouter.post('/admin/customers/:id/wallet/add-fund', adminOnly, customers.addWalletFund);
customerRouter.post('/admin/customers/:id/loyalty/adjust', adminOnly, customers.adjustLoyalty);
customerRouter.get('/admin/customers/:id/orders', adminOnly, customers.getOrders);

// Admin cashback
customerRouter.get('/admin/cashback', adminOnly, cashback.adminGetAll);
customerRouter.post('/admin/cashback', adminOnly, cashback.adminCreate);
customerRouter.put('/admin/cashback/:id', adminOnly, cashback.adminUpdate);
customerRouter.patch('/admin/cashback/:id/status', adminOnly, cashback.adminUpdateStatus);
customerRouter.delete('/admin/cashback/:id', adminOnly, cashback.adminDelete);

// Admin wallet bonus
customerRouter.get('/admin/wallet-bonus', adminOnly, walletBonus.getAll);
customerRouter.post('/admin/wallet-bonus', adminOnly, walletBonus.create);
customerRouter.put('/admin/wallet-bonus/:id', adminOnly, walletBonus.update);
customerRouter.patch('/admin/wallet-bonus/:id/status', adminOnly, walletBonus.updateStatus);
customerRouter.delete('/admin/wallet-bonus/:id', adminOnly, walletBonus.remove);

app.use('/api/v1', customerRouter);
app.use(errorHandler);

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Accounting service received ${signal}; shutting down`);
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await mongoose.disconnect();
    await closeRedis();
    logger.info('Accounting service shut down gracefully');
  } catch (error) {
    logger.error({ message: 'Accounting service shutdown failed', error: error.message });
    process.exitCode = 1;
  }
};

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });

const start = async () => {
  await mongoose.connect(process.env.MONGO_URI, { retryWrites: true });
  connectRedis();
  await getRedis().ping();
  server = app.listen(PORT, () => logger.info(`Accounting service running on port ${PORT}`));
};

start().catch((error) => {
  logger.error({ message: 'Accounting service failed to start', error: error.message });
  void closeRedis().finally(() => { process.exitCode = 1; });
});

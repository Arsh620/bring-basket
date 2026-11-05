require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');

const logger = require('./src/logger');
const { connectRedis, closeRedis } = require('./src/redis');
const { globalLimiter, authLimiter } = require('./src/rateLimiter');
const authMiddleware = require('./src/auth');
const serviceRoutes = require('./src/routes');

const app = express();

connectRedis();

// ── Core middleware ───────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
}));
app.use(compression());
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gateway', uptime: process.uptime() });
});

// ── Auth rate limiter on login routes ────────────────────────────────────────
app.use(/^\/api\/v1\/.+\/auth\/login$/, authLimiter);
app.use(/^\/api\/v1\/.+\/auth\/register$/, authLimiter);

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use(globalLimiter);

// ── JWT verify ────────────────────────────────────────────────────────────────
app.use(authMiddleware);

// ── Proxy routes ──────────────────────────────────────────────────────────────
for (const [name, config] of Object.entries(serviceRoutes)) {
  for (const prefix of config.pathPrefix) {
    app.use(
      prefix,
      createProxyMiddleware({
        target: config.target,
        changeOrigin: true,
        pathRewrite: (path) => (path.startsWith(prefix) ? path : `${prefix}${path}`),
        on: {
          error: (err, req, res) => {
            logger.error({ message: `Proxy error [${name}]`, error: err.message, path: req.path });
            res.status(502).json({ success: false, message: `${name} service unavailable` });
          },
        },
      }),
    );
  }
}

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Gateway running on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  logger.error({ message: 'Unhandled Rejection', error: err.message });
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  server.close(async () => {
    await closeRedis();
    logger.info('Gateway shut down gracefully');
    process.exit(0);
  });
});

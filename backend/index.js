require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('./src/middleware/sanitize');
const morgan = require('morgan');
const connectDB = require('./src/config/db');
const logger = require('./src/config/logger');
const errorHandler = require('./src/middleware/errorHandler');
const { globalLimiter } = require('./src/middleware/rateLimiter');
const { connectRedis, closeRedis } = require('./src/config/redis');

const app = express();

connectDB();
connectRedis();

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(mongoSanitize);
app.use(globalLimiter);
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Bring Basket API running' });
});

app.get('/health', (req, res) => {
  const dbState = require('mongoose').connection.readyState;
  const ok = dbState === 1;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    db: ok ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1', require('./src/routes/v1'));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  server.close(async () => {
    await require('mongoose').connection.close();
    await closeRedis();
    console.log('Server shut down gracefully');
    process.exit(0);
  });
});

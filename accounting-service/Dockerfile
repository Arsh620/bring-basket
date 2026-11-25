FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY backend/src/config/logger.js ./src/config/logger.js
COPY backend/src/config/redis.js ./src/config/redis.js
COPY backend/src/domains/identity/wallet.controller.js ./src/domains/identity/wallet.controller.js
COPY backend/src/domains/identity/loyalty.controller.js ./src/domains/identity/loyalty.controller.js
COPY backend/src/domains/identity/customers.controller.js ./src/domains/identity/customers.controller.js
COPY backend/src/domains/orders/order.model.js ./src/domains/orders/order.model.js
COPY backend/src/domains/store/cashback.controller.js ./src/domains/store/cashback.controller.js
COPY backend/src/domains/store/wallet-bonus.controller.js ./src/domains/store/wallet-bonus.controller.js
COPY backend/src/middleware/auth.js ./src/middleware/auth.js
COPY backend/src/middleware/errorHandler.js ./src/middleware/errorHandler.js
COPY backend/src/middleware/roleCheck.js ./src/middleware/roleCheck.js
COPY backend/src/middleware/rateLimiter.js ./src/middleware/rateLimiter.js
COPY backend/src/middleware/sanitize.js ./src/middleware/sanitize.js
COPY backend/src/models/auth/Admin.js ./src/models/auth/Admin.js
COPY backend/src/models/auth/AdminRole.js ./src/models/auth/AdminRole.js
COPY backend/src/models/auth/User.js ./src/models/auth/User.js
COPY backend/src/models/auth/WalletTransaction.js ./src/models/auth/WalletTransaction.js
COPY backend/src/models/auth/LoyaltyTransaction.js ./src/models/auth/LoyaltyTransaction.js
COPY backend/src/models/auth/Notification.js ./src/models/auth/Notification.js
COPY backend/src/models/store/Cashback.js ./src/models/store/Cashback.js
COPY backend/src/models/store/CashbackHistory.js ./src/models/store/CashbackHistory.js
COPY backend/src/models/store/WalletBonus.js ./src/models/store/WalletBonus.js
COPY backend/src/utils ./src/utils
COPY accounting-service/index.js ./index.js

RUN mkdir -p logs && chown -R appuser:appgroup /app
USER appuser

EXPOSE 5007

CMD ["node", "index.js"]

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
COPY backend/src/domains/store/razorpay.controller.js ./src/domains/store/razorpay.controller.js
COPY backend/src/domains/orders/order.model.js ./src/domains/orders/order.model.js
COPY backend/src/domains/orders/order-data.js ./src/domains/orders/order-data.js
COPY backend/src/domains/orders/checkout-benefits.service.js ./src/domains/orders/checkout-benefits.service.js
COPY backend/src/models/store/CashbackModels.js ./src/models/store/CashbackModels.js
COPY backend/src/models/store/WalletBonus.js ./src/models/store/WalletBonus.js
COPY backend/src/models/auth/LoyaltyTransaction.js ./src/models/auth/LoyaltyTransaction.js
COPY backend/src/utils/AppError.js ./src/utils/AppError.js
COPY backend/src/middleware/auth.js ./src/middleware/auth.js
COPY backend/src/middleware/errorHandler.js ./src/middleware/errorHandler.js
COPY backend/src/middleware/roleCheck.js ./src/middleware/roleCheck.js
COPY backend/src/middleware/sanitize.js ./src/middleware/sanitize.js
COPY backend/src/models/auth/Admin.js ./src/models/auth/Admin.js
COPY backend/src/models/auth/AdminRole.js ./src/models/auth/AdminRole.js
COPY backend/src/models/auth/User.js ./src/models/auth/User.js
COPY backend/src/models/auth/WalletTransaction.js ./src/models/auth/WalletTransaction.js
COPY backend/src/models/store/Payment.js ./src/models/store/Payment.js
COPY backend/src/routes/v1/payment ./src/routes/v1/payment
COPY backend/src/utils ./src/utils
COPY payment-service/index.js ./index.js

RUN mkdir -p logs && chown appuser:appgroup logs
USER appuser

EXPOSE 5010

CMD ["node", "index.js"]

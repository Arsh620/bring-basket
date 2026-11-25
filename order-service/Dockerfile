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
COPY backend/src/domains/orders ./src/domains/orders
COPY backend/src/services ./src/services
COPY backend/src/middleware/auth.js ./src/middleware/auth.js
COPY backend/src/middleware/identity-admin-auth.js ./src/middleware/identity-admin-auth.js
COPY backend/src/middleware/errorHandler.js ./src/middleware/errorHandler.js
COPY backend/src/middleware/sanitize.js ./src/middleware/sanitize.js
COPY backend/src/middleware/service-auth.js ./src/middleware/service-auth.js
COPY backend/src/models/auth/Admin.js ./src/models/auth/Admin.js
COPY backend/src/models/auth/AdminRole.js ./src/models/auth/AdminRole.js
COPY backend/src/models/auth/User.js ./src/models/auth/User.js
COPY backend/src/models/auth/WalletTransaction.js ./src/models/auth/WalletTransaction.js
COPY backend/src/models/auth/LoyaltyTransaction.js ./src/models/auth/LoyaltyTransaction.js
COPY backend/src/models/auth/DeliveryMan.js ./src/models/auth/DeliveryMan.js
COPY backend/src/models/auth/DMWalletTransaction.js ./src/models/auth/DMWalletTransaction.js
COPY backend/src/models/auth/DMReview.js ./src/models/auth/DMReview.js
COPY backend/src/models/store ./src/models/store
COPY backend/src/models/catalog/Item.js ./src/models/catalog/Item.js
COPY backend/src/routes/v1/orders ./src/routes/v1/orders
COPY backend/src/utils ./src/utils
COPY order-service/index.js ./index.js

RUN mkdir -p logs && chown -R appuser:appgroup logs
USER appuser

EXPOSE 5006

CMD ["node", "index.js"]

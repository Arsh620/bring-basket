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
COPY backend/src/domains/store ./src/domains/store
COPY backend/src/middleware/auth.js ./src/middleware/auth.js
COPY backend/src/middleware/errorHandler.js ./src/middleware/errorHandler.js
COPY backend/src/middleware/roleCheck.js ./src/middleware/roleCheck.js
COPY backend/src/middleware/sanitize.js ./src/middleware/sanitize.js
COPY backend/src/middleware/service-auth.js ./src/middleware/service-auth.js
COPY backend/src/models/auth/Admin.js ./src/models/auth/Admin.js
COPY backend/src/models/auth/AdminRole.js ./src/models/auth/AdminRole.js
COPY backend/src/models/auth/Vendor.js ./src/models/auth/Vendor.js
COPY backend/src/models/catalog/Item.js ./src/models/catalog/Item.js
COPY backend/src/models/store ./src/models/store
COPY backend/src/routes/v1/store ./src/routes/v1/store
COPY backend/src/utils ./src/utils
COPY store-service/index.js ./index.js

RUN mkdir -p logs && chown -R appuser:appgroup logs
USER appuser

EXPOSE 5003

CMD ["node", "index.js"]

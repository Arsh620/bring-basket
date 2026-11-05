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
COPY backend/src/domains/catalog ./src/domains/catalog
COPY backend/src/domains/inventory/store-item-stock.model.js ./src/domains/inventory/store-item-stock.model.js
COPY backend/src/domains/inventory/store-stock.service.js ./src/domains/inventory/store-stock.service.js
COPY backend/src/middleware/auth.js ./src/middleware/auth.js
COPY backend/src/middleware/errorHandler.js ./src/middleware/errorHandler.js
COPY backend/src/middleware/roleCheck.js ./src/middleware/roleCheck.js
COPY backend/src/middleware/sanitize.js ./src/middleware/sanitize.js
COPY backend/src/models/catalog ./src/models/catalog
COPY backend/src/models/store/Store.js ./src/models/store/Store.js
COPY backend/src/routes/v1/catalog ./src/routes/v1/catalog
COPY backend/src/utils ./src/utils
COPY catalog-service/index.js ./index.js

RUN mkdir -p logs && chown -R appuser:appgroup /app
USER appuser

EXPOSE 5002

CMD ["node", "index.js"]

FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup backend/src ./src
COPY --chown=appuser:appgroup identity-service/index.js ./index.js

RUN mkdir -p logs && chown appuser:appgroup logs
USER appuser

EXPOSE 5001

CMD ["node", "index.js"]

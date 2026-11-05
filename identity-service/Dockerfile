FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY backend/src ./src
COPY identity-service/index.js ./index.js

RUN mkdir -p logs && chown -R appuser:appgroup /app
USER appuser

EXPOSE 5001

CMD ["node", "index.js"]

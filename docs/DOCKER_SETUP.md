# Docker Setup and Development Operations

## Services

Run commands from the repository root (`D:\bring-basket-fb` on this workstation). Compose currently defines MongoDB replica set, Redis, backend compatibility API, Identity, Catalog, Store, Inventory, Procurement, Order, Accounting, Notification, Payment, Gateway and Next.js frontend. Browser URLs are `http://localhost:3001` (frontend) and `http://localhost:3000` (gateway API); internal service ports are exposed only to the Compose network except configured host ports.

## First startup

1. Install Docker Desktop and ensure its engine is running.
2. Create local `.env` from the safe example if available. Set unique development secrets for JWT and any integrations. Never paste or commit real credentials.
3. Build/start services: `docker compose up --build -d`.
4. Inspect readiness: `docker compose ps` and `docker compose logs --tail=100 gateway identity frontend`.
5. Open `http://localhost:3001/admin/login`; use only credentials provisioned in the local development database. Do not assume a seeded password unless the seed script and current data confirm it.

The current target is Express/Node.js rather than NestJS. The Compose application set includes the frontend, gateway, backend compatibility service, nine domain services, MongoDB and Redis. The frontend production image and supplier registration route were verified on 18 November 2026; rebuild the frontend after source changes so the running container does not serve a stale image.

## Common operations

```powershell
docker compose ps
docker compose logs --tail=150 identity gateway frontend
docker compose up --build -d identity gateway frontend
docker compose up --build -d order backend gateway
docker compose down
```

`docker compose down` stops containers but retains named volumes. `docker compose down -v` deletes persisted MongoDB/Redis/application volume data and must not be used as a routine reset.

## Health and dependency notes

MongoDB is configured as replica set `rs0`; application Mongo URLs include `replicaSet=rs0`. Redis health uses `PING`. Services expose `/health` checks and Compose waits for dependencies marked `service_healthy`. If a service stays unhealthy, inspect its logs and dependency health first; a successful image build alone does not mean the endpoint is reachable.

Frontend calls the gateway via the build-time `NEXT_PUBLIC_API_URL` (`http://localhost:3000/api/v1`). Browser-visible URLs must use host ports; service-to-service URLs use Compose names such as `http://identity:5001`.

## Troubleshooting

- Login throttled: wait for the configured window or restart identity/gateway only in local development; restarting does not fix wrong credentials or role grants.
- Invalid credentials: verify the local account exists, is active, password hash matches the intended seed flow, and role resolves to an active AdminRole. Never log password values.
- Frontend label/build appears stale: rebuild frontend image and hard-refresh the browser (Ctrl+Shift+R).
- Gateway returns 502/503: inspect gateway plus target service health and Compose DNS/service URL configuration.
- Order analytics unavailable: check gateway, backend auth, order health, internal auth configuration, and order DB name (`bring_basket_order`).
- Mongo replica-set connection failures: verify `bb_mongo` is healthy and `rs0` initialization completed; do not remove volumes to troubleshoot.

## Environment safety

Keep `.env` local and out of Git. Provide only variable names—not their values—in bug reports. Rotate a secret if it was committed or exposed. Production secrets belong in a secret manager, not the Compose file or Docker image layers.

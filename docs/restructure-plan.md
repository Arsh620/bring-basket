# Backend Restructure

**Status:** ✅ Complete

## Structure decision

Keep one Express REST API for now. Group code by business domain under `src/domains/`; do not create separately deployed services yet.

Keep files flat inside each domain:

```text
domains/catalog/
  categories.routes.js
  categories.controller.js
  categories.service.js
  brands.routes.js
  brands.controller.js
  brands.service.js
  items.routes.js
  items.controller.js
  items.service.js
  units.routes.js
  units.controller.js
  units.service.js
  unit-groups.routes.js
  unit-groups.controller.js
  unit-groups.service.js
  item-batches.routes.js
  item-batches.controller.js
  item-batches.service.js
```

Generic configuration, authentication middleware and helpers stay under `src/`. MongoDB/Mongoose remains the database.

## Migration order

1. Catalog — API handlers migrated ✅
2. Store — store, module and zone APIs migrated ✅
3. Inventory — route/controller files migrated ✅
4. Identity — API routes/controllers migrated ✅
5. Procurement — pending

Move one domain at a time, preserve existing `/api/v1` paths. No broad rewrite or API behavior change as part of a folder move.

## Microservice extraction later

Extract a domain only when it needs independent deployment, scaling or ownership. Give the extracted service its own startup/configuration and MongoDB database. Keep shared code limited to generic helpers and API contracts; do not share domain models.

Before extraction, finish the model ownership decisions recorded in [backend-architecture.md](./backend-architecture.md#data-ownership-audit), especially the `StoreItemStock` cutover, warehouse login credentials, and the difference between `Vendor` and `PurchaseVendor`.

## Current progress

### ✅ Completed

- All domains migrated to `src/domains/` — identity, catalog, inventory, store
- `routes/v1/index.js` fully updated to point to `domains/`
- Dead folders deleted — `controllers/`, `routes/v1/admin/`, `routes/v1/customer/`, `routes/v1/vendor/`, `routes/v1/supplier/`, `routes/v1/deliveryman/`, `routes/v1/warehouse/`, `services/`, `modules/`
- `warehouses.controller.js` refactored — service layer added (`warehouses.service.js`)
- `warehouse-stock.controller.js` refactored — service layer added (`warehouse-stock.service.js`)
- All domains now follow consistent `routes → controller → service → model` pattern

### Current `src/domains/` structure

```text
domains/
├── identity/       admin-auth, admins, roles, customer-auth, vendor-auth,
│                   supplier-auth, deliveryman-auth, warehouse-auth
├── catalog/        brands, categories, items, units, unit-groups, item-batches
├── inventory/      warehouses, warehouse-stock, stock-movements, stock-transfers,
│                   store-stock-requests, batch-write-offs,
│                   store-item-stock.model.js, store-stock.service.js,
│                   warehouse-stock.service.js, warehouses.service.js
└── store/          modules, zones, stores
```

### Remaining

- MongoDB models remain under `src/models/` — shared for now, move per-service on extraction
- `StoreItemStock` cutover — `npm run db:migrate-store-stock` previews missing records; add `-- --apply` to insert. No production migration run yet.
- Procurement domain (`purchase/`) — not yet migrated, models exist in `src/models/purchase/`

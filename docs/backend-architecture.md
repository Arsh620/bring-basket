# Backend Structure

## Abhi ka structure

Ek Express REST API aur MongoDB/Mongoose. Abhi independent microservices ya API gateway nahi hain.

## Target structure

```text
backend/
  index.js                 # starts the one Express API
  src/
    config/                 # environment and MongoDB connection
    middleware/             # auth and error handling
    routes/v1/              # API entry point and old-path adapters
    domains/
      identity/             # auth, admin and portal APIs
      catalog/              # categories, items, brands, batches
      store/                # stores, modules and zones
        stores.routes.js
        stores.controller.js
        stores.service.js
        modules.routes.js
        modules.controller.js
        zones.routes.js
        zones.controller.js
      inventory/            # warehouse and stock APIs
      procurement/          # vendors, orders and bills
    models/                 # existing Mongoose models, grouped by domain
    utils/                  # generic helpers only
  scripts/
  test/
```

As features move, keep files flat inside their domain:

```text
domains/catalog/
  brands.routes.js
  brands.controller.js
  brands.service.js
  items.routes.js
  items.controller.js
  items.service.js
  categories.routes.js
  categories.controller.js
  categories.service.js
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

## Seedhe rules

- `*.routes.js` endpoints define kare; `*.controller.js` HTTP request/response handle kare; `*.service.js` domain logic rakhe.
- Domain folders ek hi backend process aur ek hi MongoDB connection me chalenge. Abhi network calls, message broker, API gateway, ya har endpoint ke liye alag folders nahi.
- Ek domain doosre domain ke model ko directly import na kare. Cross-domain kaam ke liye us domain ke service function ko call kare.
- Existing `/api/v1/...` URLs ko migration ke dauran same rakhein.
- Koi domain independently deploy karne layak ho aur uski ownership clear ho, tab us domain folder ko alag service me nikalein. Us service ka apna startup, configuration aur MongoDB database hoga.

## Current migration

Yeh target structure hai, poora backend abhi migrate nahi hua. `routes/v1/index.js`, `controllers/` aur `models/` me existing code ko ek domain at a time move karna hai; old paths tab tak adapters rahenge jab tak imports migrate aur tests pass na hon.

| Domain | Current source |
|---|---|
| Identity | API routes/controllers are under `domains/identity/`; model definitions remain in `models/auth/` and related legacy model folders |
| Catalog | API handlers/services are under `domains/catalog/`; Mongoose models remain under `models/catalog/` |
| Store | API routes/controllers are under `domains/store/`; Mongoose models remain under `models/store/` |
| Inventory | API routes/controllers are under `domains/inventory/`; Mongoose models remain under `models/warehouse/` and some catalog models are still referenced |
| Procurement | `models/purchase/`; API workflows are not complete yet |

MongoDB/Mongoose is the application database. `mysql2` is currently used by the one-time MySQL import script, not by API request handling.

## Data ownership audit

This is a code/schema audit, not a production-data or deployment audit. The
current app has one MongoDB connection (`config/db.js`), and the domain folders
are not independently runnable services.

| Proposed owner | Current models | Cross-domain coupling found |
|---|---|---|
| Identity | API handlers in `domains/identity/`; models in `models/auth/`: Admin, AdminRole, User, Vendor, VendorEmployee, DeliveryMan | Warehouse login still authenticates against `models/warehouse/Warehouse`; supplier login uses `models/purchase/PurchaseVendor`. Decide ownership and credential boundaries before extraction. |
| Catalog | `models/catalog/`: Brand, Category, Item, ItemBatch, Unit, UnitGroup, UnitGroupConversion, Allergy, Nutrition, Tag | `Item` contains a `storeId`, `moduleId`, and a legacy `stock` field. Catalog API responses preserve `stock` as a compatibility field, while writes and current stock reads use Inventory's `StoreItemStock`. |
| Store | `models/store/`: Store, Module, Zone | Store references Vendor identity, Module and Zone. Catalog Item and procurement documents also reference Store/Module. |
| Inventory | `models/warehouse/`: Warehouse, WarehouseItemStock, WarehouseStockMovement, WarehouseStockTransfer, StoreStockRequest; `domains/inventory/store-item-stock.model.js` | Inventory owns store-level `StoreItemStock` records and stock mutations. Inventory workflows use the Catalog item service to resolve item/store context; this integration needs an API contract before extraction. `BatchWriteOff` is physically under catalog today, but its behavior changes inventory stock. |
| Procurement | `models/purchase/`: PurchaseVendor, PurchaseOrder, PurchaseBill, PurchasePayment, PurchaseReturn | Purchase models reference Warehouse, Store, Catalog Item/UnitGroup, and other procurement documents. These models do not yet have API workflows in the current Node backend. `PurchaseVendor` is separate from the login `Vendor` identity model. |

### Direct code dependencies

- Inventory → Catalog: inventory workflows call the Catalog item service to
  resolve item/store context, and batch write-offs still use the
  `BatchWriteOff` model stored under catalog. Catalog Item list/detail APIs call
  the Inventory stock service for the legacy-compatible `stock` response field.
- Store → Identity: Store references Vendor. Warehouse portal authentication
  reads a Warehouse record.
- Procurement → Store, Inventory and Catalog: purchase documents carry
  `storeId`, `warehouseId`, `itemId`, and `unitGroupId` references.
- Catalog → Store: Item references Store and Module. This is a schema
  relationship; not every reference is also a direct controller import.

### Extraction blockers and order

1. `StoreItemStock` is the store-level source of truth. `Item.stock` remains a
   temporary legacy field for fallback/migration compatibility; stop writing it
   through API workflows and do not remove it until historical migration and
   client compatibility are verified.
2. Keep PurchaseVendor distinct from Vendor identity until the business rules
   for portal login, approval, and purchasing contacts are reconciled.
3. Decide whether Warehouse is an operational location, a login identity, or
   both; split those responsibilities before Identity or Inventory extraction.
4. For cross-service reads, replace Mongoose `populate`/direct model imports
   with stable IDs and owner APIs/events. Plan migration and reconciliation
   before changing collection ownership.
5. Do not start a microservice extraction yet. First make these ownership
   decisions and cover the affected stock and purchasing workflows with
   integration tests.

The legacy stock copy is a manual operation. From `backend/`, run
`npm run db:migrate-store-stock` for a read-only dry-run report or
`npm run db:migrate-store-stock -- --apply` to insert missing records. The
dry run reads MongoDB collections directly and does not initialize Mongoose
models or indexes. The apply operation creates the Inventory model/indexes and
never overwrites an existing `StoreItemStock` record. Do not run it against
production until the deployment/cutover window is approved.

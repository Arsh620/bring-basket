# Inventory API and MongoDB Design

This design is based on the supplied Laravel/MySQL schema. The MySQL dump is a
schema reference only; this design does not migrate its records.

## Conventions

- Base path: `/api/v1`
- JSON responses use `{ "success": true, "data": ... }`; errors use the
  existing error-handler response shape.
- MongoDB `_id` values are used for relationships. Legacy MySQL numeric IDs
  must be mapped during data migration rather than copied into ObjectId fields.
- Root categories (`parent_id = 0` in the source) map to `parentId: null`.
- Laravel timestamps map to Mongoose `createdAt` and `updatedAt`.
- Do not persist warehouse passwords in clear text. Store only a password hash;
  `remember_token` is a Laravel session concern and is not carried over.

---

## Implementation Status

### ✅ Done

| Area | What's implemented |
|---|---|
| Admin auth | login, register, me, logout |
| Admin Roles | Full CRUD |
| Admin Management | Full CRUD + status toggle |
| Customer auth | login, register, me |
| Vendor auth | login, me, logout |
| Supplier auth | login, me, logout |
| Warehouse portal auth | login, me, logout |
| Delivery Man auth | login, me, logout |
| Categories | Full CRUD + status toggle + filters (`moduleId`, `parentId`, `status`) |
| Brands | Full CRUD + status toggle |
| Units | Full CRUD |
| Items | Full CRUD + status toggle + stock patch + low-stock query |
| Warehouses | Full CRUD + status toggle + filters (`type`, `parentId`, `status`, `state`) |
| Modules | Full CRUD + status toggle + filters (`moduleType`, `status`) |
| Zones | Full CRUD + status toggle + filters (`status`, `state`) |
| Stores | Full CRUD + status toggle + schedule get/update + filters (`moduleId`, `zoneId`, `vendorId`, `status`, `featured`, `search`) |

### ⏳ Remaining (by priority)

> Note: this status reflects the migration-era backlog. Some warehouse operations are already implemented in the live backend even if the design doc was not updated.

| Phase | Area | Backend | Frontend |
|---|---|---|---|
| 1 | Unit Groups + Conversions | ❌ | ❌ |
| 1 | Item Batches | ❌ | ❌ |
| 2 | Warehouse Stock (balances, adjustments) | ❌ | ❌ |
| 2 | Stock Movements | ❌ | ❌ |
| 2 | Stock Transfers (warehouse ↔ warehouse) | ❌ | ❌ |
| 2 | Batch Write-offs | ❌ | ❌ |
| 3 | Purchase Vendors | ❌ | ❌ |
| 3 | Purchase Orders | ❌ | ❌ |
| 3 | Purchase Bills / GRN | ❌ | ❌ |
| 3 | Purchase Returns & Payments | ❌ | ❌ |
| 4 | Vendor Employee auth + CRUD | ❌ | ❌ |
| 4 | Delivery Man CRUD | ❌ | ❌ |
| 5 | Frontend — Stores & Modules pages | ✅ Backend | ❌ |
| 5 | Frontend — Zones pages | ✅ Backend | ❌ |
| 6 | Orders | ❌ | ❌ |
| 6 | Carts, Coupons, Reviews | ❌ | ❌ |
| 7 | Accounting / Wallet / Disbursements | ❌ | ❌ |
| 8 | Notifications, Settings, Misc | ❌ | ❌ |

### ✅ Implemented in backend beyond the original backlog

The following module is already live in the codebase and should be treated as canonical even though it was originally marked backlog-only in earlier docs:

- Store stock request workflow
  - `GET /admin/store-stock-requests`
  - `POST /admin/store-stock-requests`
  - `GET /admin/store-stock-requests/:id`
  - `PATCH /admin/store-stock-requests/:id/approve`
  - `PATCH /admin/store-stock-requests/:id/dispatch`
  - `PATCH /admin/store-stock-requests/:id/receive`
  - `PATCH /admin/store-stock-requests/:id/reject`

---

## Collection mapping

| MySQL source | MongoDB collection | Modeling decision |
|---|---|---|
| `categories` | `categories` | Keep separate; `parentId` self-reference; index by module, parent and priority. |
| `brands` | `brands` | Separate catalog collection. |
| `units` | `units` | Separate catalog collection. |
| `unit_groups` | `unitgroups` | Separate unit-group collection. |
| `unit_group_conversions` | `unitgroupconversions` | Separate collection to preserve the source table and its legacy IDs. |
| `items` | `items` | Preserve catalog, pricing, flags and store/module references. |
| `item_batches` | `itembatches` | Keep separate because batches are queried by item, store and expiry. |
| `modules` | `modules` | Grocery, Pharmacy, Food, etc. |
| `stores` | `stores` | Store/branch master; schedule + config embedded. |
| `zones` | `zones` | Delivery zones with coordinates. |
| `warehouses` | `warehouses` | Separate collection; self-reference sub-warehouse `parentId`. |
| `warehouse_item_stocks` | `warehouseitemstocks` | Separate balance per warehouse, item and variant; compound unique index. |
| `warehouse_stock_movements` | `warehousestockmovements` | Append-only audit collection, indexed by warehouse/item and time. |
| `warehouse_stock_transfers` | `warehousestocktransfers` | Warehouse transfer header collection. |
| `warehouse_stock_transfer_items` | `warehousestocktransferitems` | Separate transfer-line collection. |
| `store_stock_requests` | `storestockrequests` | Store replenishment header collection. |
| `store_stock_request_items` | `storestockrequestitems` | Separate request-line collection. |
| `warehouse_item_batches` | `warehouseitembatches` | Warehouse batch inventory. |
| `warehouse_pincodes` | `warehousepincodes` | Warehouse service postal codes. |
| `batch_write_offs` | `batchwriteoffs` | Separate audit records for written-off store batches. |

All other non-internal, non-backup tables in the supplied SQL schema have
table-specific Mongoose models in `GeneratedBusinessModels.js`.

The existing `items.stock` field represents the store-level quantity in the
source schema. Warehouse balances are separate and must be changed through
`warehouse_item_stocks`; warehouse adjustments must not silently overwrite
`items.stock`.

---

## Routes

### Auth

| Method | Path | Status |
|---|---|---|
| POST | `/admin/auth/login` | ✅ |
| POST | `/admin/auth/register` | ✅ |
| GET | `/admin/auth/me` | ✅ |
| POST | `/admin/auth/logout` | ✅ |
| GET | `/admin/roles` | ✅ |
| POST | `/admin/roles` | ✅ |
| GET | `/admin/roles/:id` | ✅ |
| PUT | `/admin/roles/:id` | ✅ |
| DELETE | `/admin/roles/:id` | ✅ |
| GET | `/admin/admins` | ✅ |
| POST | `/admin/admins` | ✅ |
| GET | `/admin/admins/:id` | ✅ |
| PUT | `/admin/admins/:id` | ✅ |
| PATCH | `/admin/admins/:id/status` | ✅ |
| DELETE | `/admin/admins/:id` | ✅ |
| POST | `/customer/auth/login` | ✅ |
| POST | `/customer/auth/register` | ✅ |
| GET | `/customer/auth/me` | ✅ |
| POST | `/vendor/auth/login` | ✅ |
| GET | `/vendor/auth/me` | ✅ |
| POST | `/vendor/auth/logout` | ✅ |
| POST | `/supplier/auth/login` | ✅ |
| GET | `/supplier/auth/me` | ✅ |
| POST | `/supplier/auth/logout` | ✅ |
| POST | `/warehouse/auth/login` | ✅ |
| GET | `/warehouse/auth/me` | ✅ |
| POST | `/warehouse/auth/logout` | ✅ |
| POST | `/deliveryman/auth/login` | ✅ |
| GET | `/deliveryman/auth/me` | ✅ |
| POST | `/deliveryman/auth/logout` | ✅ |

### Catalog

| Method | Path | Status |
|---|---|---|
| GET | `/admin/categories?moduleId=&parentId=&status=` | ✅ |
| POST | `/admin/categories` | ✅ |
| GET | `/admin/categories/:id` | ✅ |
| PUT | `/admin/categories/:id` | ✅ |
| PATCH | `/admin/categories/:id/status` | ✅ |
| DELETE | `/admin/categories/:id` | ✅ |
| GET | `/admin/brands` | ✅ |
| POST | `/admin/brands` | ✅ |
| PUT | `/admin/brands/:id` | ✅ |
| PATCH | `/admin/brands/:id/status` | ✅ |
| DELETE | `/admin/brands/:id` | ✅ |
| GET | `/admin/units` | ✅ |
| POST | `/admin/units` | ✅ |
| GET | `/admin/units/:id` | ✅ |
| PUT | `/admin/units/:id` | ✅ |
| DELETE | `/admin/units/:id` | ✅ |
| GET | `/admin/unit-groups` | ❌ |
| POST | `/admin/unit-groups` | ❌ |
| GET | `/admin/unit-groups/:id` | ❌ |
| PUT | `/admin/unit-groups/:id` | ❌ |
| PATCH | `/admin/unit-groups/:id/status` | ❌ |
| DELETE | `/admin/unit-groups/:id` | ❌ |
| GET | `/admin/items?storeId=&categoryId=&moduleId=&status=&search=&page=&limit=` | ✅ |
| POST | `/admin/items` | ✅ |
| GET | `/admin/items/:id` | ✅ |
| PUT | `/admin/items/:id` | ✅ |
| DELETE | `/admin/items/:id` | ✅ |
| PATCH | `/admin/items/:id/status` | ✅ |
| PATCH | `/admin/items/:id/stock` | ✅ |
| GET | `/admin/items/low-stock?storeId=&threshold=` | ✅ |
| GET | `/admin/item-batches?itemId=&storeId=` | ❌ |
| POST | `/admin/item-batches` | ❌ |
| PUT | `/admin/item-batches/:id` | ❌ |
| DELETE | `/admin/item-batches/:id` | ❌ |

### Stores & Modules

| Method | Path | Status |
|---|---|---|
| GET | `/admin/modules?moduleType=&status=` | ✅ |
| POST | `/admin/modules` | ✅ |
| GET | `/admin/modules/:id` | ✅ |
| PUT | `/admin/modules/:id` | ✅ |
| PATCH | `/admin/modules/:id/status` | ✅ |
| DELETE | `/admin/modules/:id` | ✅ |
| GET | `/admin/zones?status=&state=` | ✅ |
| POST | `/admin/zones` | ✅ |
| GET | `/admin/zones/:id` | ✅ |
| PUT | `/admin/zones/:id` | ✅ |
| PATCH | `/admin/zones/:id/status` | ✅ |
| DELETE | `/admin/zones/:id` | ✅ |
| GET | `/admin/stores?moduleId=&zoneId=&vendorId=&status=&featured=&search=` | ✅ |
| POST | `/admin/stores` | ✅ |
| GET | `/admin/stores/:id` | ✅ |
| PUT | `/admin/stores/:id` | ✅ |
| PATCH | `/admin/stores/:id/status` | ✅ |
| DELETE | `/admin/stores/:id` | ✅ |
| GET | `/admin/stores/:id/schedule` | ✅ |
| PUT | `/admin/stores/:id/schedule` | ✅ |

### Warehouse and Stock

| Method | Path | Status |
|---|---|---|
| GET | `/admin/warehouses?type=&parentId=&status=&state=` | ✅ |
| POST | `/admin/warehouses` | ✅ |
| GET | `/admin/warehouses/:id` | ✅ |
| PUT | `/admin/warehouses/:id` | ✅ |
| PATCH | `/admin/warehouses/:id/status` | ✅ |
| DELETE | `/admin/warehouses/:id` | ✅ |
| GET | `/admin/warehouses/:id/stock?itemId=&status=&page=&limit=` | ❌ |
| PUT | `/admin/warehouses/:id/stock/:itemId` | ❌ |
| PATCH | `/admin/warehouses/:id/stock/:itemId/adjust` | ❌ |
| GET | `/admin/stock-movements?warehouseId=&itemId=&type=&from=&to=&page=&limit=` | ❌ |
| GET | `/admin/stock-transfers?status=&motherWarehouseId=&subWarehouseId=` | ❌ |
| POST | `/admin/stock-transfers` | ❌ |
| GET | `/admin/stock-transfers/:id` | ❌ |
| PATCH | `/admin/stock-transfers/:id/dispatch` | ❌ |
| PATCH | `/admin/stock-transfers/:id/receive` | ❌ |
| PATCH | `/admin/stock-transfers/:id/reject` | ❌ |
| GET | `/admin/store-stock-requests?storeId=&status=` | ✅ |
| POST | `/admin/store-stock-requests` | ✅ |
| GET | `/admin/store-stock-requests/:id` | ✅ |
| PATCH | `/admin/store-stock-requests/:id/approve` | ✅ |
| PATCH | `/admin/store-stock-requests/:id/dispatch` | ✅ |
| PATCH | `/admin/store-stock-requests/:id/receive` | ✅ |
| PATCH | `/admin/store-stock-requests/:id/reject` | ✅ |
| GET | `/admin/batch-write-offs?itemId=&storeId=` | ❌ |
| POST | `/admin/batch-write-offs` | ❌ |

---

## Stock workflow invariants

1. Each warehouse balance is uniquely identified by `(warehouseId, itemId, variant)`.
2. A stock adjustment changes one balance and adds one movement record with `qtyChange` and the resulting `balanceAfter`.
3. Transfer dispatch subtracts sent quantity from the mother warehouse; receipt adds the actually received quantity to the sub-warehouse. Each balance change creates a movement linked to the transfer.
4. Store-request dispatch subtracts sent quantity from the source warehouse; receiving updates the store's item/batch stock and stores received quantities and GRN data on the request.
5. A failed balance update must not leave a movement record or partial transfer. Use a MongoDB transaction for stock-changing operations and run MongoDB as a replica set (including single-node development) before enabling them.
6. Reject negative quantities, invalid item/warehouse IDs, duplicate item lines, invalid status transitions and sent/received quantities greater than requested quantities.

---

## Full schema status

The supplied DDL contains 177 tables. Seventeen Laravel internal and backup
tables are excluded; the remaining 160 business tables are represented by
Mongoose models. Source numeric primary keys are preserved as `legacyId`,
declared foreign keys become ObjectId references, and SQL indexes are
represented in the model definitions.

To create the collections and indexes defined by all current Mongoose models
in the configured MongoDB database, run `npm run db:migrate` from `backend`.
This prepares the schema structure only; it does not import Laravel/MySQL
records. The operation is additive and does not drop existing collections or
indexes.

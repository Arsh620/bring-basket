# Schema Audit Report

**Date:** 2025
**Purpose:** Compare hand-written Mongoose models vs GeneratedBusinessModels.js (MySQL source of truth)
**Status:** Pre-API, Pre-Microservices

---

## Summary

| Model | Status | Issues |
|---|---|---|
| Item | ⚠️ Discrepancies | name required mismatch, price/stock type mismatch, taxType enum mismatch |
| Category | ⚠️ Discrepancies | parentId type mismatch |
| Brand | ✅ OK | — |
| Unit | ✅ OK | — |
| UnitGroup | ✅ OK | — |
| UnitGroupConversion | ⚠️ Minor | factor type: Number vs Decimal128 |
| ItemBatch | ⚠️ Minor | qty type: Number vs Decimal128 |
| BatchWriteOff | ⚠️ Minor | qty type: Number vs Decimal128 |
| Warehouse | ⚠️ Discrepancies | parentId type, latitude/longitude type, serviceRadiusKm type |
| WarehouseItemStock | ⚠️ Minor | sellingPrice/mrp/qty type: Number vs Decimal128 |
| WarehouseStockMovement | ⚠️ Discrepancies | qtyChange/balanceAfter type, referenceId/actorId type |
| WarehouseStockTransfer | ✅ OK (embedded items — design choice) | — |
| StoreStockRequest | ✅ OK (embedded items — design choice) | — |
| Admin | ⚠️ Minor | status field missing in generated |
| AdminRole | ✅ OK | — |
| User | ⚠️ Minor | walletBalance/loyaltyPoint type: Number vs Decimal128 |
| Vendor | ✅ OK | — |
| VendorEmployee | ✅ OK | — |
| DeliveryMan | ✅ OK | — |
| Module | ✅ OK | — |
| Store | ⚠️ Minor | minimumOrder/tax/comission type: Number vs Decimal128 |
| Zone | ✅ OK | — |

---

## Detailed Discrepancies

### 1. Item (`models/catalog/Item.js`)

| Field | Hand-written | Generated (MySQL source) | Decision |
|---|---|---|---|
| `name` | `required: true` | `required: false` | **Keep required: true** — business logic requires it |
| `price` | `Number` | `Decimal128` | **Keep Number** — Decimal128 overkill for price, Number sufficient |
| `purchasePrice` | `Number` | `Decimal128` | **Keep Number** |
| `margin` | `Number` | `Decimal128` | **Keep Number** |
| `tax` | `Number` | `Decimal128` | **Keep Number** |
| `discount` | `Number` | `Decimal128` | **Keep Number** |
| `stock` | `Number` | `Decimal128` | **Keep Number** |
| `taxType` enum | `['percent', 'flat']` | `'percent'` default only | **Keep as is** — flat is valid |
| `discountType` enum | `['percent', 'flat']` | `'percent'` default only | **Keep as is** |
| `images` | `[String]` (array) | `String` (JSON string) | **Keep [String]** — MongoDB native array better |
| `categoryIds` | `[ObjectId]` (array) | `String` (JSON string) | **Keep [ObjectId]** — MongoDB native array better |
| `attributes` | `[ObjectId]` | `String` (JSON string) | **Keep [ObjectId]** |
| `addOns` | `[ObjectId]` | `String` (JSON string) | **Keep [ObjectId]** |
| `nutritions` | `[ObjectId]` — **EXTRA** | Not in generated | **Keep** — needed for catalog |
| `allergies` | `[ObjectId]` — **EXTRA** | Not in generated | **Keep** — needed for catalog |
| `tags` | `[ObjectId]` — **EXTRA** | Not in generated | **Keep** — needed for catalog |
| `genericNames` | `[ObjectId]` — **EXTRA** | Not in generated | **Keep** — needed for catalog |

**Action:** No changes needed. Hand-written model is better than generated.

---

### 2. Category (`models/catalog/Category.js`)

| Field | Hand-written | Generated | Decision |
|---|---|---|---|
| `parentId` | `ObjectId` ref Category | `Number` (legacy) | **Keep ObjectId** — correct for MongoDB |
| `image` | `default: 'def.png'` | `required: true, default: 'def.png'` | **Add required: false** — image should be optional |

**Action:** `image` ko `required: false` karo (already optional in hand-written, just confirm).

---

### 3. UnitGroupConversion (`models/catalog/UnitGroupConversion.js`)

| Field | Hand-written | Generated | Decision |
|---|---|---|---|
| `factor` | `Number` | `Decimal128` | **Keep Number** — conversion factor precision sufficient with Number |

**Action:** No change needed.

---

### 4. ItemBatch (`models/catalog/ItemBatch.js`)

| Field | Hand-written | Generated | Decision |
|---|---|---|---|
| `qty` | `Number` | `Decimal128` | **Keep Number** — batch qty as Number is fine |

**Action:** No change needed.

---

### 5. BatchWriteOff (`models/catalog/BatchWriteOff.js`)

| Field | Hand-written | Generated | Decision |
|---|---|---|---|
| `qty` | `Number` | `Decimal128` | **Keep Number** |
| `itemId` ref | `'Item'` | `'WarehouseStockTransferItem'` | **Keep 'Item'** — generated has wrong ref (MySQL join artifact) |

**Action:** No change needed.

---

### 6. Warehouse (`models/warehouse/Warehouse.js`)

| Field | Hand-written | Generated | Decision |
|---|---|---|---|
| `parentId` | `ObjectId` ref Warehouse | `Number` (legacy) | **Keep ObjectId** — correct for MongoDB |
| `latitude` | `Number` (min/max) | `Decimal128` | **Keep Number** — lat/lng as Number is standard |
| `longitude` | `Number` (min/max) | `Decimal128` | **Keep Number** |
| `serviceRadiusKm` | `Number` | `Decimal128` | **Keep Number** |
| `type` enum | `['mother', 'sub']` | no enum, default `'sub'` | **Keep enum** — stricter validation |

**Action:** No change needed.

---

### 7. WarehouseItemStock (`models/warehouse/WarehouseItemStock.js`)

| Field | Hand-written | Generated | Decision |
|---|---|---|---|
| `sellingPrice` | `Number` | `Decimal128` | **Keep Number** |
| `mrp` | `Number` | `Decimal128` | **Keep Number** |
| `qty` | `Number` | `Decimal128` | **Keep Number** |

**Action:** No change needed.

---

### 8. WarehouseStockMovement (`models/warehouse/WarehouseStockMovement.js`)

| Field | Hand-written | Generated | Decision |
|---|---|---|---|
| `qtyChange` | `Number` | `Decimal128` | **Keep Number** |
| `balanceAfter` | `Number` | `Decimal128` | **Keep Number** |
| `referenceId` | `ObjectId` | `Number` (polymorphic) | **Keep ObjectId** — we use ObjectId refs in MongoDB |
| `actorId` | `ObjectId` | `Number` (polymorphic) | **Keep ObjectId** |

**Action:** No change needed.

---

### 9. WarehouseStockTransfer — Design Decision

Generated schema has `warehouse_stock_transfer_items` as **separate collection**.
Hand-written model has `items` as **embedded array**.

| Approach | Pros | Cons |
|---|---|---|
| Separate collection (generated) | Better for large transfers, independent queries | Extra joins needed |
| Embedded array (hand-written) | Simpler, atomic updates, single document fetch | Document size limit (16MB) |

**Decision: Keep embedded array** — transfer items per transfer will never be large enough to hit 16MB limit. Simpler and faster.

---

### 10. StoreStockRequest — Same Design Decision

Same as above — keep embedded items array.

---

### 11. User (`models/auth/User.js`)

| Field | Hand-written | Generated | Decision |
|---|---|---|---|
| `walletBalance` | `Number` | `Decimal128` | **Keep Number** — sufficient precision |
| `loyaltyPoint` | `Number` | `Decimal128` | **Keep Number** |
| `addresses` | Embedded array | Separate `customer_addresses` collection | **Keep embedded** — addresses per user are few, embedding is better |

**Action:** No change needed.

---

### 12. Store (`models/store/Store.js`)

| Field | Hand-written | Generated | Decision |
|---|---|---|---|
| `minimumOrder` | `Number` | `Decimal128` | **Keep Number** |
| `tax` | `Number` | `Decimal128` | **Keep Number** |
| `comission` | `Number` | `Decimal128` | **Keep Number** |
| `schedule` | Embedded array | Separate `store_schedule` collection | **Keep embedded** — schedule is always fetched with store |
| `config` | Embedded object | Separate `store_configs` collection | **Keep embedded** — config always needed with store |
| `expiryMarkdownRules` | Embedded array | Separate `expiry_markdown_rules` collection | **Keep embedded** — rules are store-specific and few |

**Action:** No change needed.

---

## Global Decisions (Apply to all models)

| Decision | Reason |
|---|---|
| Use `Number` instead of `Decimal128` for prices/quantities | Decimal128 requires special handling in JS, Number is sufficient for this use case. If sub-paisa precision needed later, migrate then. |
| Use `ObjectId` instead of `Number` for all references | MongoDB native, no legacy ID mapping needed in new data |
| Embed small related data (schedule, config, items in transfer) | Simpler queries, atomic updates, no joins |
| Keep `[ObjectId]` arrays instead of JSON strings | MongoDB native, queryable, indexable |
| `name` required on Item | Business logic — item without name is invalid |

---

## Missing Models (Need to create for microservices)

These are in `GeneratedBusinessModels.js` but have NO hand-written model and will need proper models for their respective microservices:

| Collection | Microservice | Priority |
|---|---|---|
| `purchase_vendors` | purchase-service | HIGH |
| `purchase_orders` | purchase-service | HIGH |
| `purchase_bills` | purchase-service | HIGH |
| `purchase_order_items` | purchase-service | HIGH |
| `purchase_bill_items` | purchase-service | HIGH |
| `purchase_payments` | purchase-service | HIGH |
| `purchase_returns` | purchase-service | HIGH |
| `orders` | order-service | HIGH |
| `order_details` | order-service | HIGH |
| `carts` | order-service | MEDIUM |
| `coupons` | order-service | MEDIUM |
| `account_ledgers` | accounting-service | MEDIUM |
| `account_journal_entries` | accounting-service | MEDIUM |
| `expenses` | accounting-service | MEDIUM |
| `wallet_transactions` | accounting-service | MEDIUM |
| `disbursements` | accounting-service | MEDIUM |
| `business_settings` | settings-service | MEDIUM |
| `notifications` | notification-service | LOW |
| `banners` | cms-service | LOW |

---

## Microservices Architecture Plan

```
api-gateway (port 3000)
    │
    ├── auth-service (port 3001)
    │     Models: Admin, AdminRole, User, Vendor, VendorEmployee, DeliveryMan
    │
    ├── catalog-service (port 3002)
    │     Models: Item, Category, Brand, Unit, UnitGroup, UnitGroupConversion, ItemBatch, BatchWriteOff
    │
    ├── store-service (port 3003)
    │     Models: Module, Store, Zone
    │
    ├── inventory-service (port 3004)
    │     Models: Warehouse, WarehouseItemStock, WarehouseStockMovement,
    │             WarehouseStockTransfer, StoreStockRequest, WarehouseItemBatch, WarehousePincode
    │
    ├── purchase-service (port 3005)
    │     Models: PurchaseVendor, PurchaseOrder, PurchaseBill, PurchasePayment, PurchaseReturn
    │
    ├── order-service (port 3006)
    │     Models: Order, OrderDetail, Cart, Coupon, Review, Refund
    │
    ├── accounting-service (port 3007)
    │     Models: AccountLedger, JournalEntry, Expense, WalletTransaction, Disbursement
    │
    ├── notification-service (port 3008)
    │     Models: Notification, UserNotification, NotificationSetting
    │
    └── settings-service (port 3009)
          Models: BusinessSetting, EmailTemplate, Translation
```

**Inter-service communication:**
- Synchronous: REST (HTTP) for real-time queries
- Asynchronous: Message Queue (Bull + Redis) for events (order placed → inventory deduct → notification send)

**Shared:**
- MongoDB — each service uses same DB but own collections
- JWT — auth-service issues tokens, other services verify
- API Gateway — routing, rate limiting, auth middleware

---

## Next Steps

1. ✅ Schema audit complete — no model changes needed
2. ⏳ Run `npm run db:migrate` to create all collections + indexes in MongoDB
3. ⏳ Decide: monolith first then split, OR build microservices from start
4. ⏳ If microservices from start — setup folder structure, API gateway
5. ⏳ Build REST APIs service by service

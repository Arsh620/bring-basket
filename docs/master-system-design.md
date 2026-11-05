# Bring Basket — Master System Design

**Last updated:** 2026-11-05  
**Current phase:** First five API-domain extractions  
**Goal:** Production-grade, microservice-ready grocery delivery platform

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Current Status](#2-current-status)
3. [Infrastructure Status](#3-infrastructure-status)
4. [Full Architecture — Target](#4-full-architecture--target)
5. [Microservice Breakdown](#5-microservice-breakdown)
6. [Database Design](#6-database-design)
7. [API Routes — Complete Status](#7-api-routes--complete-status)
8. [Microservice Extraction Roadmap](#8-microservice-extraction-roadmap)
9. [Implementation Plan](#9-implementation-plan)
10. [Environment Variables](#10-environment-variables)

---

## 1. System Overview

```
                          INTERNET
                              │
                       [API Gateway]
                         port 3000
                    Route, Auth, Rate Limit
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
   [Identity]            [Catalog]             [Store]
   internal 5001          internal 5002         internal 5003
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
   [Inventory]          [Procurement]           [Order]
   internal 5004          internal 5005         internal 5006
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        [Accounting]   [Notification]     [Settings]
        internal 5007    internal 5008     internal 5009
                              │
              ┌───────────────┼───────────────┐
              │               │               │
           [MongoDB]       [Redis]        [RabbitMQ]
           Database     Cache + Sessions   Async Events
```

**Abhi ka state:** Identity, Catalog, Store, Inventory aur Procurement APIs
dedicated containers mein chalti hain. Public `/api/v1/...` URLs Gateway ke through
same rehte hain. Ye initial extractions hain: services abhi shared `bring_basket`
MongoDB database aur backend domain source modules use karti hain; independent
database ownership aur cross-service API/event integration abhi baaki hai.

---

## 2. Current Status

### Backend Features

| Domain | Feature | Status |
|---|---|---|
| Identity | Admin auth (login, register, me, logout) | ✅ Done |
| Identity | Admin CRUD + status toggle | ✅ Done |
| Identity | Admin Roles CRUD | ✅ Done |
| Identity | Customer auth (login, register, me) | ✅ Done |
| Identity | Vendor auth (login, me, logout) | ✅ Done |
| Identity | Supplier auth (login, me, logout) | ✅ Done |
| Identity | Warehouse portal auth (login, me, logout) | ✅ Done |
| Identity | DeliveryMan auth (login, me, logout) | ✅ Done |
| Identity | Vendor Employee auth + CRUD | ❌ Pending |
| Identity | DeliveryMan CRUD | ❌ Pending |
| Catalog | Categories CRUD + status + filters | ✅ Done |
| Catalog | Brands CRUD + status | ✅ Done |
| Catalog | Units CRUD | ✅ Done |
| Catalog | Unit Groups + Conversions CRUD | ✅ Done |
| Catalog | Items CRUD + status + stock + low-stock | ✅ Done |
| Catalog | Item Batches CRUD + expiring-soon | ✅ Done |
| Store | Modules CRUD + status + filters | ✅ Done |
| Store | Zones CRUD + status + filters | ✅ Done |
| Store | Stores CRUD + status + schedule + filters | ✅ Done |
| Inventory | Warehouses CRUD + status + filters | ✅ Done |
| Inventory | Warehouse Stock (get, set, adjust) | ✅ Done |
| Inventory | Stock Movements (list) | ✅ Done |
| Inventory | Stock Transfers (full workflow) | ✅ Done |
| Inventory | Store Stock Requests (full workflow) | ✅ Done |
| Inventory | Batch Write-offs | ✅ Done |
| Procurement | Purchase Vendors CRUD + status + approval | ✅ Done |
| Procurement | Purchase Orders CRUD + issue + cancel | ✅ Done |
| Procurement | Purchase Bills (convert, edit, void, GRN) | ✅ Done |
| Procurement | Purchase Payments (list, record, delete) | ✅ Done |
| Procurement | Purchase Returns | ❌ Pending |
| Order | Orders (customer order lifecycle) | ❌ Pending |
| Order | Cart + Coupons | ❌ Pending |
| Order | Reviews + Refunds | ❌ Pending |
| Accounting | Wallet + Ledger + Disbursements | ❌ Pending |
| Notification | Push + Email + SMS | ❌ Pending |
| Settings | Business Settings | ❌ Pending |

### Frontend Pages

| Page | Backend | Frontend |
|---|---|---|
| Admin Login | ✅ | ✅ |
| Dashboard | ❌ | ❌ |
| Procurement — Vendors | ✅ | ✅ |
| Procurement — Orders | ✅ | ✅ |
| Procurement — Bills | ✅ | ✅ |
| Procurement — Payments | ✅ | ✅ |
| Catalog — Items | ✅ | ✅ |
| Catalog — Categories | ✅ | ✅ |
| Catalog — Brands | ✅ | ✅ |
| Catalog — Units | ✅ | ✅ |
| Catalog — Unit Groups | ✅ | ✅ |
| Catalog — Item Batches | ✅ | ✅ |
| Stores | ✅ | ❌ Pending |
| Zones | ✅ | ❌ Pending |
| Modules | ✅ | ❌ Pending |
| Warehouses | ✅ | ❌ Pending |
| Warehouse Stock | ✅ | ❌ Pending |
| Stock Movements | ✅ | ❌ Pending |
| Stock Transfers | ✅ | ❌ Pending |
| Store Stock Requests | ✅ | ❌ Pending |
| Batch Write-offs | ✅ | ❌ Pending |
| Admins Management | ✅ | ✅ |
| Roles Management | ✅ | ✅ |

---

## 3. Infrastructure Status

| Requirement | Status | Detail |
|---|---|---|
| Security — Helmet | ✅ Done | HTTP security headers |
| Security — Rate Limiting | ✅ Done | 100 req/15min global, 10 req/15min auth |
| Security — Input Sanitize | ✅ Done | `$` operator strip |
| Security — CORS | ✅ Done | `ALLOWED_ORIGINS` env se |
| Security — JWT + bcrypt | ✅ Done | Role-specific middleware |
| Security — Role Check | ✅ Done | `checkRole` on all admin routes |
| Performance — Compression | ✅ Done | gzip responses |
| Performance — Indexes | ✅ Done | MongoDB indexes on all models |
| Performance — Parallel Queries | ✅ Done | `Promise.all` throughout |
| Performance — Redis Cache | ❌ Pending | Categories, brands cache |
| Data Safety — Transactions | ✅ Done | Procurement + Inventory |
| Data Safety — Retry Writes | ✅ Done | `retryWrites: true` |
| Reliability — Health Check | ✅ Done | `/health` endpoint |
| Reliability — Graceful Shutdown | ✅ Done | SIGTERM handler |
| Reliability — Error Handling | ✅ Done | Global error handler + unhandledRejection |
| Logging — Morgan | ✅ Done | HTTP request logs |
| Logging — Winston | ✅ Done | `logs/error.log` + `logs/combined.log` |
| Scaling — PM2 Cluster | ✅ Done | `ecosystem.config.js`, `instances: max` |
| Scaling — Redis Rate Limiter | ✅ Done | Gateway + Identity use shared Redis-backed limits |
| Scaling — Docker | ✅ Done | MongoDB replica set, Redis, backend, five domain services, Gateway, frontend |
| Scaling — API Gateway | ✅ Done | JWT, CORS, rate limits; five extracted domains have dedicated upstreams |
| Identity extraction | ✅ Initial | Dedicated container; still shares MongoDB and backend source modules |
| Catalog extraction | ✅ Initial | Dedicated container; still shares MongoDB and inventory stock model |
| Store extraction | ✅ Initial | Dedicated container; still shares MongoDB and backend source modules |
| Inventory extraction | ✅ Initial | Dedicated container; still shares MongoDB and Catalog/Store model code |
| Procurement extraction | ✅ Initial | Dedicated container; still shares MongoDB and Inventory/Catalog/Store models |
| Service health/readiness | ✅ Done | Compose waits for MongoDB replica set, Redis, and service health |

---

## 4. Full Architecture — Target

### Request Flow

```
Client (Browser / Mobile App)
        │
        ▼
[API Gateway — port 3000]
  - JWT verify karo
  - Rate limit karo (Redis-backed)
  - Route karo sahi service pe
  - Response compress karo
        │
        ├──► [Identity Service — internal 5001]
        │         POST /auth/admin/login
        │         POST /auth/customer/login
        │         GET  /auth/me
        │
        ├──► [Catalog Service — internal 5002]
        │         GET  /items
        │         GET  /categories
        │
        ├──► [Store Service — internal 5003]
        │         GET  /stores
        │         GET  /zones
        │
        ├──► [Inventory Service — internal 5004]
        │         GET  /warehouses/:id/stock
        │         POST /stock-transfers
        │
        ├──► [Procurement Service — internal 5005]
        │         POST /purchases/orders
        │         POST /purchases/bills/:id/mark-stock-received
        │
        ├──► [Order Service — 3006]
        │         POST /orders
        │         GET  /orders/:id
        │
        ├──► [Accounting Service — 3007]
        │         GET  /wallet/balance
        │         POST /disbursements
        │
        ├──► [Notification Service — 3008]
        │         POST /notifications/send
        │
        └──► [Settings Service — 3009]
                  GET  /settings/business
```

### Async Event Flow (RabbitMQ / Bull + Redis)

```
Order placed
    │
    ├──► Inventory Service  (stock deduct karo)
    ├──► Accounting Service (wallet debit karo)
    └──► Notification Service (customer ko notify karo)

Payment received
    │
    ├──► Accounting Service (ledger update karo)
    └──► Notification Service (receipt bhejo)

GRN received
    │
    └──► Inventory Service (warehouse stock update karo)
```

---

## 5. Microservice Breakdown

### Identity Service (Docker internal port 5001)
**Owns:** Admin, AdminRole, User, Vendor, VendorEmployee, DeliveryMan  
**DB:** Currently shares `bring_basket`; separate `bring_basket_identity` is a later migration  
**Responsibilities:**
- Token issue karna (JWT)
- Password hash + verify
- Role management

**Cross-service:** Baaki services sirf JWT verify karte hain — Identity se direct call nahi
**Current implementation:** Dedicated container; routes/controllers/models are still sourced from `backend/src`.

---

### Catalog Service (Docker internal port 5002)
**Owns:** Item, Category, Brand, Unit, UnitGroup, UnitGroupConversion, ItemBatch  
**DB:** Currently shares `bring_basket`; separate `bring_basket_catalog` is a later migration  
**Responsibilities:**
- Item master data
- Category tree
- Unit conversions

**Cross-service:** Inventory stock ke liye `itemId` pass karta hai — direct model import nahi
**Current implementation:** Catalog routes run in a dedicated container. Item stock operations still use the shared inventory stock model and database.

---

### Store Service (Docker internal port 5003)
**Owns:** Module, Store, Zone  
**DB:** `bring_basket_store`  
**Responsibilities:**
- Store master data
- Zone + delivery area
- Store schedule

**Current implementation:** Dedicated container. Store reads abhi shared MongoDB mein
Identity ke `Vendor` model ko populate karte hain; independent ownership baad mein.

---

### Inventory Service (Docker internal port 5004)
**Owns:** Warehouse, WarehouseItemStock, WarehouseStockMovement, WarehouseStockTransfer, StoreStockRequest, WarehouseItemBatch  
**DB:** `bring_basket_inventory`  
**Responsibilities:**
- Warehouse stock balance
- Stock movements audit
- Transfer workflows
- Store replenishment

**Current implementation:** Dedicated container. Inventory abhi Catalog item/stock
helpers aur Store models directly share karta hai; API/event boundary abhi baaki hai.

---

### Procurement Service (Docker internal port 5005)
**Owns:** PurchaseVendor, PurchaseOrder, PurchaseBill, PurchasePayment, PurchaseReturn  
**DB:** `bring_basket_procurement`  
**Responsibilities:**
- Vendor management
- Purchase order lifecycle
- GRN + stock receipt
- Payment settlement

**Current implementation:** Dedicated container. GRN/stock updates abhi shared MongoDB
models aur MongoDB transactions se hote hain; cross-service event integration baad mein.

---

### Order Service (planned Docker internal port 5006)
**Owns:** Order, OrderDetail, Cart, Coupon, Review, Refund  
**DB:** `bring_basket_order`  
**Responsibilities:**
- Customer order lifecycle
- Cart management
- Coupon apply
- Refund processing

**Cross-service:**
- Catalog se item details
- Inventory se stock check
- Accounting se wallet debit
- Notification se order updates

---

### Accounting Service (planned Docker internal port 5007)
**Owns:** AccountLedger, JournalEntry, Expense, WalletTransaction, Disbursement  
**DB:** `bring_basket_accounting`  
**Responsibilities:**
- Wallet balance
- Vendor disbursements
- Expense tracking

---

### Notification Service (planned Docker internal port 5008)
**Owns:** Notification, UserNotification, NotificationSetting  
**DB:** `bring_basket_notification`  
**Responsibilities:**
- Push notifications (Firebase)
- Email (SMTP)
- SMS

---

### Settings Service (planned Docker internal port 5009)
**Owns:** BusinessSetting, EmailTemplate, Translation  
**DB:** `bring_basket_settings`  
**Responsibilities:**
- Business configuration
- Email templates
- Multi-language

---

## 6. Database Design

### Shared Infrastructure
```
MongoDB replica set (transactions ke liye zaroori; local Compose ek-node replica set chalata hai)
Redis (Cache + Rate Limiting + Bull Queue)
RabbitMQ / Bull (Async events)
```

### Per-Service DB (Microservice phase mein)
```
bring_basket_identity
bring_basket_catalog
bring_basket_store
bring_basket_inventory
bring_basket_procurement
bring_basket_order
bring_basket_accounting
bring_basket_notification
bring_basket_settings
```

### Abhi (Initial service extractions)
```
bring_basket  ← extracted services abhi isi shared database ko use karti hain
```

### Cross-service References Rule
- Services apne domain ke bahar ke documents `populate` nahi karenge
- Sirf `id` store karo, details chahiye toh us service ka HTTP endpoint call karo
- Async events ke liye Bull queue use karo

---

## 7. API Routes — Complete Status

### Identity
| Method | Path | Status |
|---|---|---|
| POST | `/api/v1/admin/auth/login` | ✅ |
| POST | `/api/v1/admin/auth/register` | ✅ |
| GET | `/api/v1/admin/auth/me` | ✅ |
| POST | `/api/v1/admin/auth/logout` | ✅ |
| GET/POST | `/api/v1/admin/admins` | ✅ |
| GET/PUT/PATCH/DELETE | `/api/v1/admin/admins/:id` | ✅ |
| GET/POST | `/api/v1/admin/roles` | ✅ |
| GET/PUT/DELETE | `/api/v1/admin/roles/:id` | ✅ |
| POST | `/api/v1/customer/auth/login` | ✅ |
| POST | `/api/v1/customer/auth/register` | ✅ |
| GET | `/api/v1/customer/auth/me` | ✅ |
| POST | `/api/v1/vendor/auth/login` | ✅ |
| GET | `/api/v1/vendor/auth/me` | ✅ |
| POST | `/api/v1/supplier/auth/login` | ✅ |
| GET | `/api/v1/supplier/auth/me` | ✅ |
| POST | `/api/v1/warehouse/auth/login` | ✅ |
| GET | `/api/v1/warehouse/auth/me` | ✅ |
| POST | `/api/v1/deliveryman/auth/login` | ✅ |
| GET | `/api/v1/deliveryman/auth/me` | ✅ |

### Catalog
| Method | Path | Status |
|---|---|---|
| GET/POST | `/api/v1/admin/categories` | ✅ |
| GET/PUT/PATCH/DELETE | `/api/v1/admin/categories/:id` | ✅ |
| GET/POST | `/api/v1/admin/brands` | ✅ |
| PUT/PATCH/DELETE | `/api/v1/admin/brands/:id` | ✅ |
| GET/POST | `/api/v1/admin/units` | ✅ |
| GET/PUT/DELETE | `/api/v1/admin/units/:id` | ✅ |
| GET/POST | `/api/v1/admin/unit-groups` | ✅ |
| GET/PUT/PATCH/DELETE | `/api/v1/admin/unit-groups/:id` | ✅ |
| GET/POST | `/api/v1/admin/unit-groups/:id/conversions` | ✅ |
| PUT/DELETE | `/api/v1/admin/unit-groups/:id/conversions/:cid` | ✅ |
| GET/POST | `/api/v1/admin/items` | ✅ |
| GET/PUT/PATCH/DELETE | `/api/v1/admin/items/:id` | ✅ |
| GET | `/api/v1/admin/items/low-stock` | ✅ |
| GET/POST | `/api/v1/admin/item-batches` | ✅ |
| GET/PUT/DELETE | `/api/v1/admin/item-batches/:id` | ✅ |
| GET | `/api/v1/admin/item-batches/expiring-soon` | ✅ |

### Store
| Method | Path | Status |
|---|---|---|
| GET/POST | `/api/v1/admin/modules` | ✅ |
| GET/PUT/PATCH/DELETE | `/api/v1/admin/modules/:id` | ✅ |
| GET/POST | `/api/v1/admin/zones` | ✅ |
| GET/PUT/PATCH/DELETE | `/api/v1/admin/zones/:id` | ✅ |
| GET/POST | `/api/v1/admin/stores` | ✅ |
| GET/PUT/PATCH/DELETE | `/api/v1/admin/stores/:id` | ✅ |
| GET/PUT | `/api/v1/admin/stores/:id/schedule` | ✅ |

### Inventory
| Method | Path | Status |
|---|---|---|
| GET/POST | `/api/v1/admin/warehouses` | ✅ |
| GET/PUT/PATCH/DELETE | `/api/v1/admin/warehouses/:id` | ✅ |
| GET | `/api/v1/admin/warehouses/:id/stock` | ✅ |
| PUT | `/api/v1/admin/warehouses/:id/stock/:itemId` | ✅ |
| PATCH | `/api/v1/admin/warehouses/:id/stock/:itemId/adjust` | ✅ |
| GET | `/api/v1/admin/stock-movements` | ✅ |
| GET/POST | `/api/v1/admin/stock-transfers` | ✅ |
| GET/PATCH | `/api/v1/admin/stock-transfers/:id` | ✅ |
| GET/POST | `/api/v1/admin/store-stock-requests` | ✅ |
| GET/PATCH | `/api/v1/admin/store-stock-requests/:id` | ✅ |
| GET/POST | `/api/v1/admin/batch-write-offs` | ✅ |

### Procurement
| Method | Path | Status |
|---|---|---|
| GET/POST | `/api/v1/admin/purchases/vendors` | ✅ |
| GET/PUT/PATCH/DELETE | `/api/v1/admin/purchases/vendors/:id` | ✅ |
| GET/POST | `/api/v1/admin/purchases/orders` | ✅ |
| GET/PUT | `/api/v1/admin/purchases/orders/:id` | ✅ |
| POST | `/api/v1/admin/purchases/orders/:id/issue` | ✅ |
| POST | `/api/v1/admin/purchases/orders/:id/cancel` | ✅ |
| POST | `/api/v1/admin/purchases/orders/:id/convert-to-bill` | ✅ |
| GET | `/api/v1/admin/purchases/bills` | ✅ |
| GET/PUT | `/api/v1/admin/purchases/bills/:id` | ✅ |
| POST | `/api/v1/admin/purchases/bills/:id/void` | ✅ |
| GET | `/api/v1/admin/purchases/bills/:id/grn-invoice` | ✅ |
| POST | `/api/v1/admin/purchases/bills/:id/mark-stock-received` | ✅ |
| GET/POST | `/api/v1/admin/purchases/payments` | ✅ |
| DELETE | `/api/v1/admin/purchases/payments/:id` | ✅ |
| GET/POST | `/api/v1/admin/purchases/returns` | ❌ Pending |
| GET/PATCH | `/api/v1/admin/purchases/returns/:id` | ❌ Pending |

### Order (Pending)
| Method | Path | Status |
|---|---|---|
| POST | `/api/v1/customer/orders` | ❌ Pending |
| GET | `/api/v1/customer/orders` | ❌ Pending |
| GET | `/api/v1/customer/orders/:id` | ❌ Pending |
| POST | `/api/v1/customer/cart` | ❌ Pending |
| GET | `/api/v1/customer/cart` | ❌ Pending |
| POST | `/api/v1/customer/coupons/apply` | ❌ Pending |
| GET/PATCH | `/api/v1/admin/orders` | ❌ Pending |

---

## 8. Microservice Extraction Roadmap

### Pre-requisites (Pehle yeh karo)
```
✅ Redis (rate limiter)
✅ Docker + docker-compose
✅ API Gateway (initial routing)
✅ Identity service (first extraction)
✅ Catalog, Store, Inventory, Procurement initial extractions
✅ Local MongoDB replica set for transactional writes
❌ Redis cache (categories + brands)
❌ Monolith feature complete (Orders, Returns)
```

### Extraction Order
Service jitni independent hogi, utni pehle extract karo.

```
Phase 1 — Foundation
  ✅ Redis setup (shared rate limiter)
  └── Redis cache (categories + brands) — pending
  └── Docker setup (MongoDB, Redis, App containers)
  └── API Gateway setup

Phase 2 — Feature Complete Karo (Monolith mein)
  └── Purchase Returns
  └── Orders + Cart + Coupons
  └── Frontend pending pages

Phase 3 — Extract (Ek ek karke)
  ✅ 1. Identity Service (initial extraction; shared DB/source)
  ✅ 2. Catalog Service (initial extraction; shared DB/stock model)
  ✅ 3. Store Service (initial extraction; shared DB/source)
  ✅ 4. Inventory Service (initial extraction; shared DB/domain imports)
  ✅ 5. Procurement Service (initial extraction; shared DB/domain imports)
  6. Per-service database ownership + cross-service APIs/events
  7. Order Service        ← not implemented
  8. Accounting Service   ← not implemented
  9. Notification Service ← not implemented
  10. Settings Service    ← not implemented
```

### Extraction ke Rules
- Ek service extract karo, test karo, phir agla
- `/api/v1/...` URLs same rakhna — Gateway routing change karega, clients nahi
- Cross-domain `populate` hatao, HTTP calls lagao
- Shared JWT secret — Gateway verify karega, services trust karenge

---

## 9. Implementation Plan

### Abhi karna hai (Next steps)

| Step | Kya | Estimated Time | Status |
|---|---|---|---|
| 1 | Redis — rate limiter | Done | ✅ |
| 2 | Redis — catalog cache | 1 din | ❌ |
| 3 | Purchase Returns backend | 2 din | ❌ |
| 4 | Orders + Cart + Coupons backend | 1 hafta | ❌ |
| 5 | Frontend — Stores, Zones, Modules pages | 3 din | ❌ |
| 6 | Frontend — Warehouse, Stock pages | 3 din | ❌ |
| 7 | Frontend — Orders pages | 3 din | ❌ |
| 8 | Docker setup + API Gateway | Done | ✅ |
| 9 | Identity service initial extraction | Done | ✅ |
| 10 | Catalog service initial extraction | Done | ✅ |
| 11 | Store, Inventory, Procurement initial extractions | Done | ✅ |
| 12 | Per-service DB ownership and cross-service integration | TBD | ❌ |

---

## 10. Environment Variables

### Monolith (.env)
```env
# Server
PORT=5000
NODE_ENV=development

# Docker Compose MongoDB (single-node replica set)
MONGO_URI=mongodb://localhost:27017/bring_basket

# JWT
JWT_SECRET=your_secret_here
JWT_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Redis (abhi pending)
REDIS_URL=redis://localhost:6379
```

### Docker Compose service ports
```env
Identity:    5001 (internal)
Catalog:     5002 (internal)
Store:       5003 (internal)
Inventory:   5004 (internal)
Procurement: 5005 (internal)
Gateway:     3000 (host)
```

---

## Notes

- **MongoDB Replica Set** — Transactions ke liye zaroori hai. Docker Compose local single-node replica set use karta hai. `mongo_data` volume aur `bring_basket` database preserve hote hain; host clients should connect through the replica-set member name `mongo` from the Docker network.
- **GRN Invoice Storage** — Abhi local `storage/purchase-bill-invoices/` mein hai. Production mein S3 ya equivalent private object storage chahiye. `NODE_ENV=production` pe local storage disabled hai.
- **`Item.stock`** — Legacy field hai. Actual stock `StoreItemStock` collection mein hai. Jab tak migration complete na ho, yeh field hatao mat.
- **`PurchaseVendor` vs `Vendor`** — Yeh alag models hain. PurchaseVendor procurement ke liye hai, Vendor store ownership ke liye. Merge mat karo.

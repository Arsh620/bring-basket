# Bring Basket - Laravel to Next.js + Node.js + MongoDB Conversion Report

**Project:** Bring Basket Inventory & Delivery Platform
**Source:** Laravel + MySQL (`C:\laragon\www\bring-basket\landing\`)
**Target:** Next.js (Frontend) + Node.js/Express (Backend) + MongoDB (Database)
**Repo:** `d:\bring-basket-fb\`
**Date:** 2025

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express v5 |
| Database | MongoDB + Mongoose v9 |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Frontend | Next.js 16 + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| State Management | Zustand *(pending confirmation)* |
| API Client | TanStack Query + Axios *(pending confirmation)* |
| UI Components | shadcn/ui *(pending confirmation)* |
| Source Reference | Laravel 10 + MySQL (`landing/` folder) |

---

## Development Workflow

**Rule:** Backend module complete → Frontend for that module → Next module

This ensures:
- Frontend always has real APIs to connect to
- No mock data that needs replacing later
- APIs get tested as frontend is built

---

## Technical Debt — To Do Later (Not Now)

These will be done in one go after all features are complete. Do NOT stop feature work for these.

| Task | Details |
|---|---|
| Validation layer | Replace manual `if (!field)` checks with `zod` schemas across all controllers |
| Rate limiting | `express-rate-limit` on auth + public routes |
| File uploads | Cloudinary or S3 — items, stores, banners, categories |
| Redis caching | Frequently accessed data (modules, categories, settings) |
| Bull Queue | Background jobs — notifications, emails, reports |
| Logging | `winston` for production-grade logging |
| Error codes | Standardize error strings into a constants file |

---

## Phase Status

### Phase 1 — Core Inventory & Catalog

| Area | Backend | Frontend |
|---|---|---|
| Categories | ✅ Full CRUD + status + filters | ❌ |
| Brands | ✅ Full CRUD + status | ❌ |
| Units | ✅ Full CRUD | ❌ |
| Unit Groups + Conversions | ❌ | ❌ |
| Items | ✅ Full CRUD + status + stock + low-stock | ❌ |
| Item Batches | ❌ | ❌ |

**Next:** Unit Groups → Item Batches → Phase 1 Frontend

---

### Phase 2 — Warehouse & Stock Management

| Area | Backend | Frontend |
|---|---|---|
| Warehouses | ✅ Full CRUD + status + filters | ❌ |
| Warehouse Stock (balances) | ❌ | ❌ |
| Stock Movements | ❌ | ❌ |
| Stock Transfers | ❌ | ❌ |
| Store Stock Requests | ❌ | ❌ |
| Batch Write-offs | ❌ | ❌ |

---

### Phase 3 — Purchase & Vendor Management

| Area | Backend | Frontend |
|---|---|---|
| Purchase Vendors | ❌ | ❌ |
| Purchase Orders | ❌ | ❌ |
| Purchase Bills / GRN | ❌ | ❌ |
| Purchase Returns | ❌ | ❌ |
| Purchase Payments | ❌ | ❌ |

---

### Phase 4 — Users, Auth & Roles

| Area | Backend | Frontend |
|---|---|---|
| Admin auth (login, register, me, logout) | ✅ | ❌ |
| Admin Roles CRUD | ✅ | ❌ |
| Admin Management CRUD | ✅ | ❌ |
| Customer auth (login, register, me) | ✅ | ❌ |
| Vendor auth (login, me, logout) | ✅ | ❌ |
| Supplier auth (login, me, logout) | ✅ | ❌ |
| Warehouse portal auth | ✅ | ❌ |
| Delivery Man auth | ✅ | ❌ |
| Vendor Employee auth + CRUD | ❌ | ❌ |
| Delivery Man CRUD | ❌ | ❌ |

---

### Phase 5 — Stores & Modules

| Area | Backend | Frontend |
|---|---|---|
| Modules | ✅ Full CRUD + status + filters | ❌ |
| Zones | ✅ Full CRUD + status + filters | ❌ |
| Stores | ✅ Full CRUD + status + schedule + filters | ❌ |

---

### Phase 6 — Orders & Transactions

| Area | Backend | Frontend |
|---|---|---|
| Orders | ❌ | ❌ |
| Carts | ❌ | ❌ |
| Coupons | ❌ | ❌ |
| Reviews | ❌ | ❌ |
| Refunds | ❌ | ❌ |

---

### Phase 7 — Accounting & Finance

| Area | Backend | Frontend |
|---|---|---|
| Account Ledgers | ❌ | ❌ |
| Journal Entries | ❌ | ❌ |
| Expenses | ❌ | ❌ |
| Wallet Transactions | ❌ | ❌ |
| Disbursements | ❌ | ❌ |
| Withdraw Requests | ❌ | ❌ |

---

### Phase 8 — Notifications, Settings & Misc

| Area | Backend | Frontend |
|---|---|---|
| Business Settings | ❌ | ❌ |
| Notifications | ❌ | ❌ |
| Activity Logs | ❌ | ❌ |
| Email Templates | ❌ | ❌ |
| Translations / i18n | ❌ | ❌ |

---

## Frontend Pages Plan

### Admin Panel (`/admin/...`)

| Page | Phase | Status |
|---|---|---|
| `/admin/login` | 4 | ❌ |
| `/admin/dashboard` | 4 | ❌ |
| `/admin/catalog/items` | 1 | ❌ |
| `/admin/catalog/items/add` | 1 | ❌ |
| `/admin/catalog/items/:id` | 1 | ❌ |
| `/admin/catalog/categories` | 1 | ❌ |
| `/admin/catalog/brands` | 1 | ❌ |
| `/admin/catalog/units` | 1 | ❌ |
| `/admin/catalog/unit-groups` | 1 | ❌ |
| `/admin/stores` | 5 | ❌ |
| `/admin/stores/:id` | 5 | ❌ |
| `/admin/modules` | 5 | ❌ |
| `/admin/zones` | 5 | ❌ |
| `/admin/warehouse` | 2 | ❌ |
| `/admin/warehouse/:id/stock` | 2 | ❌ |
| `/admin/stock-transfers` | 2 | ❌ |
| `/admin/store-stock-requests` | 2 | ❌ |
| `/admin/purchase/vendors` | 3 | ❌ |
| `/admin/purchase/orders` | 3 | ❌ |
| `/admin/purchase/bills` | 3 | ❌ |
| `/admin/purchase/returns` | 3 | ❌ |
| `/admin/orders` | 6 | ❌ |
| `/admin/orders/:id` | 6 | ❌ |
| `/admin/users` | 4 | ❌ |
| `/admin/vendors` | 4 | ❌ |
| `/admin/delivery-men` | 4 | ❌ |
| `/admin/accounting/ledgers` | 7 | ❌ |
| `/admin/accounting/journal` | 7 | ❌ |
| `/admin/accounting/expenses` | 7 | ❌ |
| `/admin/reports/sales` | 6 | ❌ |
| `/admin/reports/stock` | 2 | ❌ |
| `/admin/settings` | 8 | ❌ |

### Vendor Panel (`/vendor/...`)

| Page | Status |
|---|---|
| `/vendor/login` | ❌ |
| `/vendor/dashboard` | ❌ |
| `/vendor/items` | ❌ |
| `/vendor/orders` | ❌ |
| `/vendor/stock-requests` | ❌ |
| `/vendor/pos` | ❌ |
| `/vendor/reports` | ❌ |

### Customer App (`/...`)

| Page | Status |
|---|---|
| `/login` | ❌ |
| `/register` | ❌ |
| `/home` | ❌ |
| `/cart` | ❌ |
| `/orders` | ❌ |
| `/profile` | ❌ |

---

## Project Structure

```
bring-basket-fb/
├── backend/
│   ├── src/
│   │   ├── config/db.js
│   │   ├── domains/                        ← all business logic lives here
│   │   │   ├── identity/                   (admin-auth, admins, roles, customer-auth,
│   │   │   │                                vendor-auth, supplier-auth, deliveryman-auth,
│   │   │   │                                warehouse-auth)
│   │   │   ├── catalog/                    (brands, categories, items, units,
│   │   │   │                                unit-groups, item-batches)
│   │   │   ├── inventory/                  (warehouses, warehouse-stock, stock-movements,
│   │   │   │                                stock-transfers, store-stock-requests,
│   │   │   │                                batch-write-offs, store-item-stock.model,
│   │   │   │                                store-stock.service, warehouses.service,
│   │   │   │                                warehouse-stock.service)
│   │   │   └── store/                      (modules, zones, stores)
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── roleCheck.js
│   │   │   └── errorHandler.js
│   │   ├── models/                         ← shared models (move per-service on extraction)
│   │   │   ├── auth/
│   │   │   ├── catalog/
│   │   │   ├── store/
│   │   │   ├── warehouse/
│   │   │   ├── purchase/                   ❌ not yet migrated
│   │   │   └── GeneratedBusinessModels.js
│   │   ├── routes/v1/
│   │   │   └── index.js                    ← only router, points to domains/
│   │   └── utils/
│   │       ├── response.js
│   │       ├── pagination.js
│   │       └── AppError.js
│   ├── scripts/
│   ├── index.js
│   └── package.json
├── frontend/
│   └── src/app/        (Next.js — in progress)
├── docs/
└── .gitignore
```

---

## Tables to SKIP (Laravel Internal)

- `migrations`, `cache`, `cache_locks`, `sessions`
- `failed_jobs`, `jobs`
- `oauth_*` tables
- `password_resets`, `websockets_statistics_entries`
- `storages` (Laravel file storage tracker)
- `items_backup`, `items_ks_backup`, `items_store8_copy` (backup tables)

---

## MongoDB vs MySQL Key Differences

| MySQL | MongoDB |
|---|---|
| Foreign Keys | ObjectId References (`ref`) |
| JOIN queries | `populate()` or embed documents |
| Pivot tables (many-to-many) | Arrays of IDs in document |
| AUTO_INCREMENT id | `_id` (ObjectId) |
| `tinyint(1)` boolean | `Boolean` |
| `decimal(24,2)` | `Number` |
| `timestamp` | `Date` |
| `enum` | `String` with enum validator |

---

## NPM Packages

### Backend (installed)
```json
{
  "express": "^5.3.0",
  "mongoose": "^9.x",
  "jsonwebtoken": "^9.x",
  "bcryptjs": "^3.x",
  "dotenv": "^18.x",
  "cors": "^2.x",
  "express-validator": "^7.x",
  "mysql2": "^3.x"
}
```

### Frontend (installed)
```json
{
  "next": "16.4.3",
  "react": "19.3.0",
  "typescript": "^5",
  "tailwindcss": "^4"
}
```

### Frontend (to install)
```json
{
  "axios": "^1.x",
  "@tanstack/react-query": "^5.x",
  "zustand": "^5.x",
  "react-hook-form": "^7.x",
  "zod": "^3.x"
}
```

---

*Last updated: Phase 5 (Stores & Modules) backend complete. Technical debt section added. Workflow finalized — features first, polish later.*

# Bring Basket — Master System Design
**Last updated:** 2025-07-10 (full audit)

---

## Architecture

Single Express monolith (`backend/`) + Next.js frontend (`frontend/`).
Microservice extraction deferred — build features first.

```
Internet → API Gateway (port 3000) → Backend monolith (port 5000)
                                   → Frontend Next.js (port 3001)
MongoDB (27017) · Redis (6379)
```

---

## Auth System — How Every Portal Logs In

### JWT Strategy
- Single `JWT_SECRET` shared across all portals
- Token payload: `{ id, role }` — role determines which routes are accessible
- Token expiry: 7 days (configurable via `JWT_EXPIRES_IN`)
- No refresh tokens yet

### Portal Login Summary

| Portal | Login Route | Credential | JWT Role | Token Storage (FE) |
|---|---|---|---|---|
| Admin | `POST /api/v1/admin/auth/login` | email + password | `admin` | `localStorage.admin_token` |
| Vendor | `POST /api/v1/vendor/auth/login` | email + password | `vendor` | `localStorage.vendor_token` (pending) |
| Customer | `POST /api/v1/customer/auth/login` | email + password | `customer` | `localStorage.customer_token` |
| Delivery Man | `POST /api/v1/deliveryman/auth/login` | phone + password | `deliveryman` | `localStorage.dm_token` |
| Warehouse | `POST /api/v1/warehouse/auth/login` | username + password | `warehouse` | pending |
| Supplier | `POST /api/v1/supplier/auth/login` | email + password | `supplier` | pending |
| Vendor Employee | ❌ Not built yet | email + password | `vendor_employee` (planned) | pending |

### Auth Middleware Chain
```
Request → auth.js (verify JWT + assert role) → controller
```
- `adminAuth` = verify + role === 'admin'
- `vendorAuth` = verify + role === 'vendor'
- `customerAuth` = verify + role === 'customer'
- `deliverymanAuth` = verify + role === 'deliveryman'
- `warehouseAuth` = verify + role === 'warehouse'
- `supplierAuth` = verify + role === 'supplier'

---

## Complete Route Map (Backend)

### Identity Routes (`/api/v1/...`)

```
POST   /admin/auth/login              ✅
POST   /admin/auth/register           ✅
GET    /admin/auth/me                 ✅
POST   /admin/auth/logout             ✅
GET    /admin/admins                  ✅
POST   /admin/admins                  ✅
GET    /admin/admins/:id              ✅
PUT    /admin/admins/:id              ✅
PATCH  /admin/admins/:id/status       ✅
DELETE /admin/admins/:id              ✅
GET    /admin/roles                   ✅
POST   /admin/roles                   ✅
GET    /admin/roles/:id               ✅
PUT    /admin/roles/:id               ✅
DELETE /admin/roles/:id               ✅

POST   /customer/auth/login           ✅
POST   /customer/auth/register        ✅
GET    /customer/auth/me              ✅
GET    /customer/addresses            ✅
POST   /customer/addresses            ✅
PUT    /customer/addresses/:id        ✅
DELETE /customer/addresses            ✅

POST   /vendor/auth/login             ✅
GET    /vendor/auth/me                ✅
POST   /vendor/auth/logout            ✅

POST   /supplier/auth/login           ✅
GET    /supplier/auth/me              ✅
POST   /supplier/auth/logout          ✅

POST   /deliveryman/auth/login        ✅
GET    /deliveryman/auth/me           ✅
POST   /deliveryman/auth/logout       ✅

POST   /warehouse/auth/login          ✅
GET    /warehouse/auth/me             ✅
POST   /warehouse/auth/logout         ✅
```

### Customer Routes (`/api/v1/...`)

```
GET    /config                        ✅
GET    /terms-and-conditions          ✅
GET    /about-us                      ✅
GET    /privacy-policy                ✅
GET    /refund-policy                 ✅
GET    /shipping-policy               ✅
GET    /cancellation                  ✅
GET    /zones                         ✅
POST   /zones/check                   ✅

GET    /items                         ✅
GET    /items/latest                  ✅
GET    /items/popular                 ✅
GET    /items/discounted              ✅
GET    /items/recommended             ✅
GET    /items/most-reviewed           ✅
GET    /items/search                  ✅
GET    /items/search-suggestion       ✅
GET    /items/:id                     ✅
GET    /items/:id/reviews             ✅
POST   /items/reviews/submit          ✅ (auth)

GET    /categories                    ✅
GET    /categories/popular            ✅
GET    /categories/:id/children       ✅
GET    /categories/:id/items          ✅

GET    /stores                        ✅
GET    /stores/latest                 ✅
GET    /stores/popular                ✅
GET    /stores/search                 ✅
GET    /stores/:id                    ✅

GET    /banners                       ✅
GET    /banners/store/:storeId        ✅
GET    /flash-sales                   ✅
GET    /flash-sales/items             ✅
GET    /campaigns/basic               ✅
GET    /campaigns/item                ✅
GET    /advertisements                ✅

GET    /coupons                       ✅
GET    /coupons/apply                 ✅ (auth)

GET    /customer/info                 ✅ (auth)
POST   /customer/update-profile       ✅ (auth)
PUT    /customer/cm-firebase-token    ✅ (auth)
DELETE /customer/remove-account       ✅ (auth)

GET    /customer/wish-list            ✅ (auth)
POST   /customer/wish-list/add        ✅ (auth)
DELETE /customer/wish-list/remove     ✅ (auth)

GET    /customer/wallet/balance       ✅ (auth)
GET    /customer/wallet/transactions  ✅ (auth)

GET    /customer/notifications        ✅ (auth)
PUT    /customer/notifications/read-all ✅ (auth)
PUT    /customer/notifications/:id/read ✅ (auth)
```

### Cart & Order Routes (`/api/v1/customer/...`)

```
POST   /cart/merge-guest              ✅
GET    /cart/list                     ✅
POST   /cart/add                      ✅
POST   /cart/update                   ✅
DELETE /cart/remove-item              ✅
DELETE /cart/remove                   ✅

GET    /order/list                    ✅
GET    /order/running-orders          ✅
GET    /order/details                 ✅
POST   /order/place                   ✅
PUT    /order/cancel                  ✅
```

### Delivery Man Routes (`/api/v1/deliveryman/...`)

```
GET    /profile                       ✅
PUT    /update-profile                ✅
POST   /update-active-status          ✅
PUT    /update-fcm-token              ✅
GET    /current-orders                ✅
GET    /all-orders                    ✅
GET    /order-delivery-history        ✅
GET    /order                         ✅
PUT    /accept-order                  ✅
PUT    /update-order-status           ✅
GET    /notifications                 ✅
POST   /record-location               ✅
```

### Vendor Routes (`/api/v1/vendor/...`)

```
GET    /profile                       ✅
PUT    /update-profile                ✅
GET    /dashboard                     ✅
GET    /orders                        ✅
PUT    /orders/update-status          ✅
GET    /items                         ✅
POST   /items                         ✅
PUT    /items/:id                     ✅
PATCH  /items/:id/status              ✅
DELETE /items/:id                     ✅
GET    /stores                        ✅
PUT    /update-fcm-token              ✅
```

### Admin Routes (`/api/v1/admin/...`)

```
--- Catalog ---
GET/POST       /brands                ✅
PUT/PATCH/DEL  /brands/:id            ✅
GET/POST       /categories            ✅
GET/PUT/PATCH/DEL /categories/:id     ✅
GET/POST       /items                 ✅
GET/PUT/PATCH/DEL /items/:id          ✅
GET            /items/low-stock       ✅
PATCH          /items/:id/stock       ✅
GET/POST       /units                 ✅
GET/PUT/DEL    /units/:id             ✅
GET/POST       /unit-groups           ✅
GET/PUT/PATCH/DEL /unit-groups/:id    ✅
GET/POST/PUT/DEL /unit-groups/:id/conversions ✅
GET/POST       /item-batches          ✅
GET/PUT/DEL    /item-batches/:id      ✅
GET            /item-batches/expiring-soon ✅

--- Stores ---
GET/POST       /modules               ✅
GET/PUT/PATCH/DEL /modules/:id        ✅
GET/POST       /zones                 ✅
GET/PUT/PATCH/DEL /zones/:id          ✅
GET/POST       /stores                ✅
GET/PUT/PATCH/DEL /stores/:id         ✅
GET/PUT        /stores/:id/schedule   ✅

--- Inventory ---
GET/POST       /warehouses            ✅
GET/PUT/PATCH/DEL /warehouses/:id     ✅
GET/PUT/PATCH  /warehouses/:id/stock  ✅
GET            /stock-movements       ✅
GET/POST       /stock-transfers       ✅
GET/PATCH      /stock-transfers/:id   ✅
GET/POST       /store-stock-requests  ✅
GET/PATCH      /store-stock-requests/:id ✅
GET/POST       /batch-write-offs      ✅

--- Procurement ---
GET/POST       /purchases/vendors     ✅
GET/PUT/PATCH/DEL /purchases/vendors/:id ✅
GET/POST       /purchases/orders      ✅
GET/PUT        /purchases/orders/:id  ✅
POST           /purchases/orders/:id/issue ✅
POST           /purchases/orders/:id/cancel ✅
POST           /purchases/orders/:id/convert-to-bill ✅
GET/PUT        /purchases/bills       ✅
GET            /purchases/bills/:id   ✅
POST           /purchases/bills/:id/void ✅
GET            /purchases/bills/:id/grn-invoice ✅
POST           /purchases/bills/:id/mark-stock-received ✅
GET/POST       /purchases/payments    ✅
DELETE         /purchases/payments/:id ✅
GET/POST       /purchases/returns     ✅
GET            /purchases/returns/:id ✅
POST           /purchases/returns/:id/approve ✅
POST           /purchases/returns/:id/void ✅

--- Orders ---
GET            /orders                ✅
GET            /orders/:id            ✅

--- Marketing ---
GET/POST       /banners               ✅
PUT/PATCH/DEL  /banners/:id           ✅
GET/POST       /coupons               ✅
PUT/PATCH/DEL  /coupons/:id           ✅
GET/POST       /flash-sales           ✅
GET/PUT/PATCH/DEL /flash-sales/:id    ✅
GET/POST       /campaigns             ✅
PUT/PATCH/DEL  /campaigns/:id         ✅
GET/POST       /advertisements        ✅
PUT/PATCH/DEL  /advertisements/:id    ✅

--- Settings ---
GET            /settings              ✅
POST           /settings              ✅
POST           /settings/bulk         ✅

--- Notifications ---
POST           /notifications/broadcast ✅
```

---

## Frontend Pages — Current Status

### Admin Panel (`/admin/...`)

| Page | Status | Notes |
|---|---|---|
| `/admin/login` | ✅ Done | Polished UI, zod validation |
| `/admin/dashboard` | ✅ Done | Stats, low-stock, quick links |
| `/admin/catalog/items` | ✅ Done | ResourcePage component |
| `/admin/catalog/categories` | ✅ Done | |
| `/admin/catalog/brands` | ✅ Done | |
| `/admin/catalog/units` | ✅ Done | |
| `/admin/catalog/unit-groups` | ✅ Done | |
| `/admin/catalog/item-batches` | ✅ Done | |
| `/admin/stores` | ✅ Done | |
| `/admin/modules` | ✅ Done | |
| `/admin/zones` | ✅ Done | |
| `/admin/warehouse` | ✅ Done | |
| `/admin/inventory/warehouse-stock` | ✅ Done | |
| `/admin/inventory/stock-transfers` | ✅ Done | |
| `/admin/inventory/store-stock-requests` | ✅ Done | |
| `/admin/inventory/stock-movements` | ✅ Done | |
| `/admin/inventory/batch-write-offs` | ✅ Done | |
| `/admin/procurement/vendors` | ✅ Done | |
| `/admin/procurement/orders` | ✅ Done | |
| `/admin/procurement/bills` | ✅ Done | GRN, invoice upload |
| `/admin/procurement/payments` | ✅ Done | |
| `/admin/procurement/returns` | ✅ Done | |
| `/admin/orders` | ✅ Done | All statuses via filter route |
| `/admin/banners` | ✅ Done | |
| `/admin/flash-sales` | ✅ Done | |
| `/admin/campaigns` | ✅ Done | |
| `/admin/advertisements` | ✅ Done | |
| `/admin/coupons` | ✅ Done | |
| `/admin/admins` | ✅ Done | |
| `/admin/roles` | ✅ Done | |
| `/admin/settings` | ✅ Done | App info + legal pages |
| `/admin/customers` | ✅ Done | List + status toggle |
| `/admin/vendors` | ✅ Done | List + status toggle |
| `/admin/delivery-men` | ✅ Done | List + create + status |
| `/admin/cashback` | ✅ Done | CRUD cashback rules |
| `/admin/wallet-bonus` | ✅ Done | CRUD wallet bonus |
| `/admin/employees` | ❌ Missing | |
| `/admin/loyalty-points` | ❌ Missing | |
| `/admin/disbursements` | ❌ Missing | |
| `/admin/subscription-packages` | ❌ Missing | |
| `/admin/reports/*` | ❌ Missing | |
| `/admin/activity-logs` | ❌ Missing | |

### Customer Portal (`/...`)

| Page | Status | Notes |
|---|---|---|
| `/home` | ✅ Done | Banners, categories, stores, items, search |
| `/shop` | ✅ Done | Store select, items, cart, checkout, orders |
| `/login` | ✅ Done | OTP forgot password flow |
| `/register` | ✅ Done | |
| `/profile` | ✅ Done | Edit + stats + quick links |
| `/wishlist` | ✅ Done | List + remove + add-to-cart |
| `/wallet` | ✅ Done | Balance + txns + add fund |
| `/orders` | ✅ Done | List + cancel + details |
| `/loyalty` | ✅ Done | History + convert to wallet |
| `/notifications` | ✅ Done | Mark read/all |
| `/addresses` | ❌ Missing | |

### Delivery Man Portal (`/deliveryman/...`)

| Page | Status | Notes |
|---|---|---|
| `/deliveryman/login` | ✅ Done | Phone + password |
| `/deliveryman` | ✅ Done | Dashboard, orders, status update |
| `/deliveryman/wallet` | ❌ Missing | |
| `/deliveryman/profile` | ❌ Missing | |

### Vendor Portal (`/vendor/...`)

| Page | Status | Notes |
|---|---|---|
| `/vendor/login` | ✅ Done | |
| `/vendor/register` | ✅ Done | |
| `/vendor/dashboard` | ✅ Done | Stats + quick actions |
| `/vendor/items` | ✅ Done | Full CRUD + status + search |
| `/vendor/orders` | ✅ Done | List + filter + status update |
| `/vendor/stores` | ✅ Done | View assigned stores |
| `/vendor/pos` | ❌ Missing | Backend not built |
| `/vendor/reports` | ❌ Missing | Backend not built |
| `/vendor/employees` | ❌ Missing | Backend not built |
| `/vendor/withdrawal` | ❌ Missing | Backend not built |

### Warehouse Portal (`/warehouse/...`)

| Page | Status | Notes |
|---|---|---|
| `/warehouse/login` | ❌ Missing | Backend ready |
| `/warehouse/dashboard` | ❌ Missing | |
| `/warehouse/stock` | ❌ Missing | |
| `/warehouse/requests` | ❌ Missing | |

### Supplier Portal (`/supplier/...`)

| Page | Status | Notes |
|---|---|---|
| `/supplier/login` | ❌ Missing | Backend ready |
| `/supplier/dashboard` | ❌ Missing | |
| `/supplier/orders` | ❌ Missing | |

---

## What Each Portal Should Have (Feature Scope)

### 🔵 Admin Panel
**Purpose:** Full system control

Core (done): Catalog, Inventory, Procurement, Orders, Stores, Marketing, Roles, Settings

Missing:
- Customer management (list, block, wallet bonus, loyalty adjust)
- Vendor management (list, approve/block, view stores)
- Delivery Man management (list, approve/block, assign zone)
- Employee management (vendor employees)
- Loyalty Points config (earn rate, redeem rate)
- Cashback config (rules, history)
- Disbursement management (vendor + DM payouts)
- Subscription packages (vendor plans)
- Reports (GST, Brand, Expiry, Sales, Ledger, Payables)
- Activity logs
- Language & Translation
- SMS/Email/Firebase config
- Offline payment methods
- File Manager

---

### 🟢 Vendor Portal
**Purpose:** Store owner manages their store(s)

Must have:
- Login / Register
- Dashboard (orders summary, earnings, store stats)
- Item management (CRUD, stock update, status)
- Order management (accept, process, cancel)
- Store profile (edit name, logo, schedule, settings)
- Coupon management (create/edit own coupons)
- Banner management (own store banners)
- Reports (sales, item-wise, date-wise)
- Withdrawal request (request payout)
- Subscription (view/renew plan)
- Employee management (add/remove store employees)
- Delivery Man management (assign DM to store)

Nice to have (later):
- POS system
- Chat/Conversation
- Advertisement management

---

### 🟡 Customer Portal
**Purpose:** End customer shops and tracks orders

Must have:
- Login / Register (dedicated pages)
- Home (banners, categories, stores, popular items)
- Shop (browse items, add to cart)
- Cart & Checkout
- Order history & tracking
- Profile (edit name, photo, phone)
- Addresses (add/edit/delete)
- Wallet (balance, transactions)
- Wishlist
- Notifications
- Reviews (submit after delivery)

Nice to have (later):
- Loyalty Points page
- Membership/Subscription
- Referral code
- Social login (Google/Facebook)
- OTP-based password reset

---

### 🔴 Delivery Man Portal
**Purpose:** DM picks up and delivers orders

Must have:
- Login (phone + password)
- Dashboard (online/offline toggle, stats)
- Current orders (accept, update status)
- Order history
- Profile edit
- Wallet & Earnings (balance, per-order earnings)
- Notifications

Nice to have (later):
- Disbursement/Withdrawal request
- Vehicle management
- DM Reviews (view ratings received)
- Chat with customer/store

---

### 🟣 Warehouse Portal
**Purpose:** Warehouse staff manages stock

Must have:
- Login (username + password)
- Dashboard (stock summary)
- Stock management (view, adjust)
- Store stock requests (approve, dispatch)
- Stock transfers (create, dispatch, receive)
- Stock movements (audit log)
- Pincode mapping

Nice to have (later):
- Purchase management (PO, Bills, GRN)
- Sub-warehouse management
- Reports

---

### ⚫ Supplier Portal
**Purpose:** Purchase vendor views their POs and submits invoices

Must have:
- Login (email + password, invite-based)
- Dashboard (pending POs, recent bills)
- Purchase Orders (view issued POs)
- Purchase Bills (view, upload invoice)
- Profile (view own details)

---

## Backend — What's Missing

### High Priority
| Feature | Where |
|---|---|
| Loyalty Points earn/redeem API | identity domain |
| Cashback rules + apply on order | store/orders domain |
| Admin: Customer management CRUD | identity domain |
| Admin: Vendor management CRUD | identity domain |
| Admin: DM management CRUD | identity domain |
| Vendor Employee auth + CRUD | identity domain |
| Employee Role CRUD | identity domain |
| DM Wallet & Earnings | identity domain |
| Payment Gateways (Razorpay first) | new payment domain |

### Medium Priority
| Feature | Where |
|---|---|
| Admin: Disbursement management | new accounting domain |
| Admin: Subscription packages CRUD | store domain |
| Vendor: POS system | vendor domain |
| Vendor: Reports | vendor domain |
| Vendor: Withdrawal requests | identity domain |
| DM: Disbursement/Withdrawal | identity domain |
| Warehouse Portal APIs | inventory domain |
| Supplier Portal APIs | procurement domain |
| Reviews admin management | catalog domain |

### Low Priority
| Feature | Where |
|---|---|
| Activity Logs | new logging domain |
| Language & Translation | new settings domain |
| SMS/Email/Firebase config | new settings domain |
| Newsletter | identity domain |
| Parcel delivery order type | orders domain |
| Membership/Subscription plans | identity domain |
| Chat/Conversation | new chat domain |
| PDF generation (invoices) | utils |
| Excel export | utils |
| WebSockets (real-time tracking) | new ws domain |

---

## Phase Plan (Updated)

### Phase 2 — Customer Portal Complete ✅ BACKEND DONE

**Backend completed:**
- OTP password reset (forgot → verify → reset)
- Loyalty Points (transactions, point-transfer to wallet)
- Cashback (rules, apply, admin CRUD)
- Wallet add-fund + bonuses
- Customer management admin APIs (list, view, status, wallet credit, loyalty adjust)
- Vendor management admin APIs (list, view, status, stores)
- Delivery Man management admin APIs (list, create, update, status, application approve/deny)
- Wallet Bonus admin CRUD
- Vendor register endpoint
- Vendor portal routes (`/api/v1/vendor/...`)

**New files created:**
- `models/auth/OtpVerification.js`
- `models/auth/LoyaltyTransaction.js`
- `models/store/Cashback.js`
- `models/store/CashbackHistory.js`
- `models/store/WalletBonus.js`
- `domains/identity/customer-otp.controller.js`
- `domains/identity/loyalty.controller.js`
- `domains/identity/customers.controller.js`
- `domains/identity/vendors-admin.controller.js`
- `domains/identity/delivery-men-admin.controller.js`
- `domains/store/cashback.controller.js`
- `domains/store/wallet-bonus.controller.js`
- `routes/v1/vendor/index.js`

**Frontend still pending for Phase 2**

### Phase 2 Frontend — Customer Portal ✅ DONE
**Frontend completed:**
- `/login` + `/register` root pages
- `/wishlist` page (list, remove, add-to-cart)
- `(customer)/login` — login + OTP forgot password flow
- `(customer)/register` — registration
- `(customer)/profile` — edit profile + stats + quick links
- `(customer)/wallet` — balance + transactions + add fund
- `(customer)/loyalty` — history + convert to wallet
- `(customer)/notifications` — mark read/all
- `(customer)/orders` — list + cancel + expand details
- Customer layout with bottom nav

### Phase 3 — Admin Management ✅ DONE
**Backend completed:** Customer/Vendor/DM management APIs, Cashback, Wallet Bonus
**Frontend completed:**
- `/admin/customers` — list, status toggle
- `/admin/vendors` — list, status toggle
- `/admin/delivery-men` — list, create, status toggle
- `/admin/cashback` — CRUD cashback rules
- `/admin/wallet-bonus` — CRUD wallet bonus
- Sidebar: User management + Promotions groups added
- `admin-resources.ts`: customers, vendors, delivery-men, cashback, wallet-bonus entries

### Phase 4 — Vendor Portal ✅ DONE
**Frontend completed:**
- `/vendor/login` — email + password login
- `/vendor/register` — vendor self-registration
- `/vendor/dashboard` — stats + quick actions
- `/vendor/items` — full CRUD + status toggle + search + pagination
- `/vendor/orders` — list + filter by status + update status
- `/vendor/stores` — view assigned stores
- Vendor layout with sidebar (desktop) + bottom nav (mobile)
- `vendor.store.ts` — Zustand auth store
- `lib/api/vendor.ts` — Axios client with token

### Phase 5 — Delivery Man Complete
Backend: DM wallet, earnings, disbursement
Frontend: DM wallet page, profile edit, earnings

### Phase 6 — Warehouse & Supplier Portals
Frontend: Warehouse portal (login, dashboard, stock, requests), Supplier portal

### Phase 7 — Payment Gateways ✅ DONE
**Backend completed:**
- `models/store/Payment.js` — payment transaction model
- `domains/store/razorpay.controller.js` — create order, verify, webhook, refund, history
- `routes/v1/payment/index.js` — payment routes
- Order service: `digital_payment` + `wallet` payment methods added
- Wallet payment: balance check + debit in transaction
- Webhook: signature verification + auto-fulfill
- Gateway: `/api/v1/payment/*` routes added

**Frontend completed:**
- `lib/razorpay.ts` — script loader + openRazorpay utility
- `components/payment/RazorpayButton.tsx` — reusable payment button
- `(customer)/checkout/page.tsx` — full checkout (COD + Razorpay + Wallet)
- `(customer)/wallet/page.tsx` — Razorpay top-up added

**New API endpoints:**
```
POST /payment/razorpay/create-order   (customerAuth)
POST /payment/razorpay/verify         (customerAuth)
POST /payment/razorpay/webhook        (public, signature verified)
POST /payment/razorpay/refund         (adminAuth)
GET  /payment/razorpay/history        (customerAuth)
```

**Setup required:**
- `.env`: Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `.env.local`: Set `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- Razorpay Dashboard: Add webhook URL `https://yourdomain.com/api/v1/payment/razorpay/webhook`

### Phase 8 — Delivery Man Complete + Customer Addresses
Backend: DM wallet, earnings
Frontend: DM wallet page, Customer addresses page

### Phase 9 — Warehouse & Supplier Portals
Frontend: Warehouse portal, Supplier portal

### Phase 10 — Admin Reports & Config
Backend: Reports, SMS/Email config, Activity logs
Frontend: Reports pages

---

## Vendor Portal Routes (`/vendor/...`)

| Page | Status |
|---|---|
| `/vendor/login` | ✅ Done |
| `/vendor/register` | ✅ Done |
| `/vendor/dashboard` | ✅ Done |
| `/vendor/items` | ✅ Done |
| `/vendor/orders` | ✅ Done |
| `/vendor/stores` | ✅ Done |
| `/vendor/employees` | ❌ Missing |
| `/vendor/withdrawal` | ❌ Missing |
| `/vendor/reports` | ❌ Missing |

### Phase 5 — Delivery Man Complete
Backend: DM wallet, earnings, disbursement
Frontend: DM wallet page, profile edit, earnings

### Phase 6 — Payment Gateways
Backend: Razorpay → Stripe → PhonePe → others

### Phase 7 — Warehouse & Supplier Portals
Frontend: Warehouse portal, Supplier portal

### Phase 8 — Admin Reports & Config
Backend: Reports, SMS/Email config, Activity logs
Frontend: Reports pages, config pages

### Phase 9 — Advanced
WebSockets, PDF, Excel, Multi-module, Parcel, POS

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + Express v5 |
| Database | MongoDB + Mongoose v9 (replica set) |
| Cache | Redis |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Frontend | Next.js 16 + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| API Client | TanStack Query + Axios |
| UI | shadcn/ui |
| Validation | Zod (frontend) |

## Service Ports

| Service | Port | Status |
|---|---|---|
| API Gateway | 3000 | ✅ |
| Frontend | 3001 | ✅ |
| Backend monolith | 5000 | ✅ |
| MongoDB | 27017 | ✅ |
| Redis | 6379 | ✅ |

## Coding Rules

1. Backend: `routes → controller → service → model` pattern
2. Response format: `{ success, data, message }` always
3. Pagination: `{ data, pagination: { total, page, limit, pages } }`
4. No cross-domain populate — use HTTP calls between domains
5. JWT verified at middleware, controllers trust `req.user`
6. MongoDB transactions required for stock-changing operations
7. All monetary values stored as `Number` (not Decimal128)
8. Frontend: TanStack Query for all API calls, Zustand for auth state

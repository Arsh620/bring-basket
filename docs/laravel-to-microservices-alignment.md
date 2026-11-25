# Laravel → Microservices Alignment Plan
**Reference:** PROJECT_DOCS_PART1.md + PROJECT_DOCS_PART2.md
**Last updated:** 2026-11-18

---

## WHAT LARAVEL HAS vs WHAT NEW PROJECT HAS

### PORTALS COMPARISON

| Portal | Laravel URL | New Project URL | Backend | Frontend |
|---|---|---|---|---|
| Admin (Super) | /login/admin | /admin/login | ✅ | ✅ |
| Admin Employee | /login/admin-employee | ❌ same page, no separate flow | ⚠️ partial | ❌ |
| Vendor/Store | /login/store | /vendor/login | ✅ | ✅ |
| Store Employee | /login/store-employee | ❌ missing | ❌ | ❌ |
| Warehouse | /warehouse/login | ❌ missing | ✅ API only | ❌ |
| Supplier | /supplier/login | ❌ missing | ✅ API only | ❌ |
| Delivery Man | mobile app only | /deliveryman/login | ✅ | ✅ |
| Customer | mobile app only | /login | ✅ | ✅ |

---

## BACKEND — WHAT'S BUILT vs WHAT'S MISSING

### ✅ DONE (Backend)

**Identity/Auth:**
- Admin auth (login, register, me, logout)
- Admin CRUD (create employee, assign role)
- Admin Roles CRUD + 36 target permission keys (including Laravel's `custom_role`; runtime role assignments remain database-driven)
- Customer auth (login, register, OTP forgot password)
- Customer profile, addresses
- Vendor auth (login, register, me)
- Vendor profile, dashboard, items, orders, stores
- Supplier auth (login, me, logout)
- Deliveryman auth (login, me, logout)
- Deliveryman profile, orders, wallet, earnings
- Warehouse auth (login, me, logout)
- Loyalty points (transactions, point-transfer)
- Wallet (balance, transactions, add-fund, bonuses)
- Notifications (customer, broadcast)
- Wishlist

**Catalog:**
- Items (CRUD, status, stock, low-stock)
- Categories (CRUD, status)
- Brands (CRUD, status)
- Units (CRUD)
- Unit Groups + Conversions (CRUD)
- Item Batches (CRUD, expiring-soon)
- Customer-facing items, categories

**Store:**
- Stores (CRUD, status, schedule)
- Modules (CRUD, status)
- Zones (CRUD, status)
- Banners (CRUD, status)
- Campaigns (CRUD, status)
- Flash Sales (CRUD, status)
- Advertisements (CRUD, status)
- Coupons (CRUD, status, apply)
- Cashback (CRUD, status)
- Wallet Bonus (CRUD, status)
- Business Settings (get/set)
- Customer-facing stores, banners, flash-sales, campaigns

**Inventory:**
- Warehouses (CRUD, status)
- Warehouse Stock (get, set, adjust)
- Stock Movements (list)
- Stock Transfers (CRUD, dispatch, receive, reject)
- Store Stock Requests (CRUD, approve, dispatch, receive, reject)
- Batch Write-offs
- Order Stock Reservations (reserve, commit, release)
- Store Item Stock (atomic operations)

**Procurement:**
- Purchase Vendors (CRUD)
- Purchase Orders (CRUD, issue, cancel, convert-to-bill)
- Purchase Bills (CRUD, void, mark-stock-received, GRN upload)
- Purchase Payments (CRUD)
- Purchase Returns (CRUD, approve, void)

**Orders:**
- Cart (add, update, remove, list, merge-guest)
- Order (place, list, running, details, cancel)
- Admin order list + details

**Payment:**
- Razorpay (create-order, verify, webhook, refund, history)

---

### ❌ MISSING (Backend) — Priority Order

#### P1 — Critical

| Feature | Laravel Reference | Where to Build |
|---|---|---|
| Admin Employee separate login flow | Section 3.2, 2.2 | identity domain |
| Vendor Employee auth + CRUD | Section 3.4, 9.7 | identity domain |
| Vendor Employee roles (store-level) | Section 9.8 | identity domain |
| Module-based permission middleware (backend route guard) | Section 4.3 | middleware |
| Admin: Loyalty points config (earn rate, redeem rate) | Section 8.22 | identity domain |
| Admin: Disbursement management (store + DM) | Section 8.25 | new accounting domain |
| Admin: Subscription packages CRUD | Section 8.20 | store domain |
| Customer: Addresses page API | Section 7.2 | identity domain ✅ already built |
| DM: Wallet + earnings API | Section 8.8 | identity domain ✅ already built |

#### P2 — Important

| Feature | Laravel Reference | Where to Build |
|---|---|---|
| Vendor: POS system | Section 9.4, 8.11 | new pos domain |
| Vendor: Employee management | Section 9.7 | identity domain |
| Vendor: Withdrawal requests | Section 9.9 | identity domain |
| Vendor: Coupons management | Section 9.14 | store domain |
| Vendor: Banner management | Section 9.14 | store domain |
| Vendor: Reports (sales, expense, disbursement) | Section 9.10 | new reports domain |
| Admin: Reports (all 17 report types) | Section 8.26 | new reports domain |
| Admin: Account/Finance module | Section 8.27 | new accounting domain |
| Admin: Activity logs | Section 14.4 | new logging domain |
| Warehouse Portal APIs | Section 8.29 | inventory domain |
| Supplier Portal APIs | Section 10 | procurement domain |
| Customer: Reviews submit + list | Section 7.2 | catalog domain |
| Customer: Membership plans | Section 8.21 | new membership domain |
| Order: Assign delivery man | Section 8.5 | orders domain |
| Order: Refund management | Section 8.5 | orders domain |
| Order: Invoice PDF | Section 8.5 | utils |

#### P3 — Nice to Have

| Feature | Laravel Reference | Notes |
|---|---|---|
| POS system (admin) | Section 8.11 | Complex |
| Chat/Conversation | Section 7.2 | WebSocket needed |
| Push notifications (FCM) | Section 12.1 | Firebase setup |
| Email notifications | Section 12.2 | SMTP config |
| SMS notifications | Section 12.3 | Twilio/SMS gateway |
| Multi-language | Section 15.1 | i18n |
| Barcode generation | Section 15.3 | PDF/image |
| Expiry markdown rules | Section 15.4 | inventory domain |
| Retail offer (buy X get Y) | Section 15.5 | catalog domain |
| Franchise system | Section 15.11 | store domain |
| Parcel delivery | Section 15.12 | orders domain |
| GST/Tax reports | Section 8.27 | accounting domain |
| Double-entry accounting | Section 8.27 | accounting domain |
| Subscription packages (vendor) | Section 8.20 | store domain |
| Customer membership | Section 8.21 | new domain |
| Social login | Section 8.30 | identity domain |
| File manager | Section 8.30 | utils |
| Storage (S3) | Section 17 | config |

---

## FRONTEND — WHAT'S BUILT vs WHAT'S MISSING

### ✅ DONE (Frontend)

**Admin:**
- Login, Dashboard
- Catalog: items, categories, brands, units, unit-groups, item-batches
- Stores, Modules, Zones
- Inventory: warehouses, warehouse-stock, stock-transfers, store-stock-requests, stock-movements, batch-write-offs
- Procurement: vendors, orders, bills, payments, returns
- Orders (all statuses)
- Marketing: banners, flash-sales, campaigns, advertisements, coupons
- User mgmt: customers, vendors, delivery-men
- Promotions: cashback, wallet-bonus
- Access control: admins, roles
- Settings

**Customer:**
- Login (with OTP forgot password), Register
- Home, Shop, Checkout (COD + Razorpay + Wallet)
- Profile, Orders, Wallet, Wishlist, Loyalty, Notifications

**Vendor:**
- Login, Register, Dashboard, Items, Orders, Stores
- Employees page (page exists), Roles page (page exists)

**Delivery Man:**
- Login, Dashboard (orders + status update)

---

### ❌ MISSING (Frontend) — Priority Order

#### P1 — Critical

| Page | Portal | Notes |
|---|---|---|
| `/warehouse/login` | Warehouse | Backend API ready |
| `/warehouse/dashboard` | Warehouse | Stock summary |
| `/warehouse/stock` | Warehouse | View + adjust stock |
| `/warehouse/requests` | Warehouse | Store stock requests |
| `/warehouse/transfers` | Warehouse | Stock transfers |
| `/supplier/login` | Supplier | Backend API ready |
| `/supplier/register` | Supplier | With approval flow |
| `/supplier/dashboard` | Supplier | PO list |
| `/supplier/orders` | Supplier | View POs |
| `/supplier/invoices` | Supplier | View + upload bills |
| `/supplier/payments` | Supplier | Payment history |
| `/supplier/profile` | Supplier | View profile |
| `/(customer)/addresses` | Customer | Add/edit/delete addresses |
| `/deliveryman/wallet` | DM | Balance + transactions + earnings |
| `/deliveryman/profile` | DM | Edit profile |

#### P2 — Important

| Page | Portal | Notes |
|---|---|---|
| `/admin/loyalty-points` | Admin | Config + report |
| `/admin/disbursements` | Admin | Store + DM payouts |
| `/admin/subscription-packages` | Admin | Vendor plans CRUD |
| `/admin/reports/orders` | Admin | Order report |
| `/admin/reports/stock` | Admin | Stock report |
| `/admin/reports/expiry` | Admin | Near expiry + expired |
| `/admin/reports/sales` | Admin | Sales analytics |
| `/admin/activity-logs` | Admin | Activity log viewer |
| `/vendor/pos` | Vendor | POS system |
| `/vendor/withdrawal` | Vendor | Withdrawal requests |
| `/vendor/coupons` | Vendor | Coupon management |
| `/vendor/banners` | Vendor | Banner management |
| `/vendor/reports` | Vendor | Sales + expense reports |
| `/vendor/store-settings` | Vendor | Store profile edit |

#### P3 — Nice to Have

| Page | Portal | Notes |
|---|---|---|
| `/admin/reports/gst` | Admin | GST reports |
| `/admin/reports/account` | Admin | Ledger, P&L, Balance sheet |
| `/admin/settings/email` | Admin | SMTP config |
| `/admin/settings/sms` | Admin | SMS gateway config |
| `/admin/settings/firebase` | Admin | FCM config |
| `/admin/settings/languages` | Admin | Multi-language |
| `/admin/settings/payments` | Admin | Payment gateway config |
| `/vendor/employees` | Vendor | Employee management (page exists, needs wiring) |
| `/vendor/roles` | Vendor | Custom roles (page exists, needs wiring) |

---

## MODELS — WHAT'S BUILT vs WHAT'S MISSING

### ✅ Built Models

```
auth/: Admin, AdminRole, User, Vendor, DeliveryMan, OtpVerification,
       WalletTransaction, DMWalletTransaction, LoyaltyTransaction,
       Notification, CustomerAddress, VendorEmployee

catalog/: Item, Category, Brand, Unit, UnitGroup, UnitGroupConversion,
          ItemBatch, BatchWriteOff, Wishlist, Review, Tag, Allergy, Nutrition

purchase/: PurchaseVendor, PurchaseOrder, PurchaseBill, PurchasePayment,
           PurchaseReturn, Sequence

store/: Store, Module, Zone, Banner, Campaign, FlashSale, Advertisement,
        Coupon, BusinessSetting, Cashback, CashbackHistory, WalletBonus,
        Payment, StoreStockMovement

warehouse/: Warehouse, WarehouseItemStock, WarehouseItemBatch,
            WarehouseStockMovement, WarehouseStockTransfer,
            StoreStockRequest, OrderStockReservation
```

### ❌ Missing Models

```
auth/:
  - VendorEmployee (exists as file but needs full implementation)
  - VendorRole (vendor custom roles)
  - WithdrawRequest (vendor/DM withdrawal)
  - Disbursement (store + DM payouts)
  - DisbursementDetail

store/:
  - SubscriptionPackage (vendor plans)
  - StoreSubscription (active vendor subscriptions)
  - SubscriptionTransaction

membership/:
  - CustomerMembershipPlan
  - CustomerMembershipSubscription

purchase/:
  - PurchaseVendorAddress
  - PurchaseVendorBank
  - PurchaseVendorContact
  - PurchaseVendorDocument
  - PurchaseVendorProduct (supplier catalog)
  - PurchaseScheme

accounting/:
  - AccountLedger
  - AccountJournalEntry
  - AccountJournalLine

orders/:
  - OrderDetail (line items — currently embedded in order)
  - OrderTransaction (financial per order)
  - Refund
  - RefundReason

catalog/:
  - ExpiryMarkdownRule
  - RetailOffer (or embedded in Item)

store/:
  - PosHeldCart
  - Conversation
  - Message
  - Review (DM reviews)
  - Expense
```

---

## MICROSERVICES DOMAIN MAPPING

Laravel is a monolith. New project splits into microservices.
Here's how Laravel features map to microservice domains:

| Laravel Feature | New Microservice Domain |
|---|---|
| Admin auth, employees, roles | backend/identity |
| Customer auth, profile, wallet, loyalty | backend/identity |
| Vendor auth, profile | backend/identity |
| DM auth, profile, wallet | backend/identity |
| Warehouse auth | backend/identity |
| Supplier auth | backend/identity |
| Items, categories, brands, units | backend/catalog |
| Stores, modules, zones | backend/store |
| Banners, campaigns, flash-sales, ads | backend/store |
| Coupons, cashback, wallet-bonus | backend/store |
| Business settings | backend/store |
| Warehouses, stock, transfers | backend/inventory |
| Store stock requests, write-offs | backend/inventory |
| Purchase vendors, POs, bills, payments | backend/procurement |
| Purchase returns | backend/procurement |
| Cart, orders | backend/orders |
| Payments (Razorpay etc.) | backend/payment |
| Disbursements, withdrawals | NEW: backend/accounting |
| Reports (all types) | NEW: backend/reports |
| Subscription packages | backend/store |
| Customer membership | NEW: backend/membership |
| POS system | NEW: backend/pos |
| Notifications (FCM, email, SMS) | backend/notification |
| Activity logs | NEW: backend/logging |
| Chat/conversation | NEW: backend/chat |
| File manager | backend/utils |

---

## IMPLEMENTATION PHASES (NEXT STEPS)

### Phase A — Missing Portals (Highest Priority)
1. Warehouse Portal frontend (login + dashboard + stock + requests + transfers)
2. Supplier Portal frontend (login + register + dashboard + orders + invoices)
3. Customer addresses page
4. DM wallet + profile pages

### Phase B — Vendor Portal Complete
1. Vendor employee management (backend + frontend wiring)
2. Vendor custom roles (backend + frontend wiring)
3. Vendor withdrawal requests
4. Vendor coupons + banners
5. Vendor store settings page

### Phase C — Admin Missing Features
1. Loyalty points config page
2. Disbursement management (backend + frontend)
3. Subscription packages (backend + frontend)
4. Reports pages (order, stock, expiry, sales)
5. Activity logs

### Phase D — Advanced Features
1. POS system (vendor + admin)
2. GST/Accounting reports
3. Push notifications (FCM)
4. Email notifications
5. PDF invoice generation
6. Customer membership plans
7. Retail offer (buy X get Y)
8. Expiry markdown rules

---

## KEY DIFFERENCES: Laravel vs New Project

| Aspect | Laravel | New Project |
|---|---|---|
| Auth | Session-based (8 guards) | JWT-based (role in token) |
| DB | MySQL (relational) | MongoDB (document) |
| Permission check | PHP middleware + blade hide | JS middleware + sidebar filter |
| Module system | nwidart/laravel-modules | Domain folders in monolith |
| Real-time | Laravel WebSockets | Planned (Socket.io) |
| File storage | Local/S3 via Intervention | Planned |
| PDF | mPDF/DomPDF | Planned (puppeteer/pdfkit) |
| Excel | Maatwebsite | Planned (exceljs) |
| Queue | Laravel Queue | Planned (Bull/Redis) |
| Multi-language | DB-driven translations | Planned (i18n) |
| Barcode | Custom EAN-13 | Planned |
| POS | Full (admin + vendor) | Not built yet |
| Accounting | Double-entry + GST | Not built yet |
| Subscription | Full (vendor + customer) | Not built yet |

# Bring Basket — Master System Design
**Last updated:** 2026-11-18 (Laravel role-gate reconciliation)

---

## Architecture — Microservices

```
Internet
  → API Gateway (port 3000)  ← all client traffic
      → Identity service (port 5001)   ← auth, admin roles, vendor employee roles/accounts
      → Catalog service (port 5002)
      → Store service (port 5003)
      → Inventory service (port 5004)
      → Procurement service (port 5005) ← purchases + supplier portal operations
      → Order service (port 5006)
      → Accounting service (port 5007)
      → Notification service (port 5008)
      → Payment service (port 5010)
      → Backend monolith (port 5000)   ← temporary legacy routes during extraction
  → Frontend Next.js (port 3001)

MongoDB (27017) · Redis (6379)
```

---

## Portals — Complete List (Laravel-aligned)

| Portal | Login URL (Frontend) | Login API | Credential | JWT Role |
|---|---|---|---|---|
| Admin (Super) | `/admin/login` | `POST /api/v1/admin/auth/login` | email + password | `admin` |
| Admin Employee | `/admin/employee-login` (same form) | same endpoint | email + password | `admin` (role_id checked) |
| Vendor / Store | `/vendor/login` | `POST /api/v1/vendor/auth/login` | email + password | `vendor` |
| Vendor Employee | `/vendor/login` (employee account type) | `POST /api/v1/vendor/auth/login` | email + password | `vendor_employee` |
| Warehouse | `/warehouse/login` | `POST /api/v1/warehouse/auth/login` | username + password | `warehouse` |
| Supplier | `/supplier/login` | `POST /api/v1/supplier/auth/login` | email + password | `supplier` |
| Delivery Man | `/deliveryman/login` | `POST /api/v1/deliveryman/auth/login` | phone + password | `deliveryman` |
| Customer | `/login` | `POST /api/v1/customer/auth/login` | email + password | `customer` |

---

## Role & Permission System (Laravel-aligned)

### How it works
- `AdminRole` model: `{ name, modules: JSON[], status }`
- `modules` is a flat array of permission keys stored as JSON string in DB
- `Admin.roleId` stores the selected `AdminRole._id`; login resolves it and returns the role and modules to the frontend
- Master Admin (`legacyId: 1`) has `modules: null` → full access, no check
- Admin employee management is guarded by `employee`; Admin and Vendor custom-role management use the distinct Laravel `custom_role` module
- Role managers can only create/assign roles whose module grants are within their own active role; Master Admin can manage all modules
- Employee managers only see/manage accounts with module grants no broader than their own; self-deactivation and self-deletion are blocked
- Admin employee API requests → middleware checks the active role's `modules` array and zone scope
- Frontend hides unavailable menu items, but every owning service must still enforce API permissions
- Vendor employee roles use a separate permission catalog and are store-scoped

### Create and verify an admin employee
1. In **Admin roles**, create and activate a role, then select its module permissions.
2. In **Administrators**, create an employee with a unique email, temporary password, and the active role. The employee record stores that role's MongoDB `_id` in `roleId`.
3. Sign in at `/admin/employee-login` (same admin authentication API as `/admin/login`) with the employee email and password.
4. Confirm the sidebar shows the selected modules. Try an allowed page and a page outside the role: the backend must allow the first and return `403` for the second.
5. To verify a role change, sign out and back in so the frontend loads the updated role. API authorization reads the active role from MongoDB on each request.

### Observed AdminRole Entries in Target MongoDB

These target records were observed previously and are not a verified snapshot of the live Laravel database. The source Laravel role count and current module assignments remain unknown.

| legacyId | Name | Modules |
|---|---|---|
| 1 | Master admin | null (full access) |
| 2 | Inventory Management | collect_cash, item, notification, order, store, report, zone, pos, unit |
| 3 | Product add | attribute, category, item, order, unit, purchase |
| 4 | PO Creator | account, collect_cash, attribute, category, coupon, customer_management, provide_dm_earning, employee, item, order, store, report, withdraw_list, zone, pos, unit, warehouse, purchase |
| 5 | Accountant | account, collect_cash, addon, attribute, banner, campaign, category, coupon, cashback, customer_management, deliveryman, provide_dm_earning, employee, item, notification, order, store, report, settings, withdraw_list, zone, module, parcel, pos, unit, subscription, warehouse, purchase |
| 6 | Account | account, report, purchase, warehouse, collect_cash |
| 7 | Franchise Team | same as Accountant |
| 8 | Technical team | same as Accountant |
| — | Super Admin | separate target entry; persistence/legacy ID not established in this audit |

### Target Permission Catalog (36 keys)

The Laravel routes use both `employee` and `custom_role`; runtime module records and source role assignments remain database-driven and are not established by this target catalog alone.
```
account          collect_cash      addon             attribute
banner           campaign          category          coupon
cashback         customer_management  deliveryman    provide_dm_earning
employee         custom_role       item              notification
order
store            report            settings          withdraw_list
zone             module            parcel            pos
unit             subscription      warehouse         purchase
trip             promotion         vehicle           provider
driver           download_app      rental_report
```

---

## Backend — Domain Structure

```
backend/src/
  config/         db.js, logger.js, redis.js
  domains/
    catalog/      items, categories, brands, units, unit-groups, item-batches
    identity/     admin-auth, admins, roles, customer-auth, customer-otp,
                  customer-profile, customer-addresses, vendor-auth, vendor,
                  vendors-admin, supplier-auth, deliveryman-auth, deliveryman,
                  delivery-men-admin, dm-wallet, warehouse-auth, loyalty,
                  notifications, wallet, wishlist
    inventory/    warehouses, warehouse-stock, stock-movements, stock-transfers,
                  store-stock-requests, batch-write-offs, order-stock-reservations,
                  store-stock.service, store-item-stock.model
    orders/       cart, order (place, list, cancel, admin)
    procurement/  purchase-vendors, purchase-orders, purchase-bills,
                  purchase-payments, purchase-returns
    store/        stores, modules, zones, banners, campaigns, flash-sales,
                  advertisements, coupons, cashback, wallet-bonus, config,
                  customer-stores, razorpay
  middleware/     auth.js, roleCheck.js, errorHandler.js, rateLimiter.js,
                  sanitize.js, service-auth.js
  models/
    auth/         Admin, AdminRole, User, Vendor, DeliveryMan, OtpVerification,
                  WalletTransaction, DMWalletTransaction, LoyaltyTransaction,
                  Notification, CustomerAddress, VendorEmployee
    catalog/      Item, Category, Brand, Unit, UnitGroup, UnitGroupConversion,
                  ItemBatch, BatchWriteOff, Wishlist, Review, Tag, Allergy,
                  Nutrition
    purchase/     PurchaseVendor, PurchaseOrder, PurchaseBill, PurchasePayment,
                  PurchaseReturn, Sequence
    store/        Store, Module, Zone, Banner, Campaign, FlashSale,
                  Advertisement, Coupon, BusinessSetting, Cashback,
                  CashbackHistory, WalletBonus, Payment, StoreStockMovement
    warehouse/    Warehouse, WarehouseItemStock, WarehouseItemBatch,
                  WarehouseStockMovement, WarehouseStockTransfer,
                  StoreStockRequest, OrderStockReservation
  utils/          AppError.js, response.js, pagination.js, geospatial.js
```

---

## Complete API Route Map

### Identity (`/api/v1/...`)
```
POST   /admin/auth/login                    ✅
POST   /admin/auth/register                 ✅
GET    /admin/auth/me                       ✅
POST   /admin/auth/logout                   ✅
GET    /admin/admins                        ✅
POST   /admin/admins                        ✅
GET    /admin/admins/:id                    ✅
PUT    /admin/admins/:id                    ✅
PATCH  /admin/admins/:id/status             ✅
DELETE /admin/admins/:id                    ✅
GET    /admin/roles                         ✅ requires custom_role module
GET    /admin/roles/permissions             ✅ requires custom_role module
POST   /admin/roles                         ✅ requires custom_role module
GET    /admin/roles/:id                     ✅ requires custom_role module
PUT    /admin/roles/:id                     ✅ requires custom_role module
DELETE /admin/roles/:id                     ✅ requires custom_role module

POST   /customer/auth/login                 ✅
POST   /customer/auth/register              ✅
GET    /customer/auth/me                    ✅
POST   /customer/auth/forgot-password       ✅
POST   /customer/auth/verify-otp            ✅
PUT    /customer/auth/reset-password        ✅
GET    /customer/addresses                  ✅
POST   /customer/addresses                  ✅
PUT    /customer/addresses/:id              ✅
DELETE /customer/addresses                  ✅

POST   /vendor/auth/login                   ✅
POST   /vendor/auth/register                ✅
GET    /vendor/auth/me                      ✅
POST   /vendor/auth/logout                  ✅
GET    /vendor/roles/permissions            ✅ Identity service; custom_role
GET/POST/PUT/DELETE /vendor/roles           ✅ Identity service; custom_role
GET/POST/PUT/PATCH/DELETE /vendor/employees ✅ Identity service

POST   /supplier/auth/login                 ✅
POST   /supplier/auth/set-password          ✅
POST   /supplier/auth/invitations/:supplierId ✅ Admin, purchase permission; one-time manual share
GET    /supplier/auth/me                    ✅
POST   /supplier/auth/logout                ✅
GET    /supplier/registration/options       ✅ Public registration choices
POST   /supplier/registration               ✅ Public multipart form; pending approval

POST   /deliveryman/auth/login              ✅
GET    /deliveryman/auth/me                 ✅
POST   /deliveryman/auth/logout             ✅

POST   /warehouse/auth/login                ✅
GET    /warehouse/auth/me                   ✅
POST   /warehouse/auth/logout               ✅
```

Supplier authentication is owned by Identity; supplier business APIs are owned by Procurement:
```
GET    /supplier/dashboard                  ✅
GET    /supplier/orders                     ✅
GET    /supplier/orders/:id                 ✅
GET    /supplier/invoices                   ✅
GET    /supplier/invoices/:id               ✅
POST   /supplier/invoices/:id/upload        ✅ Supplier-owned private invoice file
GET    /supplier/invoices/:id/attachment    ✅ Supplier-owned private invoice download
GET    /supplier/payments                   ✅
GET    /supplier/profile                    ✅
```

### Admin Management (`/api/v1/admin/...`)
```
GET    /customers                           ✅
GET    /customers/:id                       ✅
PATCH  /customers/:id/status                ✅
POST   /customers/:id/wallet/add-fund       ✅
POST   /customers/:id/loyalty/adjust        ✅
GET    /customers/:id/orders                ✅

GET    /vendors                             ✅
GET    /vendors/:id                         ✅
PATCH  /vendors/:id/status                  ✅
DELETE /vendors/:id                         ✅
GET    /vendors/:id/stores                  ✅

GET    /delivery-men                        ✅
POST   /delivery-men                        ✅
GET    /delivery-men/:id                    ✅
PUT    /delivery-men/:id                    ✅
PATCH  /delivery-men/:id/status             ✅
PATCH  /delivery-men/:id/application        ✅
DELETE /delivery-men/:id                    ✅

GET    /cashback                            ✅
POST   /cashback                            ✅
PUT    /cashback/:id                        ✅
PATCH  /cashback/:id/status                 ✅
DELETE /cashback/:id                        ✅

GET    /wallet-bonus                        ✅
POST   /wallet-bonus                        ✅
PUT    /wallet-bonus/:id                    ✅
PATCH  /wallet-bonus/:id/status             ✅
DELETE /wallet-bonus/:id                    ✅

POST   /notifications/broadcast             ✅
GET    /settings                            ✅
POST   /settings                            ✅
POST   /settings/bulk                       ✅
```

### Catalog (`/api/v1/...`)
```
GET/POST       /brands                      ✅
PUT/PATCH/DEL  /brands/:id                  ✅
GET/POST       /categories                  ✅
GET/PUT/PATCH/DEL /categories/:id           ✅
GET/POST       /items                       ✅
GET/PUT/PATCH/DEL /items/:id                ✅
GET            /items/low-stock             ✅
PATCH          /items/:id/stock             ✅
GET/POST       /units                       ✅
GET/PUT/DEL    /units/:id                   ✅
GET/POST       /unit-groups                 ✅
GET/PUT/PATCH/DEL /unit-groups/:id          ✅
GET/POST/PUT/DEL /unit-groups/:id/conversions ✅
GET/POST       /item-batches               ✅
GET/PUT/DEL    /item-batches/:id            ✅
GET            /item-batches/expiring-soon  ✅
```

### Store (`/api/v1/admin/...`)
```
GET/POST       /modules                     ✅
GET/PUT/PATCH/DEL /modules/:id              ✅
GET/POST       /zones                       ✅
GET/PUT/PATCH/DEL /zones/:id                ✅
GET/POST       /stores                      ✅
GET/PUT/PATCH/DEL /stores/:id               ✅
GET/PUT        /stores/:id/schedule         ✅
GET/POST       /banners                     ✅
PUT/PATCH/DEL  /banners/:id                 ✅
GET/POST       /coupons                     ✅
PUT/PATCH/DEL  /coupons/:id                 ✅
GET/POST       /flash-sales                 ✅
GET/PUT/PATCH/DEL /flash-sales/:id          ✅
GET/POST       /campaigns                   ✅
PUT/PATCH/DEL  /campaigns/:id               ✅
GET/POST       /advertisements              ✅
PUT/PATCH/DEL  /advertisements/:id          ✅
```

### Inventory (`/api/v1/...`)
```
GET/POST       /warehouses                  ✅
GET/PUT/PATCH/DEL /warehouses/:id           ✅
GET/PUT/PATCH  /warehouses/:id/stock        ✅
GET            /stock-movements             ✅
GET/POST       /stock-transfers             ✅
GET/PATCH      /stock-transfers/:id/dispatch ✅
GET/PATCH      /stock-transfers/:id/receive  ✅
GET/PATCH      /stock-transfers/:id/reject   ✅
GET/POST       /store-stock-requests        ✅
PATCH          /store-stock-requests/:id/approve ✅
PATCH          /store-stock-requests/:id/dispatch ✅
PATCH          /store-stock-requests/:id/receive  ✅
PATCH          /store-stock-requests/:id/reject   ✅
GET/POST       /batch-write-offs            ✅
```

### Procurement (`/api/v1/admin/purchases/...`)
```
GET/POST       /vendors                     ✅
GET/PUT/DEL    /vendors/:id                 ✅
GET/POST       /orders                      ✅
GET/PUT        /orders/:id                  ✅
POST           /orders/:id/issue            ✅
POST           /orders/:id/cancel           ✅
POST           /orders/:id/convert-to-bill  ✅
GET/POST       /bills                       ✅
GET            /bills/:id                   ✅
POST           /bills/:id/void              ✅
POST           /bills/:id/mark-stock-received ✅
GET/POST       /payments                    ✅
DELETE         /payments/:id                ✅
GET/POST       /returns                     ✅
GET            /returns/:id                 ✅
POST           /returns/:id/approve         ✅
POST           /returns/:id/void            ✅
```

### Orders (`/api/v1/...`)
```
GET    /admin/orders                        ✅
GET    /admin/orders/:id                    ✅
GET    /customer/order/list                 ✅
GET    /customer/order/running-orders       ✅
GET    /customer/order/details              ✅
POST   /customer/order/place                ✅
PUT    /customer/order/cancel               ✅
```

### Payment (`/api/v1/payment/...`)
```
POST   /razorpay/create-order               ✅
POST   /razorpay/verify                     ✅
POST   /razorpay/webhook                    ✅
POST   /razorpay/refund                     ✅
GET    /razorpay/history                    ✅
```

### Customer APIs (`/api/v1/customer/...`)
```
GET    /config                              ✅
GET    /items, /items/:id, /items/search    ✅
GET    /categories, /stores, /banners       ✅
GET    /flash-sales, /campaigns             ✅
GET    /coupons, /coupons/apply             ✅
GET    /customer/info                       ✅
POST   /customer/update-profile             ✅
GET    /customer/wish-list                  ✅
POST   /customer/wish-list/add              ✅
DELETE /customer/wish-list/remove           ✅
GET    /customer/wallet/balance             ✅
GET    /customer/wallet/transactions        ✅
POST   /customer/wallet/add-fund            ✅
GET    /customer/wallet/bonuses             ✅
GET    /customer/loyalty-point/transactions ✅
POST   /customer/loyalty-point/point-transfer ✅
GET    /customer/notifications              ✅
PUT    /customer/notifications/read-all     ✅
PUT    /customer/notifications/:id/read     ✅
GET    /cart/list                           ✅
POST   /cart/add                            ✅
POST   /cart/update                         ✅
DELETE /cart/remove-item                    ✅
```

### Vendor APIs (`/api/v1/vendor/...`)
Vendor employee role/account management is routed to Identity. The following vendor business endpoints remain on the temporary backend monolith until their owning domain APIs are extracted:
```
GET    /profile                             ✅
PUT    /update-profile                      ✅
GET    /dashboard                           ✅
GET    /stores                              ✅
GET    /orders                              ✅
PUT    /orders/update-status                ✅
GET    /items                               ✅
POST   /items                               ✅
PUT    /items/:id                           ✅
PATCH  /items/:id/status                    ✅
DELETE /items/:id                           ✅
```

### Delivery Man APIs (`/api/v1/deliveryman/...`)
```
GET    /profile                             ✅
PUT    /update-profile                      ✅
POST   /update-active-status                ✅
GET    /current-orders                      ✅
GET    /all-orders                          ✅
PUT    /accept-order                        ✅
PUT    /update-order-status                 ✅
GET    /wallet/balance                      ✅
GET    /wallet/transactions                 ✅
GET    /earnings                            ✅
```

---

## Frontend Pages — Status

### Admin Panel (`/admin/...`)
| Page | Status | Notes |
|---|---|---|
| `/admin/login` | ✅ | Polished UI, zod validation |
| `/admin/dashboard` | ✅ | Stats, low-stock, quick links |
| `/admin/catalog/items` | ✅ | ResourcePage |
| `/admin/catalog/categories` | ✅ | |
| `/admin/catalog/brands` | ✅ | |
| `/admin/catalog/units` | ✅ | |
| `/admin/catalog/unit-groups` | ✅ | With conversions dialog |
| `/admin/catalog/item-batches` | ✅ | |
| `/admin/stores` | ✅ | With schedule dialog |
| `/admin/modules` | ✅ | |
| `/admin/zones` | ✅ | |
| `/admin/warehouse` | ✅ | |
| `/admin/inventory/warehouse-stock` | ✅ | |
| `/admin/inventory/stock-transfers` | ✅ | |
| `/admin/inventory/store-stock-requests` | ✅ | |
| `/admin/inventory/stock-movements` | ✅ | |
| `/admin/inventory/batch-write-offs` | ✅ | |
| `/admin/procurement/vendors` | ✅ | |
| `/admin/procurement/orders` | ✅ | |
| `/admin/procurement/bills` | ✅ | |
| `/admin/procurement/payments` | ✅ | |
| `/admin/procurement/returns` | ✅ | |
| `/admin/orders` | ✅ | All statuses |
| `/admin/banners` | ✅ | |
| `/admin/flash-sales` | ✅ | |
| `/admin/campaigns` | ✅ | |
| `/admin/advertisements` | ✅ | |
| `/admin/coupons` | ✅ | |
| `/admin/admins` | ✅ | Role select dropdown |
| `/admin/roles` | ✅ | Multi-select permissions |
| `/admin/settings` | ✅ | |
| `/admin/customers` | ✅ | List + status toggle |
| `/admin/vendors` | ✅ | List + status toggle |
| `/admin/delivery-men` | ✅ | List + create + status |
| `/admin/cashback` | ✅ | CRUD |
| `/admin/wallet-bonus` | ✅ | CRUD |
| `/admin/loyalty-points` | ❌ | Config page missing |
| `/admin/disbursements` | ❌ | Missing |
| `/admin/subscription-packages` | ❌ | Missing |
| `/admin/reports/*` | ❌ | All report pages missing |
| `/admin/activity-logs` | ❌ | Missing |
| `/admin/pos` | ❌ | POS system missing |

### Customer Portal
| Page | Status |
|---|---|
| `/login` | ✅ OTP forgot password |
| `/register` | ✅ |
| `/home` | ✅ |
| `/shop` | ✅ |
| `/checkout` | ✅ COD + Razorpay + Wallet |
| `/profile` | ✅ |
| `/orders` | ✅ |
| `/wallet` | ✅ |
| `/wishlist` | ✅ |
| `/loyalty` | ✅ |
| `/notifications` | ✅ |
| `/addresses` | ❌ Missing |

### Vendor Portal
| Page | Status |
|---|---|
| `/vendor/login` | ✅ |
| `/vendor/register` | ✅ |
| `/vendor/dashboard` | ✅ |
| `/vendor/items` | ✅ |
| `/vendor/orders` | ✅ |
| `/vendor/stores` | ✅ |
| `/vendor/employees` | ✅ |
| `/vendor/roles` | ✅ |
| `/vendor/withdrawal` | ❌ |
| `/vendor/reports` | ❌ |
| `/vendor/pos` | ❌ |
| `/vendor/coupons` | ❌ |
| `/vendor/banners` | ❌ |

### Delivery Man Portal
| Page | Status |
|---|---|
| `/deliveryman/login` | ✅ |
| `/deliveryman` (dashboard) | ✅ |
| `/deliveryman/wallet` | ❌ |
| `/deliveryman/profile` | ❌ |

### Warehouse Portal
| Page | Status |
|---|---|
| `/warehouse/login` | ✅ |
| `/warehouse/dashboard` | ⚠️ Authenticated profile shell; operations UI pending |
| `/warehouse/stock` | ❌ |
| `/warehouse/requests` | ❌ |
| `/warehouse/transfers` | ❌ |

### Supplier Portal
| Page | Status |
|---|---|
| `/supplier/login` | ✅ |
| `/supplier/set-password#token` | ✅ Admin-generated one-time link; manual sharing (SMTP not configured) |
| `/supplier/register` | ✅ Business/tax, billing/shipping, contact, bank, terms and document submission |
| `/supplier/dashboard` | ✅ Open PO count, outstanding balance and last payment |
| `/supplier/orders` | ✅ Order list and detail (supplier processing workflow pending) |
| `/supplier/invoices` | ✅ Invoice list/detail and private supplier invoice upload/download |
| `/supplier/payments` | ✅ Payment history |
| `/supplier/profile` | ✅ Read-only registration profile |

---

## What's Missing — Prioritized

### P1 — Critical gaps
| Feature | Backend | Frontend |
|---|---|---|
| Admin Employee login (separate URL `/admin/employee-login`) | ✅ same identity flow | ✅ shared admin login form |
| Module-based sidebar and API permission checks | ✅ | ✅ |
| Vendor Employee auth + CRUD | ✅ | ✅ |
| Customer addresses page | ✅ API ready | ❌ |
| DM wallet + earnings page | ✅ API ready | ❌ |
| DM profile edit page | ✅ API ready | ❌ |
| Warehouse portal (login + dashboard + stock) | ✅ API ready | ⚠️ Login/profile shell; operations UI pending |
| Supplier portal core APIs (Identity + Procurement) | ✅ | ✅ Browse dashboard, orders, invoices, payments and profile |
| Supplier password setup link (one-time, admin-generated) | ✅ | ✅ |
| Supplier public registration | ✅ Procurement API and UI; uploads stored in procurement storage volume |
| Supplier order quantity processing and challan upload | ❌ | ❌ |
| Supplier product CSV workflow | ❌ | ❌ |

### P2 — Important
| Feature | Backend | Frontend |
|---|---|---|
| Admin: Loyalty points config | ❌ | ❌ |
| Admin: Disbursement management | ❌ | ❌ |
| Admin: Subscription packages CRUD | ❌ | ❌ |
| Admin: Reports (sales, stock, GST, expiry) | ❌ | ❌ |
| Admin: Activity logs | ❌ | ❌ |
| Vendor: POS system | ❌ | ❌ |
| Vendor: Employee management | ❌ | ❌ |
| Vendor: Withdrawal requests | ❌ | ❌ |
| Vendor: Coupons + Banners | ❌ | ❌ |
| Vendor: Reports | ❌ | ❌ |

### P3 — Nice to have
| Feature | Notes |
|---|---|
| POS system (admin + vendor) | Complex, defer |
| Chat / Conversation | WebSocket needed |
| PDF invoice generation | mPDF equivalent |
| Excel export | Maatwebsite equivalent |
| Multi-language / Translation | i18n |
| SMS / Email / Firebase config | Settings page |
| Social login (Google/Facebook) | OAuth |
| Parcel delivery order type | Separate module |
| Membership / Subscription plans | Customer-facing |
| Referral code system | Marketing |

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
| Payments | Razorpay (done), others planned |

## Service Ports (Docker)

| Service | Port | Status |
|---|---|---|
| API Gateway | 3000 | ✅ |
| Frontend | 3001 | ✅ |
| Backend monolith | 5000 | ✅ |
| MongoDB | 27017 | ✅ |
| Redis | 6379 | ✅ |

## Coding Rules

1. Backend: `routes → controller → service → model` pattern
2. Response: `{ success, data, message }` always
3. Pagination: `{ data, pagination: { total, page, limit, pages } }`
4. No cross-domain populate — use HTTP calls between domains
5. JWT verified at middleware, controllers trust `req.user`
6. MongoDB transactions for all stock-changing operations
7. All monetary values stored as `Number` (not Decimal128)
8. Frontend: TanStack Query for API calls, Zustand for auth state
9. Permission check: `role.modules` array contains module key → access granted
10. Master admin (`legacyId: 1`) bypasses all module checks
11. Legacy numeric `Admin.roleId` values are resolved through `AdminRole.legacyId` at runtime; no database rewrite is required

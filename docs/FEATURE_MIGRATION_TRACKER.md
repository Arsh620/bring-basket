# Feature Migration Tracker

Status describes the source-level audit and inspected repository as of 18 November 2026. **Present** means code exists; it does not imply Laravel parity. **Partial** means gaps remain. No full source-data migration or whole-portal parity is claimed.

## Audit baseline

- Full product scope includes all Laravel portals and public/API workflows; route/controller/request/model/Blade parity is not yet enumerated for every workflow.
- Eight actor types were identified: Admin, Admin employee, Vendor, VendorEmployee, Customer, DeliveryMan, PurchaseVendor and Warehouse. Admin and vendor employees use separate roles/session types from their owners.
- Laravel has nine configured auth guards. Live role and permission record counts are unknown until the relevant database is safely inspected.
- Earlier docs report 36 AdminRole keys, 13 VendorEmployee keys, and a read-only Laravel/target role comparison on 18 Nov 2026. These historical database observations have not been revalidated in this audit; preserve existing role assignments and reconcile them deliberately before migration.
- The current static source inventory found 1,680 direct route declarations in the provider-registered files, including 316 in API v1/v2. This is not an expanded runtime route count; `artisan route:list` has a documented bootstrap blocker.
- Source schema counts are not interchangeable: 177 tables in `schema.sql`; 108 distinct migration create names plus 46 distinct alter targets. Applied/live tables are unknown.
- Current target inventory includes 97 Next.js App Router page files and 236 JavaScript files under `backend/src`; neither count proves the corresponding workflow is complete.

## Cross-portal inventory

This table is a feature-family overview. All portals and public/API workflows are in scope; the sequence below is an initial dependency-aware order, not a restriction that delays other portal audits.

| Phase | Laravel workflow | Target area | Status | Remaining work / evidence |
|---|---|---|---|---|
| P0 | Admin login, lockout and role resolution | Identity service + `/admin/login` | Partial | Admin/employee account-type checks, active role resolution, and Laravel's `is_logged_in` restoration on successful login are implemented. Confirm fresh browser login and lockout policy against Laravel. |
| P0 | Super Admin dashboard order stats | Admin dashboard → gateway → Order + Store services | Partial | Week/month/year and module/zone filters scope order analytics; legacy numeric Store references are resolved from selected Mongo module/zone IDs. Live browser/API checks show 1,287 orders, 1,187 delivered, 38 pending, and 30 orders for the tested zone. Asia/Kolkata boundaries and legacy delivery timestamps are covered by focused tests. Laravel today/overall periods and status-event timestamp parity remain unverified. |
| P0 | Admin employee list/create/edit/status | `/admin/admins` + Identity | Partial | Page exists and is labeled Employees; confirm Laravel field parity, zone scope, image upload, delete/export/search and permissions. |
| P0 | Admin custom roles and modules | `/admin/roles` + Identity | Partial | Route guards and the target catalog now use Laravel's separate `custom_role` grant; focused backend authorization tests pass. Verify live role assignments, source validation, CRUD/UI parity and assignment restrictions. |
| P0 | Employee login portal | `/admin/employee-login` | Partial | Route exists; verify employee landing, permitted-module navigation and direct URL/API denial. |
| P0 | Vendor login and management | `/vendor/*` + Identity/Store | Partial | Portal exists; map all Laravel vendor workflows and store ownership. |
| P0 | Vendor employee and custom-role permissions | `/vendor/employees`, `/vendor/roles`, EmployeeRole | Partial | Route guards and the vendor catalog now separate `employee` from `custom_role`; focused tests pass. Verify live vendor-role assignments, source validation and store scoping. |
| P0 | Warehouse login and operations | `/warehouse/*` + Inventory | Partial | Warehouse portal/API exists; verify permissions, stock scopes and workflows. |
| P1 | Supplier login/password setup/procurement | `/supplier/*` + Procurement/Identity | Partial | Supplier PO quantity processing, CSV/XLS/XLSX templates/uploads, vendor-origin bill metadata and PDF challans are now implemented. Verify authenticated UI/API behavior; activity-log/email notification parity and supplier product CSV workflows remain. |
| P1 | Customer login/OTP/profile/addresses | customer routes + Identity | Partial | Verify all Laravel channels and OTP/session/rate-limit semantics. |
| P1 | Rider login/profile/wallet/orders | deliveryman routes + Identity/Order | Partial | Verify app endpoints and rider assignment/state transitions. |

## Admin module families

| Laravel family | Target domain | Status |
|---|---|---|
| Product, category, brand, unit, unit groups, batches | Catalog | Partial; endpoints/pages exist, verify complete CRUD, validation, import/export and all filters. |
| Store, zone, module, store settings/schedule | Store | Partial; verify Laravel configuration and role-scoped behavior. |
| Order, refund, parcel, POS | Order / Payment | Partial; route-by-route parity remains. |
| Warehouse stock, transfers, requests, movements, write-offs | Inventory | Partial; workflows implemented unevenly; reconcile invariants and Laravel status transitions. |
| Purchase vendors/orders/bills/returns/payments | Procurement | Partial; several APIs/UI pages exist; verify accounting invariants and vendor portal. |
| Banners, coupons, campaigns, flash sales, ads, cashback, wallet bonus | Store | Partial; verify scheduling, eligibility, module scope and customer effects. |
| Customers, vendors, delivery men, notifications | Identity / Notification | Partial; verify validation, lifecycle and audit behavior. |
| Business settings, language, payment/social/SMS integrations | Store / Payment / Notification | Partial or not mapped; inventory Laravel route and configuration dependencies. |
| Reports, accounting, subscriptions, trips, vehicles, providers, drivers, rentals | Domain assignment pending | Not audited end to end; map source routes, role modules, data dependencies and portal before implementation. |

## Admin and Super Admin feature audit

**Scope:** the Admin portal is one workstream within the full Laravel migration. This section's detailed admin findings do not reduce the scope: Vendor, Supplier, Warehouse, Customer, DeliveryMan, public web, and API workflows remain in the migration ledger too.

- Laravel's Admin permission helper grants every module to `role_id == 1`, after checking that the Admin has a role and that a zone-scoped Admin is not trying to use the zone-setup module. Other Admins need the requested key in their role's `modules` JSON. `ModulePermissionMiddleware` applies this check to protected routes.
- Laravel's Admin navigation contains 31 distinct module gates: `account`, `addon`, `advertisement`, `attribute`, `banner`, `campaign`, `cashback`, `category`, `collect_cash`, `coupon`, `custom_role`, `customer_management`, `deliveryman`, `employee`, `item`, `module`, `notification`, `order`, `parcel`, `pos`, `provide_dm_earning`, `purchase`, `rental_report`, `report`, `settings`, `store`, `subscription`, `unit`, `warehouse`, `withdraw_list`, `zone`. Runtime role records and assignments still need a read-only source DB check.
- This inventory is based on registered route files and navigation/controller source. `artisan route:list` currently fails during bootstrap on a duplicate dynamically evaluated `ExtendedController`, so expanded runtime routes and live Laravel role/module assignments remain unverified.
- Laravel's navigation changes with `current_module`: store/commerce modules, user management, transactions, dispatch, and business settings have separate contexts. Admin home also supports module and zone scope.
- Current browser session is visibly logged in as **Super Admin** at `/admin/dashboard`. The target displays 5,926 items, 85 categories, 44 brands, 7 stores and 1 warehouse; low-stock is empty; orders show 1,287 total, 1,187 delivered and 38 pending, with ₹2,45,709.49 delivered sales this year. Customer overview shows 90 total, 87 active and 3 blocked. These are current target values, not Laravel values.
- A separate host-side Mongo instance contains a copy of the migrated orders; the application uses the Compose Mongo database. The host-side copy remains untouched until its consumers are verified.
- Target sidebar currently exposes 44 links across Order management (11), Procurement (5), Catalog (6), Stores & delivery (3), Inventory (6), Marketing (5), User management (3), Promotions (2), Access control (2), and Configuration (1). The target has 38 Admin `page.tsx` files, including login/employee pages; these counts do not establish completeness.

| Laravel Super Admin feature family | Source evidence / capabilities | Target comparison and status |
|---|---|---|
| Dashboard and business overview | Zone/module selection; today/week/month/year/overall order stats; new/total items, stores and customers; order states; user overview; sales, admin/delivery commission; top stores/items/customers/delivery staff; reviews. | Target has catalog/store/warehouse counts, low stock, module/zone/week-month-year filters, order-state/refund counts, customer overview and delivered-sales chart. **Partial:** focused tests cover Asia/Kolkata date boundaries, legacy string/numeric/ObjectId module and store IDs, and both `deliveredAt` and legacy `delivered` timestamps; the status panel includes legacy `accepted` orders. The Order service now contains all 1,287 Laravel orders and 3,074 lines, with source status totals; live order detail, pending list and zone-filtered dashboard data are verified. Still missing Laravel's today/overall periods, commission metrics, top-performer/review widgets, and full filter-scoped catalog/store/customer totals. |
| Orders, dispatch, refunds and POS | Order lifecycle/state queues, scheduled/unassigned orders, delivery assignment, payment/offline-payment review, invoice/proof, refunds/reasons, dispatch, parcel orders and settings, POS/held carts. | Target has an Order management group with 11 links and order details. **Partial:** map every action/status transition; POS, refund, parcel and dispatch parity are not shown in the current target Admin navigation. |
| Catalog and merchandising | Items/variants/pricing/stock/reviews, categories, brands, attributes, add-ons, units, common conditions; bulk import/export and review exports. | Products/categories/brands/units/unit groups/batches exist. **Partial:** attribute/add-on/common-condition pages and complete import/export, review, variant and store-item workflows need checking. |
| Stores, zones and modules | Store CRUD/status/settings/schedules, module setup, zone CRUD and module/payment setup per zone, ratings and store filters. | Stores/modules/zones links exist. **Partial:** compare settings, schedules, module types, zone-specific payment and status behavior. |
| Customer, vendor and delivery management | Customer lists/status/wallet/bonus/loyalty/subscriptions/contact; vendor/store lifecycle; delivery applications, vehicles, earnings, reviews and disbursements. | Customer/vendor/delivery lists exist. **Partial:** wallet/loyalty/subscription, vendor lifecycle, rider applications/vehicles/earnings/reviews and contact flows are not represented in current navigation. |
| Promotions and communications | Campaigns, banners, coupons, flash sales, advertisements, cashback, wallet bonus, push notifications and messages. | Most promotion pages exist. **Partial:** verify eligibility, scheduling, module/store scoping, outcomes and notification/message workflows. |
| Inventory and procurement | Mother/sub warehouses and stock; transfers/requests/write-offs; purchase vendors/POs/schemes/issue/processing/receiving/GRN; bills/returns/payments; low-stock/vendor-balance/GST reports. | Warehouse/inventory and core purchase pages exist. **Partial:** reconcile all Laravel steps, reports, GRN/accounting invariants, imports/exports and UI actions. |
| Finance, reports and accounting | Cash collection, delivery earnings, withdrawals and disbursements; sales/stock/expense reports; payables, GST registers, ledgers, journals, trial balance, P&L, balance sheet and cash book. | No full equivalent visible in current Admin navigation. **Gap to map:** identify existing service endpoints/pages, then migrate in this phase. |
| Business configuration and operations | Business setup, system/app/landing/login settings, languages, payment/social/SMS/email integrations, file manager, notification channels, subscriptions and add-ons. | One Business Settings link exists. **Partial:** enumerate settings by page and integration; do not treat the generic page as parity. |
| Admin employee and custom roles | Employee CRUD/export and custom-role CRUD are distinct (`employee` vs `custom_role`) module gates; employee creation selects an active custom role, and that role's module JSON determines access. Source DB currently has the roles and assignments listed in the audit baseline. | Target has role/employee APIs, a module permission catalog, route guards and tests. The role options endpoint uses the `employee` gate and recognizes imported numeric `1` and Boolean `true` active statuses. Employee creation now uses the same legacy-aware active-role check instead of a Mongo query that rejected the selected numeric status. Latest live selector check returned 7 assignable roles. **Partial:** retest the Add form with a unique email/phone, then verify role-specific permitted/denied UI+API behavior. Source/target assignment counts differ as noted above; no records were changed. |
| Rental and optional modules | Rental reports/routes are conditional on the Rental add-on. | Source implementation is absent from this Laravel checkout; **blocked** until its code is available. |

### Initial implementation order across the full application

1. **Admin access and employee roles (active prerequisite)**: Laravel/target role module grants have been compared; eight legacy roles match, while target has an extra Super Admin role and differing Master-admin assignments. The latest live employee role-options check returned 7 assignable roles. Employee creation now accepts active legacy role status `1`; the Add form still needs an end-to-end retry with a unique email/phone. A successful Admin login restores Laravel's `is_logged_in` flag; focused role tests pass. Next verify create/edit and role-based UI/API allow/deny behavior using safe test accounts.
2. **Dashboard parity (in progress)**: the first slice is live with migrated orders—module/zone/week-month-year filters, order-state/refund totals and period-wise delivered sales—through Order and Store services. Complete Laravel's today/overall periods and verify user, sales/commission calculations against Identity/Accounting data; then add the remaining top-performer/review widgets and filter-scoped catalog/store/customer totals.
3. **Commerce operations**: orders, dispatch, payment review, refunds, parcel and POS; preserve Laravel state transitions and role authorization.
4. **Catalog and platform setup**: item/category/attribute/add-on/unit workflows, imports/exports, stores, zones and modules.
5. **Admin-managed business actors**: customers, vendors and delivery staff, including their lifecycle and financial subflows.
6. **Inventory, procurement, finance and reports**: complete receipts/returns/payments and reconcile accounting totals before reporting.
7. **Business configuration and integrations**: settings pages and each enabled provider/channel, with secrets kept out of source/docs.
8. **Complete each remaining portal and API surface:** Vendor, Supplier, Warehouse, Customer and DeliveryMan keep their own auth, role types, ownership scopes and workflow acceptance evidence; do not treat Admin completion as a prerequisite for auditing them.

Do not mark a family complete merely because its target page renders. Completion requires an authenticated Super Admin UI/API workflow test, data/state comparison to Laravel, and checks for invalid transitions and service failures.

## Business-family status

| Laravel family | Current target owner(s) | Status | Minimum remaining audit |
|---|---|---|---|
| Marketplace/catalog and store setup | Catalog, Store | Partial | Map each admin/customer/vendor route, validation, taxonomy relation, pricing, schedule, promotion and module grant. |
| Customer commerce | Identity, Order, Payment, Store | Partial | Trace registration/OTP, cart/checkout, discounts, wallet, payment/refund, order state, reviews and notifications end to end. |
| Vendor/store operations | Identity, Store, Catalog, Order, Inventory | Partial | Trace owner/employee login, subscriptions, items, orders, POS, delivery staff, stock requests, settlement and reports. |
| Delivery operations | Identity, Order, Accounting/Payment | Partial | Map rider assignment, status transitions, earnings/disbursement, vehicle/review, app API and authorization. |
| Warehouse/inventory | Inventory, Procurement | Partial | Verify mother/sub scopes, batches, movements, transfers, requests, receipt/GRN and stock reconciliation. |
| Supplier procurement/accounting | Procurement, Identity, Accounting | Partial | Complete PO processing/challan, supplier product CSV, bills, attachments, returns, payments, ledgers and reports. |
| Rental/trips | Unassigned | Blocked for source parity | The Laravel checkout lacks the referenced `Modules\\Rental` implementation; obtain its source before migration. |

## Phase gate and completion evidence

For every row, link the Laravel route/controller/request/model, target UI route, gateway path, owning service/controller/model, module/role guard and data mapping. Record validation and status-transition differences. Mark **Complete** only after API and UI behavior has been checked with the relevant actor and unauthorized access has been checked. Record blocker and evidence in the row; never infer complete from a page rendering.

## Immediate next implementation slice

**Current: full-scope route-to-target reconciliation.** Historical notes below document earlier Admin and Supplier slices; their browser/database/test claims have not been freshly verified in this continuation. Next, maintain one route/workflow ledger across all registered Laravel files, map each to the target page/gateway/service and permission/data owner, then implement in end-to-end slices. The present objective includes all portals, customer/public/API flows, integrations and data behavior; no portal is excluded pending Admin completion.

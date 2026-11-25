# Full Laravel to Next.js / Node.js Migration Audit

**Source:** `C:\laragon\www\bring-basket\landing`  
**Target:** `D:\bring-basket-fb`  
**Audit type:** Static source inventory; no application code, database, or secrets inspected.

## Goal and scope

Bring the Laravel application's customer, admin, vendor, vendor employee, supplier, warehouse, and delivery workflows into the existing Next.js and Node.js project. Preserve business behavior, access rules, validation, data relationships, status transitions, integrations, and user-visible outcomes. Improve organization as features are migrated; avoid a wholesale rewrite of already working target services.

## Source and target baseline

| Area | Laravel source | Current target |
|---|---|---|
| Frontend | Blade views and Laravel Mix | Next.js App Router, React, TypeScript (`frontend/src/app`) |
| Backend | Laravel 10 modular monolith, controllers/services/repositories | Express compatibility API plus domain service containers |
| Route surface | 1,889 literal `Route::...` references across `routes/`; this includes extra/unregistered route files and is not an expanded runtime route count | Gateway API prefix `/api/v1`, backend routes and domain services |
| Controllers / backend files | 206 Laravel controller files | 236 JavaScript files under `backend/src` |
| Models | 155 Eloquent model files | MongoDB models across backend and service containers |
| Schema history | 213 migration files; `schema.sql` is a separate snapshot | MongoDB and Redis configured in Docker Compose; MySQL import tooling exists |
| UI templates / pages | 844 Blade view files | 97 Next.js `page.tsx` files |
| Form Requests | 43 | Validation exists across backend controllers/services; parity needs route-level review |
| Services / repositories | 59 services and 25 repository files | Domain-oriented services in backend and separately deployable containers |

Counts describe files or static route calls, not complete or verified feature parity. Existing target migration documents use earlier counts and should be treated as historical snapshots where they differ from this inventory.

### Registered Laravel route declaration inventory

`RouteServiceProvider` registers `web.php`, `supplier.php`, `warehouse.php`, `admin.php`, `vendor.php`, API v1/v2, and the additional `admin/routes.php`. A static count of direct route declarations in those files is:

| Registered file | Direct declarations |
|---|---:|
| `routes/admin.php` | 704 |
| `routes/admin/routes.php` | 207 |
| `routes/vendor.php` | 219 |
| `routes/warehouse.php` | 109 |
| `routes/supplier.php` | 27 |
| `routes/web.php` | 97 |
| `routes/api/v1/api.php` | 316 |
| `routes/api/v2/api.php` | 1 |
| **Total** | **1,680** |

These are literal declarations (including resource/controller macros as single declarations), not the number of expanded HTTP method/path combinations. `routes/rest_api/v1/*` and other files under `routes/` are not included in that registered-file total. Runtime registration remains unverified.

## First-pass portal coverage map

This compares route/page presence only. A target page or endpoint is evidence of an implementation location, not proof of feature parity.

| Laravel area | Target locations observed | First-pass status |
|---|---|---|
| Admin (704 + 207 direct declarations) | 50+ admin pages across dashboard, employees/roles, catalog, orders, store/zone, inventory, procurement, POS, settings, reports and marketing | Broad but partial. Admin POS has store-scoped catalog/cart/scan/held-cart/order flows and zone-restricted store selection. Variant and food-option/add-on selection now has a frontend dialog and backend catalog-price validation; quantity changes reprice item discounts and buy/get offers while enforcing offer minimums and product cart limits. Order reservations now consume tracked store batches first-expiring-first-out and restore those allocations on release. Loyalty/membership and Pine Labs remain. The rest of the route surface is much larger than the page set; map each module gate and mutation to its owning API before calling it complete. |
| Customer web and API | Home/shop, login/register, checkout, orders, profile, wallet, loyalty, notifications, wishlist pages; customer/catalog/order/identity/retention API routes | Partial. Verify address/cart flows, storefront filters, payment callbacks, order lifecycle/refund and API/mobile-only contracts. |
| Vendor (219 declarations) | Dashboard, login/register, items, orders, employees/roles, reviews, stores, stock requests, wallet; POS item/cart/order APIs and `/vendor/pos` | Partial. The current POS slice covers store-scoped product search, barcode/SKU scans (including weighted labels), held carts, customer selection, counter sales and delivery orders with a server-calculated coverage/fee quote. Variant and food-option/add-on selection now has a frontend dialog and backend catalog-price validation; quantity changes reprice item discounts and buy/get offers while enforcing offer minimums and product cart limits. Tracked batch stock is reserved first-expiring-first-out and restored on release. Pine Labs, loyalty/membership and subscription enforcement still need parity work. Also map settings/schedule, delivery staff, payout/report and catalog maintenance workflows. |
| Supplier (27 declarations) | Login/register/password setup, dashboard, orders, invoices, payments, products, profile | Partial. Validate uploads, document access, order processing, invoice/challan generation, notifications and supplier scoping end to end. |
| Warehouse (109 declarations) | Login, dashboard, expiry, purchases, requests, stock, subs, transfers | Partial. Validate mother/sub authorization, receiving, transfer state transitions, batch stock, order fulfillment and exports. |
| DeliveryMan | Login and deliveryman root page; backend deliveryman routes and identity/order domains | Partial. Confirm profile, assignment, delivery transitions, wallet/earnings, history, and mobile API behavior. |
| Public web / payment | Home/shop plus payment domain endpoints | Partial. Laravel has policy/info pages and multiple provider callback routes; audit redirects, webhook signatures, idempotency and user-visible outcomes. |

The page inventory currently has no clearly named standalone pages for several Laravel public policy pages and some vendor workflows. They may be rendered through shared components or APIs; verify source-to-target behavior before treating them as missing or complete.

## Work completed during this audit

- Reconciled the provider-registered route file list and counted 1,680 direct route declarations. Updated the feature tracker so its active scope covers all portals instead of deferring every non-admin portal until Super Admin work is complete.
- Added a Vendor POS page using the POS domain API, with store selection, paginated product search, barcode/SKU scan (including weighted labels), customer lookup, cart quantity/removal, held carts, payment method and order placement.
- Bound Vendor POS sessions and held carts to the authenticated actor and authorized store, enforced the Laravel `pos` module gate for employees, and rejected products from another store or inactive/unapproved items. Recalculated POS cart tax/discount amounts using target catalog fields when quantity changes.
- Added a delivery workflow with required contact/address/coordinates, store coverage validation, server-calculated shipping fee and distance, customer-required order placement, and order/payment values that match the target Order model enums. Reused the Order domain's delivery quote logic rather than trusting a browser-supplied fee.
- POS order placement now creates the target Order shape, reserves and commits stock through Inventory, and releases a reservation/marks the order failed if later processing fails.
- Added Admin POS store selection scoped to the admin's assigned zone, and brought Admin onto the same store-scoped catalog/cart/scan/hold/delivery API contract as Vendor POS.
- Added a shared POS product-options dialog used by Admin and Vendor for Laravel-style food variation groups, regular item choice variants and add-on quantities. The POS service validates selected labels/variant availability and prices add-ons from the store catalog; order lines retain the selected variant/options/add-ons.
- Matched POS buy-X/get-Y retail offer discounts and minimum offer quantities with the existing order pricing rule, enforced item maximum-cart quantities across variant lines, recalculated discount/tax totals from catalog rules when a cashier changes quantity, and kept the source offer label visible on cart lines. Barcode/weighted-label lookup now returns the same option and offer metadata as catalog search.
- Integrated tracked item batches into the order stock reservation transaction: sellable batches are consumed by earliest expiry with non-expiring batches last, batch allocations are persisted with the reservation, and cancellations/failures restore the original batches while syncing the catalog stock quantity.

These are partial workflow slices; they do not establish whole-portal or whole-application parity. No tests or runtime/database checks were run in this audit continuation.

## Feature families in scope

1. **Identity and access:** Admin and Admin Employee; Vendor and Vendor Employee; Customer; DeliveryMan; PurchaseVendor/Supplier; Warehouse. Preserve each guard/session/token model, login/reset flows, role/module permissions, account status, throttling, and resource scope.
2. **Marketplace and catalog:** zones, modules, stores, items, categories, brands, attributes, units, add-ons, variants/batches, schedules, campaigns, coupons, reviews, merchandising, search and customer storefront.
3. **Customer commerce:** profile, OTP/password, addresses, cart, checkout, payment, orders, cancellation/refunds, wallet, cashback, loyalty/membership, notifications and history.
4. **Admin operations:** dashboards, employees and custom roles, stores/zones, catalog, orders, customers, delivery staff, POS, configuration, reports, notifications, business settings, language and integrations.
5. **Vendor operations:** store configuration, employees/roles, catalog, orders, POS, delivery staff, stock requests, wallet/payouts, subscriptions and reports.
6. **Warehouse and inventory:** mother/sub-warehouses, stock, batches/expiry, movements, transfers, store requests, purchasing/receiving, write-offs and reports.
7. **Supplier and procurement:** onboarding, credentials/profile/documents/banks/products, purchase orders, bills/GRN, payments, returns, challans and supplier reporting.
8. **Delivery operations:** rider profile/authentication, order assignment and transitions, vehicle/reviews, wallet, disbursements and API/mobile workflows.
9. **Finance and platform integrations:** journals/ledgers, GST, expenses, wallet settlement, payment gateways (including Razorpay/Pine Labs where available), SMS/email/push, uploads/storage, PDF/CSV/XLS exports, queues and realtime events.

The Laravel checkout's `Modules/` directory and external Pine Labs SDK dependencies may limit source verification for some optional modules. Their workflows should be marked unknown until source/configuration is available, not reconstructed from a feature name alone.

## Existing target structure

- `frontend/`: Next.js App Router and portal pages/components.
- `gateway/`: API gateway and shared edge concerns.
- `backend/`: existing Express compatibility/API layer, organized by domains under `backend/src/domains`.
- Service containers: `identity-service`, `catalog-service`, `store-service`, `inventory-service`, `procurement-service`, `order-service`, `accounting-service`, `payment-service`, and `notification-service`.
- `docs/`: migration, architecture, database, and feature tracker material.

The target already contains substantial implementations. A file or page existing does not establish that the Laravel route's permission, data behavior, validation, edge cases, or UX is complete. Keep rules in the owning domain/service; keep controllers thin; keep frontend API access and portal UI organized by domain. Every write must be authorized at the backend and scoped to the actor's store, warehouse, or other owned resource.

## Migration sequence

1. **Build the source-to-target ledger:** enumerate registered route groups and route names, middleware, controller actions, request validation, persistence/models, view/workflow, and matching target endpoint/page. Resolve duplicate or dynamically registered route behavior where safe. The raw route-call count is not sufficient evidence.
2. **Lock down shared foundations:** actor/guard mapping, role and module catalogs, API response/error conventions, pagination, uploads, audit logs, notification/event handling, and explicit owner for each data entity.
3. **Migrate and verify by complete workflows:** finish each screen/API/data/permission path as a vertical slice. Suggested order: identity and admin control plane; catalog/store; customer browse/cart/checkout; orders/payments/refunds; inventory/warehouse; procurement/supplier; vendor operations; delivery; accounting/reporting; remaining settings/integrations.
4. **Reconcile data deliberately:** map MySQL tables and keys to target models, plan repeatable import and ID preservation, identify transactional invariants, and reconcile live role/permission assignments before changing production records. Do not run imports or source migrations as part of static analysis.
5. **Track acceptance per workflow:** only mark complete when routes, authorization, validation, persistence, state transitions, error/success UX, and portal/resource scoping have been matched and verified. Keep partial/unknown states explicit.

## Repository safety and current limits

The target Git working tree already has many modified and untracked files. Those changes were present during this audit and must be preserved; inspect relevant diffs before editing overlapping implementation files. The source `.env` and target `.env` were not read. No tests, Laravel commands, database connections, imports, or destructive operations were run.

This inventory is the baseline for route-by-route parity work, not a claim that all features have been migrated. Next POS gaps include stock-batch selection, loyalty/membership, Pine Labs, and full source parity for POS discounts and receipts. Continue reconciling Laravel route groups and view workflows against the target before taking the next workflow slice, while preserving the pre-existing worktree changes.

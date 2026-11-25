# Laravel to Next.js + Node.js Migration Analysis

**Status:** source-level baseline inventory; detailed route/workflow parity remains in progress, 18 November 2026  
**Source:** `C:\laragon\www\bring-basket\landing` (read-only during this analysis)  
**Target:** this repository (`frontend/`, `gateway/`, domain services, MongoDB and Redis)

## Executive summary

The target is an in-progress Next.js App Router frontend with Express/Node.js services and MongoDB, not a NestJS application. Keep the working service boundaries and migrate Laravel behaviours into them incrementally. Do not rewrite the services in NestJS as a prerequisite: that would add migration risk without delivering Laravel feature parity.

Laravel source inventory (static filesystem counts from the checked-out source):

| Area | Count | Notes |
|---|---:|---|
| Controllers | 206 | `app/Http/Controllers` |
| Eloquent models | 155 | `app/Models` |
| Migrations | 213 | `database/migrations` |
| Blade templates | 841 | `resources/views` |
| Form Requests | 43 | `app/Http/Requests` |
| Service classes | 59 | `app/Services` |
| Repository classes | 25 | `app/Repositories` |
| Route calls in provider-registered files | 1,665 | Static calls/macros; not expanded runtime routes |
| `schema.sql` tables | 177 | Snapshot DDL; not proof of live database tables |
| Distinct migration `Schema::create` tables | 108 | 213 migration files; later schema changes add/alter tables |
| Distinct migration `Schema::table` targets | 46 | 253 static `Schema::table` calls |

The eight route files registered by `RouteServiceProvider` contain 1,665 literal `Route::` calls/macros. The two API route files contain 316 calls in total (315 in API v1 and 1 in API v2); these counts are not expanded routes or a complete API endpoint count. `routes/rest_api/v1/*` exists but is not registered by the inspected provider. `php artisan route:list --json` previously failed during bootstrap because `PaymentController.php` dynamically evaluates a duplicate `ExtendedController` class. Resolve that in an isolated Laravel analysis copy before treating route totals as runtime totals.

The schema sources disagree: `schema.sql` has 177 `CREATE TABLE` statements, while the migrations have 108 distinct literal `Schema::create` names plus 46 distinct `Schema::table` targets. The applied migration state and live table count are unknown until a read-only database inventory is approved and run. The AdminRole and vendor-role records are also database-driven; do not infer live role counts or permission assignments from seeders. The target's permission catalog must be reconciled with Laravel middleware; in particular, Laravel has distinct `custom_role` and `employee` gates.

Permission/role counts must also be labelled by source: the target code now has 36 AdminRole permission keys and 13 VendorEmployee permission keys. A previous read-only MongoDB inspection recorded nine active target AdminRole entries (legacy IDs 1–8 plus a separate Super Admin entry). This is not a verified count of live Laravel role rows; the source database remains unqueried.

## Portals and login boundaries

| Laravel portal / actor | Target location | Identity and authorization notes |
|---|---|---|
| Super Admin / admin | `/login/admin`, `/admin/*` | `admins` identity + `admin_roles`; `role_id == 1` bypasses module checks. |
| Admin employee | `/login/admin-employee`, `/admin/*` | Same admin guard, non-master AdminRole; employee CRUD uses `employee`, role CRUD uses `custom_role`. |
| Vendor / store owner | `/login/store`, `/vendor/*` | Vendor identity, store ownership, subscription and store-feature restrictions. |
| Store employee | `/login/store-employee`, `/vendor/*` | Separate `vendor_employee` guard and `EmployeeRole`; employee and custom-role routes have distinct module gates. |
| Customer | Customer web/mobile/API | Customer identity; OTP/password and session flows vary by channel. |
| Delivery rider | Rider app/API | `delivery_men` identity and rider order/wallet workflows. |
| Supplier | `/supplier/login`, `/supplier/*` | `purchase_vendor` identity, password setup and procurement scope. |
| Warehouse staff | `/warehouse/login`, `/warehouse/*` | `warehouse` identity; mother/sub-warehouse scope differs. |

These are eight actor types, not eight independent back-office applications: admin employees share the admin portal, and store employees share the vendor portal. `config/auth.php` defines nine guards in total, including the general `web` and `api` guards. Customer and rider interfaces are primarily customer-web/mobile/API and rider-app/API workflows, not the same kind of back-office panel as Admin or Warehouse.

The Laravel route tree includes admin, vendor, warehouse, supplier, web, customer REST API, vendor REST API, rider REST API, API v1 and API v2. Each needs its own route and workflow mapping; sharing an email/password form does not make these actors interchangeable.

## Authorization behaviour observed

Laravel admin routes combine `admin`, `current-module` and per-route `module:<key>` middleware. AdminRole's module column controls both what modules the user can access and which operations the admin routes expose. The checked-in routes explicitly gate employee CRUD with `module:employee` and admin custom-role CRUD with `module:custom_role`; vendor routes do the same for their employee and custom-role workflows. `ModulePermissionMiddleware` delegates those keys to `Helpers::module_permission_check()` or `Helpers::employee_module_permission_check()`.

Target checks live in `backend/src/middleware/auth.js`. The audit found the target granting `employee` to admin/vendor role-management endpoints and omitting `custom_role` from both permission catalogs. This slice now separates those route guards, adds the catalog key, and verifies the behavior with focused backend tests. `/admin/admins` and `/vendor/employees` remain employee-management workflows; `/admin/roles` and `/vendor/roles` are separate custom-role workflows. Full parity and live role assignments remain unverified.

Laravel identifies `role_id == 1` as the admin bypass; target role documents use `legacyId: 1` for the protected master role. Other live role names, assignments, module values and vendor roles must be verified against the relevant database before migration.

## Major business feature families identified

The route/controller/model/service pass identifies these seven source families. This is a domain-family inventory, not a claim that every route or business rule has been mapped:

1. Marketplace/catalog and store setup: modules, zones, stores, items, taxonomy, add-ons, units and merchandising.
2. Customer commerce: customer accounts, addresses, cart, checkout/orders, refunds, reviews, wallet/cashback, loyalty and membership.
3. Vendor/store operations: store settings, vendor employees/roles, catalog, orders, delivery staff, POS, stock requests, wallet/payouts, subscriptions and reports.
4. Delivery operations: rider login/profile, order assignment and status, vehicles, reviews, wallet/disbursements.
5. Warehouse/inventory: mother/sub warehouses, stock, batches, movements, transfers, store requests, purchase receiving and reports.
6. Supplier procurement/accounting: supplier onboarding/profile/documents/banks/products, purchase orders, bills, payments, returns, journals/ledgers and reports.
7. Rental/trips: referenced by module/configuration and target permission keys, but the corresponding `Modules\Rental` implementation is absent from this Laravel checkout.

## Existing target inventory

- Next.js frontend: `frontend/src/app` and `frontend/src/components/admin`.
- The inspected target has 74 `page.tsx` files under the App Router and 180 JavaScript files under `backend/src`; page/file presence is not feature parity.
- Gateway: `gateway/src`, public API prefix `/api/v1`.
- Node/Express backend compatibility/API layer: `backend/src`.
- Domain service containers: identity, catalog, store, inventory, procurement, order, accounting, notification and payment.
- MongoDB and Redis are in `docker-compose.yml`; most services currently reference a shared `bring_basket` database while order uses `bring_basket_order`.
- `docs/laravel-to-microservices-alignment.md` and `docs/inventory-api-design.md` are useful historical plans, but their status statements must be rechecked against code before being treated as current.

## Known analysis limits / blockers

1. Laravel artisan route registration fails at bootstrap due to the duplicate dynamically evaluated class noted above; use static route files meanwhile.
2. Live database role counts, exact role-module assignments and applied schema state depend on the source database; they are not safely derivable from PHP definitions or the SQL snapshot.
3. `Modules\` contains only `info.txt` although enabled module metadata and imports reference Rental/Gateways code. Those workflows cannot be source-audited from this checkout.
4. A sibling PineLabs SDK path is referenced outside the Laravel project; payment behavior depending on it needs separate source availability.
5. A shared Mongo database across several services is not strict database-per-service isolation. Document ownership and cross-service access need to be tightened as workflows are migrated.
6. A frontend control is not proof of backend authorization. Every migrated operation must be gated at the owning service/API.
7. Feature/controller-to-screen mapping remains incomplete; the feature tracker deliberately marks broad families Partial until each route, validation, status transition, permission and workflow is verified.

## Migration acceptance rule

Mark a Laravel workflow complete only after route, permission, validation, persistence, status transitions, user-visible success/error states and portal-specific scoping have been mapped and verified. See `FEATURE_MIGRATION_TRACKER.md` for the working ledger.

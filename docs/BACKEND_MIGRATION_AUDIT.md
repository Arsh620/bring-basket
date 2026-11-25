# Backend Migration Audit

**Scope:** Laravel source of truth compared with the existing Node backend and Docker services.  
**Status:** inventory and first routing gap fix, 19 November 2026.  
**This is not a parity/completion claim.**

## Current backend shape

- The target is currently **Express**, not NestJS. No `@nestjs/*`, `NestFactory` or Nest controllers are present in the inspected service code. The requested NestJS target remains a migration item.
- Business code lives primarily in `backend/src` (265 repository files: 128 domain files, 71 model files, 19 route files, and middleware/config/utils). The top-level domain service directories mostly contain only an `index.js` and a Dockerfile; their Dockerfiles copy selected files out of `backend/src`.
- Compose runs a compatibility backend on port 5000, gateway on 3000, nine domain services (Identity, Catalog, Store, Inventory, Procurement, Order, Accounting, Notification and Payment), frontend, MongoDB and Redis: 14 Compose services total.
- Service Dockerfiles use the backend package manifest and lockfile. They are separate containers, but not independently versioned Node packages yet.
- There are 602 route-registration lines in `backend/src/routes/v1` by static method scan. Laravel has 1,686 static route-method declaration lines across route PHP files (HTML/admin and API included); these counts are not equivalent endpoint totals. Laravel `artisan route:list` currently fails during bootstrap on a duplicate dynamically evaluated `ExtendedController` class.
- `schema.sql` contains 177 `CREATE TABLE` declarations. It includes Laravel/internal and backup tables; use the source migrations and selected source DB schema to determine the application-owned table set before import.

## Service coverage and current boundaries

| Service | Current code / routed responsibility | Remaining backend work |
|---|---|---|
| Gateway | JWT/rate limiting and path-prefix proxy to domain services and compatibility backend | Add explicit OpenAPI/gateway contract, request correlation/timeouts, and route map parity. Initial missing paths fixed below. |
| Identity | Admin/customer/vendor/supplier/rider/warehouse auth, admin employee and role APIs, vendor employee access | Match all Laravel guard/session/password flows, separate AdminRole vs Vendor EmployeeRole, email/file workflows, and verify all actor-specific scopes. |
| Catalog | Brands, categories, items, units/unit groups/conversions, batches, customer catalog | Audit Laravel imports/exports, translations, add-ons, item subtypes, reviews and write-off/batch rules. |
| Store | Stores/zones/modules, customer store discovery, campaign/marketing/config endpoints | Finish store lifecycle/configuration, subscriptions, admin settings, financial disbursement and report parity. |
| Inventory | Warehouses/stock/movements/transfers/store requests/write-offs and order reservation internals | Reconcile all warehouse and store-stock invariants, expiry/write-off paths and Laravel upload/GRN behavior. |
| Procurement | Purchase vendors/products/orders/bills/returns/payments and supplier portal | Audit import/export, receipts/dispatch, supplier invitation and password setup, invoices, validation and financial reconciliation. |
| Order | Cart/customer order/admin order and internal vendor/dashboard workflows | Map every Laravel order status, schedule/parcel/refund/assignment/cancellation/payment edge case and exact role restrictions. |
| Accounting | Customer wallet/loyalty and admin customer/cashback/wallet-bonus APIs | Separate retention/membership and admin accounting journals; verify all ledger invariants, reports and idempotency. |
| Notification | Customer/rider notification reads and admin broadcast | Verify FCM, email/SMS templates, preferences, receipt/delivery status, retries and Laravel notification channels. |
| Payment | Razorpay endpoints and webhooks | Map offline payments, other configured providers, refunds, signature checks and reconciliation. |
| Compatibility backend | Remaining vendor, delivery-man, settings/config, admin CRUD, POS, accounting/retention and warehouse routes | Continue moving each route family to one owner; remove fallback only after callers and parity are verified. |

## Concrete gateway reachability gaps found and fixed

The backend compatibility router registers `/admin/pos`, `/admin/account`, `/admin/membership`, `/admin/loyalty`, `/admin/wallet` and `/warehouse` APIs. None had a corresponding gateway prefix, so those handlers could exist and still return the gateway 404 to browser clients. Added gateway forwarding for:

- `/api/v1/admin/pos`
- `/api/v1/admin/account`
- `/api/v1/admin/membership`
- `/api/v1/admin/loyalty`
- `/api/v1/admin/wallet`
- `/api/v1/warehouse`

The more specific Identity `/api/v1/warehouse/auth` route stays registered before the broad warehouse prefix, so warehouse authentication continues to use Identity. These routes remain on the compatibility backend until Inventory/Accounting/Order service contracts take ownership.

## Laravel-wide backend gaps to audit feature by feature

Laravel has 206 controllers, 155 models, 213 migrations, 59 service classes and 25 repository classes. It also contains multiple API versions, admin/vendor/warehouse/supplier web route files, customer/vendor/rider REST route files, 36 mail classes, file upload workflows and payment/provider integrations. The target already contains useful business code, but route presence alone does not establish parity.

Particular parity risk areas identified from source organization:

1. Admin business settings, reports, account journals, POS, membership/retention, subscriptions and disbursements are split or remain in compatibility routes.
2. Vendor and rider APIs currently proxy to compatibility backend rather than fully owned services.
3. Warehouse portal combines inventory and procurement handlers under the compatibility router.
4. Laravel has nine auth guards: `web`, `admin`, `vendor`, `vendor_employee`, `api`, `customer`, `delivery_men`, `purchase_vendor`, `warehouse`. The interactive actor portals are admin, customer, vendor, vendor employee, rider, purchase supplier and warehouse; `web`/`api` are guards, not extra business roles.
5. Laravel custom admin roles expose 35 selectable module keys in the create-role Blade form. `custom_role` is a route capability but is not one of those selectable module keys; the primary admin role bypasses module filtering. Do not grant that capability through an invented module option.
6. Laravel has an empty scheduled-command schedule in `app/Console/Kernel.php`; do not add a message broker solely to reproduce a schedule that has no active tasks. Source queue configuration and mail/provider workflows still need review.
7. No OpenAPI/Swagger definitions were found in the inspected backend manifests/source; add API contracts per service as part of backend completion.
8. Compose currently points all domains except Order at the same `bring_basket` Mongo database. This is not database-per-service isolation; collection ownership and compatibility access must be defined before further separation.

## Service ownership rules for the migration

1. Keep one canonical implementation for each route family; the compatibility app may proxy, but must not be a second independently evolving business implementation.
2. Identity owns actor credentials, roles, sessions/tokens and access checks. It must not own product, stock, order or financial truth.
3. Catalog owns product definitions; Store owns store/config/marketing; Inventory owns stock quantities/movements; Procurement owns purchase lifecycle; Order owns customer order state; Payment owns provider transactions; Accounting owns the ledger; Notification owns delivery.
4. Use explicit REST contracts for synchronous calls. Add asynchronous delivery only for real cross-domain notification/event needs, with idempotency and retry/dead-letter handling.
5. Keep JWT identity and module authorization consistent at the gateway and owning service. Gateway verification is not a substitute for domain authorization.
6. Define collection/table mappings and legacy identifiers before moving writes. Do not let multiple services independently mutate another service's collection.

## Recommended backend implementation order

1. **Backend foundation:** service health/readiness, structured errors/logging, request IDs, API versioning, gateway route completeness, OpenAPI, common pagination/validation and service authentication.
2. **Identity and portals:** map all Laravel guards and password/session flows; preserve AdminRole, vendor EmployeeRole and actor scopes; finish admin and vendor employee backend workflows.
3. **Catalog + Store:** complete admin/vendor/customer contracts and data relationships.
4. **Inventory + Procurement:** reconcile stock and financial invariants; move warehouse portal orchestration into explicit Inventory/Procurement APIs.
5. **Order + Payment:** verify full status machine, checkout, refunds, provider callbacks and idempotency.
6. **Accounting + retention + reports:** migrate journals, membership, loyalty, wallet, settlements and Laravel reports with reconciliation.
7. **Notification + settings + remaining integrations:** email/SMS/FCM, file storage, localization and external providers.
8. **NestJS conversion:** once route contracts and ownership are stable, port one service at a time from the proven Express handlers; keep old routes as compatibility proxy until contract parity is established.

## Current verification limits

- The backend and gateway have existing Node test files, but tests were not run during this read-and-fix pass.
- Docker access was denied in the prior attempt; no container rebuild or runtime reachability check is claimed for the new gateway prefixes.
- Live source database role counts were not read. Counts in a schema dump are not live role counts.

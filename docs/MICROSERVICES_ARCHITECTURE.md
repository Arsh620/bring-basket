# Microservices Architecture and Laravel Domain Mapping

## Current target architecture

```text
Browser / portal
      │
Next.js App Router (frontend :3001)
      │ /api/v1
API Gateway (:3000) ── Redis (rate limits/cache)
      ├── Identity (:5001) ── admin, customer, vendor, rider, supplier identities/RBAC
      ├── Catalog (:5002) ── products, categories, brands, units
      ├── Store (:5003) ── stores, zones, modules, promotions/config
      ├── Inventory (:5004) ── warehouse/store stock, transfers, reservations
      ├── Procurement (:5005) ── suppliers, purchase orders, bills, returns, payments
      ├── Order (:5006) ── carts/orders and order analytics
      ├── Accounting (:5007) ── accounting workflows
      ├── Notification (:5008) ── notification workflows
      └── Payment (:5010) ── payment provider and webhook flows
MongoDB replica set is the current persistence layer; Docker Compose wires services.
```

The codebase is Express/Node.js today. Keep that implementation and make boundaries explicit; NestJS is an optional later framework migration, not part of Laravel feature parity.

## Ownership and integration rules

| Domain | Owns | Should not own |
|---|---|---|
| Identity | Actor accounts, credentials, AdminRole/EmployeeRole, access checks | Order or product lifecycle data |
| Catalog | Product definitions, taxonomy, units, batches | Store inventory balances or order state |
| Store | Store profile, zones/modules and store configuration | Credentials, order payment ledger |
| Inventory | Warehouse/store stock, reservation, movement and transfer | Product master data; reference catalog IDs instead |
| Procurement | Supplier/purchase lifecycle and receiving | Customer order lifecycle |
| Order | Cart and customer/admin order lifecycle | Provider secrets/payment settlement |
| Payment | Payment intents, provider callbacks and reconciliation | Admin portal role decisions |
| Accounting | Financial ledger/reporting contracts | Authentication/session state |
| Notification | Delivery of notifications and templates | Business authorization decisions |

Service-to-service calls go through configured internal service URLs and authenticated internal requests. Browser calls go through gateway. Do not expose internal service ports publicly. Cross-domain operations need explicit APIs/events, idempotency and failure handling; avoid a service directly mutating another domain's collections. The current Compose stack has no message broker; add RabbitMQ only when a specific asynchronous workflow and its delivery/retry semantics justify it.

## Portal identity and RBAC boundaries

- Admin Super Admin and Admin employee share admin identity storage but differ by role. `AdminRole.legacyId === 1` is the protected master role; role modules govern admin access.
- Laravel source routes gate employee account CRUD with `module:employee` and admin/vendor role CRUD with `module:custom_role`. These are distinct grants; employee management must not imply role administration.
- Vendor, VendorEmployee, DeliveryMan, Customer, Supplier and Warehouse identities have their own login/session and scope rules. Do not authorize them using AdminRole.
- Enforce role/module checks on APIs even when a frontend sidebar link is hidden. Resource-level checks (zone, store, warehouse ownership) supplement module grants.
- Passwords are one-way hashed. JWT/session expiry, refresh/logout and login throttling must be portal-aware; never copy Laravel password/session secrets into docs.
- Laravel has nine configured guards, including generic `web` and `api`; the application-level actors are Admin (including employee), Vendor, VendorEmployee, Customer, DeliveryMan, PurchaseVendor and Warehouse. Customer and rider experiences include mobile/API flows, not only web panels.

## Laravel domain families mapped to target ownership

| Laravel family | Candidate/current owner | Migration boundary |
|---|---|---|
| Marketplace, catalog, merchandising | Catalog + Store | Catalog owns item/taxonomy data; Store owns zones, modules and store configuration. |
| Customer commerce and checkout | Identity + Order + Payment | Keep identity, order state and provider settlement separate; preserve price/tax snapshots and wallet semantics. |
| Vendor/store operations | Identity + Store + Catalog + Order + Inventory | Vendor/employee identity is separate from Admin; enforce store ownership and subscriptions. |
| Delivery operations | Identity + Order + Accounting/Payment | Preserve rider assignment/status and earnings workflows. |
| Warehouse/inventory | Inventory | Preserve mother/sub scope, stock movement history, transfers, requests and receiving invariants. |
| Supplier procurement/accounting | Procurement + Accounting + Identity | Procurement owns suppliers and purchase lifecycle; Identity owns supplier credentials; accounting reports need reconciliation. |
| Rental/trips | Not yet assigned | Laravel module implementation is absent from this checkout; do not implement based only on target permission keys. |

These are family-level boundaries. Exact data and route ownership must be recorded per workflow before extracting compatibility routes. Some source integrations/files are unavailable in this checkout; do not infer missing behavior.

## API contract conventions

- Public browser base: `/api/v1`; version endpoint changes deliberately.
- Use consistent JSON envelopes, pagination metadata, validation errors and stable error codes.
- Use `401` for unauthenticated, `403` for authenticated but unauthorized, `404` for scoped missing records, `409` for conflicts and `422` for input validation.
- Mutations validate at the owning service, check authorization there, record actor/audit metadata and handle retries idempotently where practical.
- Add OpenAPI contracts per domain; document query filters and allowed status transitions.

## Docker/runtime

`docker-compose.yml` currently builds frontend, gateway, backend compatibility layer and domain services, and provides MongoDB/Redis. Health checks use `/health`; dependencies use health conditions. Keep environment values in local environment configuration/secrets management and keep real credentials out of source control/log output. Validate compose dependency cycles and service readiness when changing service ownership.

## Migration sequence

1. Preserve login/role semantics and map every Laravel portal.
2. Move identity and employee/role workflows into Identity service and gateway routes.
3. Migrate transactional domains with their owner services and explicit inter-service contracts.
4. Reconcile database data and audit/security semantics.
5. Remove compatibility routes only after callers and parity evidence are accounted for.

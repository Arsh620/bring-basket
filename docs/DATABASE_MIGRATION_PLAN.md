# Database Migration Plan: Laravel MySQL to MongoDB

## Current state and constraints

Laravel has 213 migration files and 155 Eloquent models. The target uses Mongoose/MongoDB; Compose currently gives most services the `bring_basket` database and the order service `bring_basket_order`. This is a staged application migration, not a direct conversion of each SQL table into a Mongo collection.

Verified static schema counts differ: `schema.sql` contains 177 `CREATE TABLE` statements, while the migrations contain 108 distinct literal `Schema::create` table names and 46 distinct `Schema::table` targets (253 calls). This does not establish the applied/live schema. The source database was not queried, and no data migration or migration-state claim is made. Establish dump provenance and a read-only live schema/row-count inventory before treating any one count as authoritative.

Do not run destructive migrations, reset the source database, or copy production PII into development. Keep Laravel source and database read-only until an approved migration rehearsal exists.

## Mapping principles

1. Assign each entity a single owning service and collection before modeling it.
2. Preserve source IDs as `legacyId` during transition; store Mongo `_id` references separately. Define unique indexes and normalization explicitly.
3. Embed bounded, read-together value objects; reference independently changing/high-cardinality entities (users, products, stores, orders, ledger rows).
4. Translate Laravel soft deletes, status values, timestamps, money precision, nullable fields, JSON columns and pivot relationships deliberately.
5. Preserve immutable business history (order snapshots, stock movements, payments, audit events). Do not reconstruct history from current product/store values.
6. Make unique constraints, idempotency and transaction boundaries explicit. Mongo multi-document transactions require the configured replica set.
7. Never put plaintext passwords, provider secrets or unnecessary personal information into migration artifacts.

## Domain ownership proposal

| Laravel data family | Mongo owner | Migration notes |
|---|---|---|
| Admin, AdminRole, customer/vendor/rider/supplier identities | Identity | Keep portal types and role references isolated; retain numeric legacy role IDs during cutover. |
| Product/category/brand/unit/item batch | Catalog | Preserve parent/category relationships, module links and SKU/barcode uniqueness. |
| Store/zone/module/banner/campaign/config | Store | Validate zone and module references; keep localized/JSON settings shape documented. |
| Warehouse, stock, movement, transfer, reservation | Inventory | Preserve append-only movements and reservation state transitions; do not only migrate stock totals. |
| Supplier and purchase orders/bills/payments/returns | Procurement | Preserve bill balances, received quantities and supplier legacy keys. |
| Cart/order/order lines | Order | Snapshot item price/name/tax/quantity at purchase time; retain state history and actor IDs. |
| Payment provider records | Payment | Keep secrets external; verify webhook signatures and deduplicate callbacks. |
| Ledger/reports/notifications | Accounting / Notification | Rebuild from stable domain events or migrate source records with reconciliation. |

## Data migration stages

### A. Source freeze and inventory

- Obtain an approved consistent MySQL dump and record source timestamp, row counts by table, schema checksum and encoding/timezone.
- Inventory keys, foreign keys, pivots, indexes, enums, JSON columns, soft deletes and orphan rows.
- Resolve Laravel route-list bootstrap issue in an isolated copy; do not alter the source checkout merely to extract metadata.

### B. Mapping and importer

- Create a versioned mapping file per service: source table, target collection, field transforms, null/default handling, legacy key and referential checks.
- Implement resumable, bounded batches with checkpoints, dry-run mode, deterministic IDs or idempotent upserts, error quarantine and redacted logs.
- Load reference entities before dependents; validate all cross-domain references by legacy key.

### C. Reconciliation

- Compare row/document counts and grouped financial/quantity totals for each domain.
- Compare representative records and edge cases: inactive users, soft-deleted rows, multi-zone actors, empty pivots, Unicode/localized fields, refunds, partial receipts and status histories.
- Require zero unexplained orphan references and a signed-off discrepancy report before cutover.

### D. Cutover and rollback

- Rehearse restore/import against a production-like isolated environment; measure duration and failure recovery.
- Define read-only window or dual-write strategy per domain; do not enable dual writes without conflict/replay design.
- Cut over behind feature/config routing with a rollback point and backups. Monitor authentication, order completion, stock balance and financial reconciliation.
- Keep source read-only until post-cutover reconciliation and business approval are complete.

## Collections and status ledger

Track each collection's source tables, owner, importer, indexes, reconciliation and cutover state in `FEATURE_MIGRATION_TRACKER.md`. Existing Mongoose models are not proof that source data has been migrated; current development collections should be treated as target application data unless a migration ledger proves otherwise.

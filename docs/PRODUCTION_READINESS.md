# Bring Basket migration and release guide

## Scope and release status

This guide uses the original Laravel [Part 1](C:/laragon/www/bring-basket/landing/PROJECT_DOCS_PART1.md) and [Part 2](C:/laragon/www/bring-basket/landing/PROJECT_DOCS_PART2.md) as its behavior baseline. The target is the Next.js frontend, the Express gateway and services, MongoDB, and Redis in this repository. The source Markdown describes intended behavior. For authorization, route definitions, middleware, and actual runtime behavior take precedence when they differ.

**Release status is open.** Implemented work includes portal access, the master access workspace, warehouse credential provisioning, stock history, navigation, order dispatch, wallet refund review, storefront checkout and store-scoped POS screens. The comparison below records Laravel behavior, local verification, and staging acceptance still needed.

## 1. Start the local stack and establish access

1. Start the local Docker stack from the repository root using the [Docker setup guide](DOCKER_SETUP.md). The browser opens the frontend on `http://localhost:3001` and calls the gateway on `http://localhost:3000/api/v1`.
2. Sign in with the existing master account at `/master/login`. The old `/admin/login` URL redirects there. For a fresh environment, provision the initial protected account through an environment-specific bootstrap before admitting traffic. Review [the local seed script](../backend/scripts/seed-admin.js) before use.
3. Open `/master/roles` and create two roles with different module selections. Use a fresh staging database or staging-only records for this exercise.
4. Open `/master/employees` and create one employee per test role. Clear **Enable sign-in** if the account should start disabled. Employees sign in at `/admin/employee-login` and land on `/admin/employee-dashboard`. Use separate browser profiles when comparing simultaneous master and employee sessions.
5. Test both the menu and direct navigation. For permitted modules, open the page and use the relevant action. For other modules, confirm that the page shows Access denied and the backend rejects requests with the same employee account.
6. Disable one disposable employee and repeat both fresh sign-in and a request from its earlier session. Re-enable it and verify sign-in again. Repeat with the role itself disabled. Review zone and store scope with a second zone or store.

The Docker MongoDB replica set contains an active employee record for `emp1@bringbasket.in`, with the **Technical team** role and a zone assignment. The role has 28 configured grants. The zone assignment limits global zone management. Actual sign-in for this account is still a browser acceptance check. On this workstation IPv4 loopback reached a separate standalone MongoDB process. Use the Docker replica set for local acceptance and verify the server identity before querying records.

## 2. Login, registration, and activation matrix

| Account | Route and account creation | Activation and access to verify |
|---|---|---|
| Primary admin | `/master/login`. Provision through the environment bootstrap. | The protected master account manages employees at `/master/employees` and module grants at `/master/roles`. Verify access independently of the employee sign-in. |
| Admin employee | `/admin/employee-login`. Create staff accounts in the master workspace or via a permitted delegated employee manager. | The dashboard and menu use the assigned role. Verify registration, assignment, disable and re-enable, and zone restrictions. |
| Vendor owner | `/vendor/register` followed by `/vendor/login`. | Review the pending account under `/admin/vendors` and assign or link its store as required. Verify pending, active, and disabled login plus store scope. |
| Store employee | `/vendor/employee-login`. A store owner or permitted manager creates a store role under `/vendor/roles` and an employee under `/vendor/employees`. The shared vendor login still accepts both account types. | Verify same-store role assignment, inactive account rejection, and separation from another store. |
| Customer | `/register` followed by `/login`. | Verify the password and OTP flows separately. Check duplicate accounts, password reset delivery, and disabled accounts. |
| Supplier | `/supplier/register` followed by `/supplier/login`. | Procurement reviews the application under `/admin/procurement/vendors`, then generates a password setup link. Test pending approval, expired and already-used links, enabled login, and access scoped to the supplier. |
| Mother warehouse | An admin with Warehouse access creates or edits it under `/admin/warehouse` and enters the portal username and password. Sign in at `/warehouse/login`. | Only an active warehouse with configured credentials can sign in. Check Purchases, Store Requests, Sub-Warehouses, and warehouse scope. |
| Sub-warehouse | An admin sets credentials under `/admin/warehouse`, or its mother warehouse selects **Set login** under `/warehouse/subs`. Sign in at `/warehouse/login`. | Verify transfers and stock with the assigned warehouse, plus denial of Purchases, Store Requests, sub-warehouse management, and other mother-warehouse actions. |
| Delivery person | A permitted Admin creates an active record under `/admin/delivery-men`. Sign in at `/deliveryman/login` with phone and password. | Verify active state, assignment, delivery transitions, history, and access only to the account's own earnings. |

Laravel uses session guards, Passport, and four configurable login slugs. The rebuild uses fixed frontend paths and JWT-backed APIs. Open parity work includes configurable slugs, legacy mobile API contracts, CAPTCHA settings, and the administrative password-reset behavior described in Part 2. The account table above describes the current rebuild.

## 3. Module and role behavior

| Control | Rebuild behavior and acceptance |
|---|---|
| Admin role catalog | Keys originate in the [backend permission catalog](../backend/src/domains/identity/admin-role-permissions.js). MongoDB role grants may be arrays or legacy JSON strings. Use the same keys in the [frontend admin map](../frontend/src/lib/admin-permissions.ts), sidebar, and endpoint middleware. Verify direct navigation and endpoint access separately. |
| Protected primary admin | The role with Laravel legacy ID `1` is required for every `/api/v1/admin/master` endpoint and the master workspace. Employee or role management grants can authorize their delegated admin pages, within scope. Verify both access paths and confirm employee assignment cannot confer the protected role. |
| Creating admin employees | The `employee` grant handles employee records and the assignable-role selector. The `custom_role` grant controls role administration. The actor may grant only modules already permitted by their scope. Test a manager with `employee` only and a separate role manager with `custom_role` only. |
| Store employee roles | Use the [vendor permission map](../frontend/src/lib/vendor-permissions.ts) and Identity service role and employee guards. A delegated manager can assign only roles within their own grants. Verify create, edit, disable and enable, the same grant on another store, and food-only capabilities. |
| Module vs. action | Laravel Part 1 describes section-level grants. The rebuild also enforces business constraints such as role assignment scope and warehouse hierarchy. Document any new action-level grant desired by the business before introducing a separate permission model. |
| Zone and warehouse scope | Test both the visible pages and scoped data with two different zones or warehouses. A zone-scoped admin should not receive a global zone selector. A sub-warehouse must be blocked from mother-only actions. |
| Services | Authorize business requests in their owning service. A visible menu, a hidden link, or an authenticated gateway response is only one part of acceptance. The release evidence requires checks for disabled principals and denied actions. |

## 4. Laravel feature comparison

The section numbers refer to Part 2. **Partial** means that source or routes exist in the rebuild, with the remaining behavior called out. Each row needs acceptance on seeded staging data before sign-off.

| Laravel section | Rebuild surface | Remaining implementation and verification |
|---|---|---|
| 8.1 Dashboard | Admin dashboard, order and customer statistics | Today and overall periods, commission and dispatch overview, consistent scoped metrics, and production data reconciliation. |
| 8.2–8.4 Catalog | Admin catalog, product batches, Brands and Brand Sales | Vendor approval, variants/gallery parity, import/export, localized attributes and pharmacy fields, and brand reports. |
| 8.5 Orders | Admin dispatch and unassigned queues, order details, eligible delivery-person assignment, delivery updates, customer refund requests, and wallet refund review | Complete non-wallet refund settlement, paid-order cancellations with payment reconciliation, dispatch load/cash-limit settings, invoice and proof, offline payment verification, edits, and exports. |
| 8.6–8.10 Users and access | Stores, vendors, customers, delivery staff, employees, roles | Verify each registration and activation route. Complete export and missing vendor approval workflows, and check employee editing and scoped roles. |
| 8.11 and 9.4 POS | Admin and vendor POS, barcode and held carts | Verify stock reservations, receipts and failure recovery. Complete loyalty, membership, and Pine Labs terminal behavior. |
| 8.12–8.17 Marketing and notifications | Campaigns, sales, coupons, banners, ads and notifications | Verify copy, previews, exports, automated templates, and role-based delivery settings. |
| 8.18–8.21 Zones, modules and subscriptions | Zone and module administration, membership | Validate polygon/module/payment combinations. Complete vendor subscription lifecycle, invoice, and enforcement. Complete membership create/edit and redemption workflows. |
| 8.22–8.27 Reports and accounting | Wallet bonus, cashback, withdrawals, disbursements, reports and accounting | Reconcile finance and stock against source. Verify journal reversals, GST, payable aging, payouts, report exports, and permissions on each mutation. |
| 8.28 Procurement | Vendors, POs, bills, returns and payments | Verify PO approvals, bulk mail/export, GRN receipts and reversals, invoices/challans and balance reports across staging. |
| 8.29 Warehouses | Admin Warehouse forms, stock, transfers, requests, purchases, expiry, subs, and paginated stock history by product and movement type | Verify login provisioning and state-scoped purchases in staging. Compare stock history totals with Laravel. Complete the sub-warehouse order flow, pincode coverage and copy-products parity. |
| 8.30 Settings | Admin business settings and policy endpoints | Map provider and environment configuration, localized settings, storage, maintenance, and external integrations. |
| 9.1–9.14 Vendor portal | Dashboard, items, orders, reviews, stores, role management, employee create/edit/status, POS, wallet and stock requests | Verify staffing and complete exports, delivery staff, subscription and reports, bank/profile/settings, and remaining merchandising actions. |
| 10.1–10.6 Supplier portal | Registration/approval/password setup, orders with upload and challan, invoices with attachment upload/download, products, profile and payments | Complete generated invoice PDFs/challans and supplier product CSV tooling. Verify supplier isolation, attachment storage, exports, and approval email delivery. |
| 11 Payments | Razorpay integration and core order records | Verify payment, refund, webhook, retry and reconciliation in staging. Establish which legacy providers and offline workflows must be enabled for this release. |
| 12 Notifications | Notification service with push and in-app surfaces | Verify FCM, email and SMS as configured, delivery retries, notification preferences, and realtime behavior. |
| 13–14 Data and services | MongoDB models, Redis events, and domain services | Reconcile imported IDs, role/store relationships, stock, order lines, financial amounts, and retries. See the [migration plan](DATABASE_MIGRATION_PLAN.md). |
| 15–19 Special features, scripts, storage, and architecture | Barcode/batches, retail offers, GST, parcel categories, import scripts and local upload support | Verify device workflows and protected file access. Map translations/RTL, scheduled expiry markdown, franchise, parcel dispatch, Laravel setup utilities, and special catalog tools to supported release workflows. |
| Part 1 §7 Mobile and API | Customer, vendor and delivery API families | Authenticate representative legacy clients against staging. Complete or document contract changes for versioned routes, token handling, payload fields, and mobile-only behavior. |

## 5. Frontend structure and design

- `frontend/src/app` owns routes and route-level composition. Portal layouts verify the current account before mounting restricted page content.
- `frontend/src/components` owns reusable forms, portal navigation, and admin resource views. Vendor and Warehouse share a keyboard-accessible mobile drawer. Desktop navigation shows the active page.
- `frontend/src/lib` owns API clients, permissions, and resource field definitions. Keep API errors, labels, focus states, and route permissions consistent between pages.
- `frontend/src/store` stores portal session state. Reset account-specific data on sign-in and sign-out, and scope cached records to their owning principal.
- The first design pass fixes the Geist font token globally and adds labeled vendor sign-in controls and warehouse credential fields. The next passes cover storefront checkout and address input, loading/empty/error states, mobile data tables and POS, and shared registration and login patterns.
- For each portal, check at 375 px and desktop width. Exercise keyboard navigation, the mobile menu, sign-out, password managers, inline errors, and direct links. Capture screenshots only after validating the current route and account role.

## 6. Release gates

1. **Build and automated verification.** Run the backend and gateway suites, targeted frontend lint and type checks, then a clean production frontend build. Record failure output, skips, and the exact revision.
2. **Staging role and portal acceptance.** Run Section 1 and each lifecycle in Section 2. Verify role, module, zone/store/warehouse scope and status with actual staging fixtures and browser/API requests.
3. **Business acceptance.** Run checkout, order fulfillment, refunds, POS, procurement/GRN, transfers and notifications end to end. Approve or defer each missing legacy feature in Section 4 with an owner and acceptance criteria.
4. **Migration and recovery.** Take a restorable source backup. Rehearse import on an isolated target, reconcile relationships, quantities and totals, and test rollback. The [general MySQL importer](../backend/scripts/importFromMySQL.js) replaces destination collections, so rehearse on a disposable destination.
5. **Operational readiness.** Verify production secrets, TLS, public ingress versus private service ports, MongoDB and Redis access, upload persistence and access policy, health/readiness, monitoring, backups, restore, and alerting. Rehearse payment webhook replay and provider failures using staging credentials.
6. **Cutover.** Stage the release, verify migration and ops checks, record owners and rollback triggers, then confirm storefront checkout, staff access, pending orders, stock balances, and finance after the switch.

### Verification evidence for this implementation pass

- Backend: 111 tests passed, including the portal-access and checkout stock integration tests on isolated databases in the Docker replica set. The portal test covers employee creation and activation, denial of an unassigned module, warehouse credentials, and mother/sub boundaries. The stock test verifies reserve and restore. Redis event delivery was outside that test.
- Gateway: 13 tests passed. Frontend TypeScript and the production build passed. Targeted lint passed for the portal login, warehouse provisioning, navigation, and access management changes.
- Local Docker rollout verified with healthy compatibility backend, Identity, Inventory, and gateway. HTTP smoke covered all 100 frontend page entries with 99 successful responses and the expected root redirect. This confirms routing, while authenticated browser workflows still need acceptance.
- Chrome confirmed the dedicated store employee sign-in at 390 CSS pixels. The form fits without horizontal scrolling, uses Geist typography, and associates both field labels with their inputs.
- Frontend ESLint initially reported 15 errors and 10 warnings. See the latest result under [Storefront and POS frontend verification](#storefront-and-pos-frontend-verification).
- Browser acceptance with named accounts and staging provider credentials remains open. The local portal-access test provisions its own accounts in a disposable database and does not reset or alter the real employee accounts.

### Master workspace and stock history verification

- The full backend suite passed 111 tests with both MongoDB integrations enabled, and the gateway passed 14 tests. After the final access safeguards, all 18 targeted role and portal tests passed. That run covered master-only API access, disabled employee creation, enable/disable, role revocation in an existing session, and omission of password data from the employee response.
- Local HTTP smoke covered all 105 page entries with 102 successful responses and the three expected redirects. The gateway and compatibility backend both returned `401` for an unauthenticated request to the master Employees API.
- Chrome checked the master sign-in at 390 CSS pixels. The form uses Geist, associates both field labels with their inputs, and fits the viewport.
- Inventory history is available at `/warehouse/history`. The portal test verifies that a mother warehouse and its sub-warehouse each receive their own movements by default and that the mother can explicitly select the assigned sub-warehouse at the API layer.
- Remaining release stages include non-wallet refund settlement, POS provider flows, and staging data reconciliation.

### Order dispatch and refunds

1. Sign in with a role that has Orders access and open `/admin/orders/dispatch`. Use `/admin/orders/unassigned` for orders awaiting a delivery person. Open an order to pick an eligible active delivery person for its store or zone.
2. The assigned delivery person sees the same order in `/deliveryman`. Complete processing, handover, pickup, and delivery. Check that delivery updates agree in the admin and customer portals, and that the delivery earnings ledger has a single credit.
3. A signed-in customer can request a refund from `/orders` for their paid and delivered online order. The refundable amount excludes delivery charges and any recorded delivery tips.
4. Review incoming requests in `/admin/orders/refunds`. The automatic approval action requires an unreversed wallet debit for the order. Approval writes the order decision and wallet credit in one transaction. For cash, Razorpay, and other methods, the request can be reviewed and rejected; approval through those payment methods remains an open release item.
5. The local setup uses two databases in the same MongoDB replica set. The Order service uses `ORDER_OPERATIONS_DATABASE` for delivery and wallet records, and the compatibility backend uses `ORDER_DATABASE` to read or update orders through the delivery portal. Keep both on the same cluster for cross-database transactions. Rehearse ledger and order reconciliation in staging.
6. The migration mapper preserves Laravel's `dm_tips` for new imports. Reconcile tip amounts for orders already imported before enabling refunds for those orders in staging.

The backend suite passed 112 tests with MongoDB integrations enabled. The order operations test exercises zone isolation, assignment, delivery counters and earnings, tip and delivery charge deductions, wallet refund concurrency, and rejection of automatic settlement for a cash order. The Next.js production build, TypeScript, and targeted lint for the admin and customer order pages passed.

Local HTTP smoke verified `/admin/orders/dispatch`, `/admin/orders/unassigned`, `/admin/orders/refunds`, `/orders`, and `/deliveryman` on port 3001, and an unauthenticated refund queue request returned `401` through the gateway. Authenticated browser acceptance and payment-provider settlement remain release gates.

To run the MongoDB integration tests on this Windows workstation, start the Docker replica set and run from the repository root.

```powershell
Push-Location backend
$env:PORTAL_INTEGRATION_MONGO_URI = 'mongodb://[::1]:27017/?directConnection=true&replicaSet=rs0'
$env:ORDER_INTEGRATION_MONGO_URI = $env:PORTAL_INTEGRATION_MONGO_URI
node --test
Pop-Location
```

The integration tests generate and clean up their own test databases. In another environment, set both variables to the authorized test replica set's connection URI.

### Storefront and POS frontend verification

1. Open `/shop` and select a store. Add a product to the cart. After signing in, use **View checkout and payment options** to open that store's checkout. The gateway routes `/api/v1/customer/cart` and `/api/v1/customer/order` to Order. Checkout reads the module from the store, shows saved addresses and the item subtotal, and sends an idempotency key with the order. For online payment, the created order supplies the amount shown in the payment button.
2. Open `/wishlist` and `/notifications` as a customer. Check loading, empty, and retry states. A saved product sends its module and product details when adding to the cart. Marking a notification as read updates the unread count.
3. Open `/admin/pos` or `/vendor/pos` with the POS grant. Switch between authorized stores where the role allows it. Check that the catalog, current cart, held carts, and draft address follow the selected store. Existing POS browser session IDs remain reusable for each store.

Full frontend ESLint now passes with **0 errors and 8 warnings**. The remaining warnings concern images in the storefront and profile, and client redirects after unauthorized responses. Frontend TypeScript, the Next.js production build, 15 gateway tests, and 112 backend tests with the MongoDB integrations enabled passed.

After the local Docker rollout, all eight touched frontend routes returned `200`. The gateway returned empty guest cart and order lists for a fresh guest, and returned `401` for an unauthenticated wishlist request. Chrome at 390 CSS pixels with mocked API responses verified the checkout request, saved address and idempotency key, POS store changes and catalog pagination, denial of Admin POS after revoking its grant, adding a wishlist product to the cart, and marking a notification read. Staging acceptance still needs actual staff accounts, scoped stores, POS receipts and held-cart recovery, and provider settlement and reconciliation.

### POS cash checkout

Test from `/admin/pos` or `/vendor/pos` with the POS grant. Select a store with test stock, scan an item or enter its barcode, hold and resume the cart, then place a **Counter pickup** order with **Cash**. Open **Admin Orders** and verify a `POS-` order with **Paid**, **Delivered**, and the expected total. Compare stock before and after.

POS writes completed sales to the canonical Order database. Held carts are scoped to the operator and store. Hold and resume move the cart and snapshot in a single MongoDB transaction. Concurrent submission of one cart can complete only one sale. Receipt printing and Pine Labs terminal payment acceptance remain open.

The POS integration test passed against isolated MongoDB databases through both portal APIs and the Inventory stock endpoints. It verified barcode lookup, hold and resume, denial after removing the POS grant, denial for an unrelated store, two paid ₹100 cash sales, and a final stock count of 6 from an initial 10. The duplicate submit completed only one Vendor sale. Both local POS pages returned `200`, and unauthenticated POS API requests returned `401`.

### Razorpay Test Mode

1. Select Test Mode in the Razorpay Dashboard and generate test credentials under **Account & Settings → API Keys**. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the local repository root `.env`. After saving, run `docker compose up -d --no-deps --force-recreate payment`. The Payment service uses `ORDER_DATABASE` to read and update orders in the same MongoDB replica set.
2. Sign in as a test customer, add test stock at `/shop`, and choose **View checkout and payment options → Pay Online (Razorpay) → Proceed to payment**. Open the Razorpay popup. With UPI available, `success@razorpay` simulates a successful payment and `failure@razorpay` simulates failure.
3. Compare the Razorpay Dashboard payment amount and **Captured** status with the same order's **Paid** status in `/admin/orders`. For a failed payment, confirm the order stays unpaid. Use a public HTTPS staging gateway for webhook acceptance at `/api/v1/payment/razorpay/webhook` and set the matching `RAZORPAY_WEBHOOK_SECRET`.

The MongoDB integration test verifies that a mocked Razorpay request uses the stored checkout total and that a verified capture updates both the payment record and the canonical order. The wallet webhook regression test also passed. The local Payment container is healthy. A customer completed a ₹129 Razorpay Test Mode checkout. Razorpay reported `captured` for the matching provider order and amount, and both the local order and payment record reported `paid`. Failed-payment retry, provider webhook delivery, and refund reconciliation remain open. See [Razorpay API key setup](https://razorpay.com/docs/payments/dashboard/account-settings/api-keys) and [webhook testing](https://razorpay.com/docs/webhooks/validate-test).

### Imported storefront catalog

Use [the catalog normalization script](../backend/scripts/normalizeStorefrontCatalog.js) to preview existing MongoDB data after a Laravel import. It converts imported storefront flags and numeric product fields to their schema types and resolves storefront references through `legacyId`. Run it from the backend directory with the target replica set's `MONGO_URI`. Add `--apply` to commit the scoped changes in one transaction. The MySQL importer now performs the same step after loading the data.

The local repair normalized 7 stores, 5,926 items, 4 zones, and 3 modules. A second preview found zero further updates. Missing references on disabled records remain in the preview report for reconciliation. The script preserves the existing enabled states and stock quantities. The gateway listed four active stores and returned products for all four. Chrome at 390 CSS pixels displayed in-stock products in Bring Basket Ranchi, and an isolated guest cart successfully added and removed a Ranchi item.

A follow-up repair normalized serialized POS add-on lists on the same 5,926 imported items. POS returned products for all four active stores, and Ranchi product search and barcode lookup returned the matching item. The POS integration test also verifies that an imported add-on remains linked and that an empty imported list loads in both portals.

## 7. Frontend page inventory

The current tree contains 106 page files. Each source link is an entry point for acceptance. The optional order segment covers the base list, dispatch queues, and status filters. Record browser results against the relevant lifecycle in Sections 2–4.

### Master workspace

- [`/master`](<../frontend/src/app/master/page.tsx>) — Redirects to Employees
- [`/master/login`](<../frontend/src/app/master/login/page.tsx>) — Public master sign-in
- [`/master/employees`](<../frontend/src/app/master/employees/page.tsx>) — Protected master account
- [`/master/roles`](<../frontend/src/app/master/roles/page.tsx>) — Protected master account

### Public storefront

- [`/home`](<../frontend/src/app/home/page.tsx>) — Public entry
- [`/`](<../frontend/src/app/page.tsx>) — Public entry
- [`/shop`](<../frontend/src/app/shop/page.tsx>) — Public entry
- [`/wishlist`](<../frontend/src/app/wishlist/page.tsx>) — Customer session

### Customer account

- [`/checkout`](<../frontend/src/app/(customer)/checkout/page.tsx>) — Customer session
- [`/login`](<../frontend/src/app/(customer)/login/page.tsx>) — Public entry
- [`/loyalty`](<../frontend/src/app/(customer)/loyalty/page.tsx>) — Customer session
- [`/notifications`](<../frontend/src/app/(customer)/notifications/page.tsx>) — Customer session
- [`/orders`](<../frontend/src/app/(customer)/orders/page.tsx>) — Customer session
- [`/profile`](<../frontend/src/app/(customer)/profile/page.tsx>) — Customer session
- [`/register`](<../frontend/src/app/(customer)/register/page.tsx>) — Public entry
- [`/wallet`](<../frontend/src/app/(customer)/wallet/page.tsx>) — Customer session

### Admin and admin employees

- [`/admin/account`](<../frontend/src/app/admin/account/page.tsx>) — `account` module
- [`/admin/activity-logs`](<../frontend/src/app/admin/activity-logs/page.tsx>) — `report` module
- [`/admin/admins`](<../frontend/src/app/admin/admins/page.tsx>) — `employee` module
- [`/admin/advertisements`](<../frontend/src/app/admin/advertisements/page.tsx>) — `campaign` module
- [`/admin/banners`](<../frontend/src/app/admin/banners/page.tsx>) — `banner` module
- [`/admin/brand-sales`](<../frontend/src/app/admin/brand-sales/page.tsx>) — `campaign` module
- [`/admin/campaigns`](<../frontend/src/app/admin/campaigns/page.tsx>) — `campaign` module
- [`/admin/cancel-reasons`](<../frontend/src/app/admin/cancel-reasons/page.tsx>) — `order` module
- [`/admin/cashback`](<../frontend/src/app/admin/cashback/page.tsx>) — `cashback` module
- [`/admin/catalog/brands`](<../frontend/src/app/admin/catalog/brands/page.tsx>) — `item` module
- [`/admin/catalog/categories`](<../frontend/src/app/admin/catalog/categories/page.tsx>) — `category` module
- [`/admin/catalog/item-batches`](<../frontend/src/app/admin/catalog/item-batches/page.tsx>) — `item` module
- [`/admin/catalog/items`](<../frontend/src/app/admin/catalog/items/page.tsx>) — `item` module
- [`/admin/catalog/unit-groups`](<../frontend/src/app/admin/catalog/unit-groups/page.tsx>) — `unit` module
- [`/admin/catalog/units`](<../frontend/src/app/admin/catalog/units/page.tsx>) — `unit` module
- [`/admin/conversations`](<../frontend/src/app/admin/conversations/page.tsx>) — `notification` module
- [`/admin/coupons`](<../frontend/src/app/admin/coupons/page.tsx>) — `coupon` module
- [`/admin/customers`](<../frontend/src/app/admin/customers/page.tsx>) — `customer_management` module
- [`/admin/dashboard`](<../frontend/src/app/admin/dashboard/page.tsx>) — Admin portal session
- [`/admin/delivery-men`](<../frontend/src/app/admin/delivery-men/page.tsx>) — `deliveryman` module
- [`/admin/employee-dashboard`](<../frontend/src/app/admin/employee-dashboard/page.tsx>) — Admin portal session
- [`/admin/employee-login`](<../frontend/src/app/admin/employee-login/page.tsx>) — Public entry
- [`/admin/employees`](<../frontend/src/app/admin/employees/page.tsx>) — `employee` module
- [`/admin/flash-sales`](<../frontend/src/app/admin/flash-sales/page.tsx>) — `campaign` module
- [`/admin/inventory/batch-write-offs`](<../frontend/src/app/admin/inventory/batch-write-offs/page.tsx>) — `warehouse` module
- [`/admin/inventory/stock-movements`](<../frontend/src/app/admin/inventory/stock-movements/page.tsx>) — `warehouse` module
- [`/admin/inventory/stock-transfers`](<../frontend/src/app/admin/inventory/stock-transfers/page.tsx>) — `warehouse` module
- [`/admin/inventory/store-stock-requests`](<../frontend/src/app/admin/inventory/store-stock-requests/page.tsx>) — `warehouse` module
- [`/admin/inventory/warehouse-stock`](<../frontend/src/app/admin/inventory/warehouse-stock/page.tsx>) — `warehouse` module
- [`/admin/login`](<../frontend/src/app/admin/login/page.tsx>) — Redirects to master sign-in
- [`/admin/membership`](<../frontend/src/app/admin/membership/page.tsx>) — `customer_management` module
- [`/admin/modules`](<../frontend/src/app/admin/modules/page.tsx>) — `module` module
- [`/admin/notifications`](<../frontend/src/app/admin/notifications/page.tsx>) — `notification` module
- [`/admin/orders/[[...filter]]`](<../frontend/src/app/admin/orders/[[...filter]]/page.tsx>) — `order` module
- [`/admin/orders/refunds`](<../frontend/src/app/admin/orders/refunds/page.tsx>) — `order` module
- [`/admin/parcel-categories`](<../frontend/src/app/admin/parcel-categories/page.tsx>) — `parcel` module
- [`/admin/pos`](<../frontend/src/app/admin/pos/page.tsx>) — `pos` module
- [`/admin/procurement/bills`](<../frontend/src/app/admin/procurement/bills/page.tsx>) — `purchase` module
- [`/admin/procurement/orders`](<../frontend/src/app/admin/procurement/orders/page.tsx>) — `purchase` module
- [`/admin/procurement/payments`](<../frontend/src/app/admin/procurement/payments/page.tsx>) — `purchase` module
- [`/admin/procurement/returns`](<../frontend/src/app/admin/procurement/returns/page.tsx>) — `purchase` module
- [`/admin/procurement/vendors`](<../frontend/src/app/admin/procurement/vendors/page.tsx>) — `purchase` module
- [`/admin/reports`](<../frontend/src/app/admin/reports/page.tsx>) — `report` module
- [`/admin/roles`](<../frontend/src/app/admin/roles/page.tsx>) — `custom_role` module
- [`/admin/settings`](<../frontend/src/app/admin/settings/page.tsx>) — `settings` module
- [`/admin/store-disbursements`](<../frontend/src/app/admin/store-disbursements/page.tsx>) — `report` module
- [`/admin/stores`](<../frontend/src/app/admin/stores/page.tsx>) — `store` module
- [`/admin/vehicles`](<../frontend/src/app/admin/vehicles/page.tsx>) — `deliveryman` module
- [`/admin/vendors`](<../frontend/src/app/admin/vendors/page.tsx>) — `store` module
- [`/admin/wallet-bonus`](<../frontend/src/app/admin/wallet-bonus/page.tsx>) — `customer_management` module
- [`/admin/warehouse`](<../frontend/src/app/admin/warehouse/page.tsx>) — `warehouse` module
- [`/admin/withdraw-requests`](<../frontend/src/app/admin/withdraw-requests/page.tsx>) — `withdraw_list` module
- [`/admin/zones`](<../frontend/src/app/admin/zones/page.tsx>) — `zone` module

### Vendor and store employees

- [`/vendor/dashboard`](<../frontend/src/app/vendor/dashboard/page.tsx>) — Vendor portal session
- [`/vendor/employee-login`](<../frontend/src/app/vendor/employee-login/page.tsx>) — Public entry
- [`/vendor/employees`](<../frontend/src/app/vendor/employees/page.tsx>) — `employee` module
- [`/vendor/items`](<../frontend/src/app/vendor/items/page.tsx>) — `item` module
- [`/vendor/login`](<../frontend/src/app/vendor/login/page.tsx>) — Public entry
- [`/vendor/orders`](<../frontend/src/app/vendor/orders/page.tsx>) — `order` module
- [`/vendor`](<../frontend/src/app/vendor/page.tsx>) — Vendor portal session
- [`/vendor/pos`](<../frontend/src/app/vendor/pos/page.tsx>) — `pos` module
- [`/vendor/register`](<../frontend/src/app/vendor/register/page.tsx>) — Public entry
- [`/vendor/reviews`](<../frontend/src/app/vendor/reviews/page.tsx>) — `report` module
- [`/vendor/roles`](<../frontend/src/app/vendor/roles/page.tsx>) — `custom_role` module
- [`/vendor/store-stock-requests`](<../frontend/src/app/vendor/store-stock-requests/page.tsx>) — `item` module
- [`/vendor/stores`](<../frontend/src/app/vendor/stores/page.tsx>) — `my_shop` module
- [`/vendor/wallet`](<../frontend/src/app/vendor/wallet/page.tsx>) — `bank_info` module

### Supplier

- [`/supplier/dashboard`](<../frontend/src/app/supplier/dashboard/page.tsx>) — Approved supplier session
- [`/supplier/invoices/[id]`](<../frontend/src/app/supplier/invoices/[id]/page.tsx>) — Approved supplier session
- [`/supplier/invoices`](<../frontend/src/app/supplier/invoices/page.tsx>) — Approved supplier session
- [`/supplier/login`](<../frontend/src/app/supplier/login/page.tsx>) — Public entry
- [`/supplier/orders/[id]`](<../frontend/src/app/supplier/orders/[id]/page.tsx>) — Approved supplier session
- [`/supplier/orders`](<../frontend/src/app/supplier/orders/page.tsx>) — Approved supplier session
- [`/supplier/payments`](<../frontend/src/app/supplier/payments/page.tsx>) — Approved supplier session
- [`/supplier/products`](<../frontend/src/app/supplier/products/page.tsx>) — Approved supplier session
- [`/supplier/profile`](<../frontend/src/app/supplier/profile/page.tsx>) — Approved supplier session
- [`/supplier/register`](<../frontend/src/app/supplier/register/page.tsx>) — Public entry
- [`/supplier/register/success`](<../frontend/src/app/supplier/register/success/page.tsx>) — Public entry
- [`/supplier/set-password`](<../frontend/src/app/supplier/set-password/page.tsx>) — Public entry

### Warehouse

- [`/warehouse/dashboard`](<../frontend/src/app/warehouse/dashboard/page.tsx>) — Warehouse session
- [`/warehouse/expiry`](<../frontend/src/app/warehouse/expiry/page.tsx>) — Warehouse session
- [`/warehouse/history`](<../frontend/src/app/warehouse/history/page.tsx>) — Warehouse session
- [`/warehouse/login`](<../frontend/src/app/warehouse/login/page.tsx>) — Public entry
- [`/warehouse/purchases`](<../frontend/src/app/warehouse/purchases/page.tsx>) — Mother warehouse
- [`/warehouse/requests`](<../frontend/src/app/warehouse/requests/page.tsx>) — Mother warehouse
- [`/warehouse/stock`](<../frontend/src/app/warehouse/stock/page.tsx>) — Warehouse session
- [`/warehouse/subs`](<../frontend/src/app/warehouse/subs/page.tsx>) — Mother warehouse
- [`/warehouse/transfers`](<../frontend/src/app/warehouse/transfers/page.tsx>) — Warehouse session

### Delivery person

- [`/deliveryman/login`](<../frontend/src/app/deliveryman/login/page.tsx>) — Public entry
- [`/deliveryman`](<../frontend/src/app/deliveryman/page.tsx>) — Delivery session

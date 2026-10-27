require('dotenv').config();
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');

// Tables to migrate in order (dependencies first)
const TABLES = [
  // Core lookup tables
  'modules', 'module_types', 'zones', 'units', 'unit_groups', 'unit_group_conversions',
  'attributes', 'tags', 'nutritions', 'allergies', 'generic_names',
  'common_conditions', 'currencies', 'parcel_categories',

  // Auth
  'admin_roles', 'employee_roles', 'admins', 'vendors', 'vendor_employees',
  'delivery_men', 'd_m_vehicles',

  // Users
  'users', 'guests', 'customer_addresses', 'customer_membership_plans', 'customer_subscriptions',

  // Catalog
  'brands', 'categories', 'items', 'inactive_items_store_8', 'item_batches', 'batch_write_offs',
  'item_nutrition', 'item_tag', 'allergy_item', 'item_generic_names',
  'ecommerce_item_details', 'pharmacy_item_details', 'temp_products',

  // Stores
  'stores', 'store_configs', 'store_schedule', 'store_subscriptions',
  'store_wallets', 'subscription_packages', 'subscription_transactions',
  'add_ons', 'discounts', 'banners', 'campaigns', 'campaign_store',
  'item_campaigns', 'flash_sales', 'flash_sale_items', 'brand_sales',
  'advertisements',

  // Warehouse
  'warehouses', 'warehouse_item_stocks', 'warehouse_item_batches',
  'warehouse_stock_movements', 'warehouse_stock_transfers',
  'warehouse_stock_transfer_items', 'warehouse_pincodes',
  'store_stock_requests', 'store_stock_request_items',

  // Purchase
  'purchase_vendors', 'purchase_vendor_addresses', 'purchase_vendor_banks',
  'purchase_vendor_contacts', 'purchase_vendor_documents', 'purchase_vendor_products',
  'purchase_orders', 'purchase_order_items', 'purchase_bills', 'purchase_bill_items',
  'purchase_bill_dispatches', 'purchase_bill_dispatch_items',
  'purchase_payments', 'purchase_returns', 'purchase_return_items',

  // Orders
  'orders', 'order_details', 'order_transactions', 'order_payments',
  'order_references', 'order_cancel_reasons', 'order_delivery_histories',
  'carts', 'pos_held_carts', 'coupons', 'cash_backs', 'cash_back_histories',

  // Accounting
  'account_ledgers', 'account_journal_entries', 'account_journal_lines',
  'account_transactions', 'expenses', 'disbursements', 'disbursement_details',
  'disbursement_withdrawal_methods', 'withdrawal_methods', 'withdraw_requests',
  'admin_wallets', 'delivery_man_wallets', 'wallet_transactions', 'wallet_payments',
  'wallet_bonuses', 'loyalty_point_transactions', 'provide_d_m_earnings',

  // Notifications & misc
  'notifications', 'user_notifications', 'notification_settings',
  'notification_messages', 'store_notification_settings',
  'conversations', 'messages', 'reviews', 'd_m_reviews',
  'wishlists', 'refunds', 'refund_reasons', 'newsletters',
  'contacts', 'franchise_request', 'translations',
  'business_settings', 'data_settings', 'external_configurations',
  'soft_credentials', 'social_media', 'email_templates',
  'email_verifications', 'phone_verifications', 'password_resets',
  'activity_logs', 'module_zone', 'module_wise_banners',
  'module_wise_why_chooses', 'offline_payment_methods', 'offline_payments',
  'payment_requests', 'pine_labs_payments', 'priority_lists',
  'parcel_delivery_instructions', 'track_deliverymen', 'delivery_histories',
  'subscription_billing_and_refund_histories',
  'expiry_markdown_rules', 'automated_messages', 'addon_settings',
  'admin_features', 'admin_promotional_banners', 'admin_special_criterias',
  'admin_testimonials', 'react_testimonials', 'flutter_special_criterias',
  'states_data', 'user_infos',
  'allergy_item_campaign', 'item_campaign_generic_names', 'item_campaign_nutrition',
  'item_generic_names', 'item_nutrition', 'item_tag',

  // SKIP: cache, cache_locks, sessions, failed_jobs, jobs, migrations
  // SKIP: oauth_*, websockets_statistics_entries, storages
  // SKIP: items_backup, items_ks_backup, items_store8_copy
];

// Convert snake_case to camelCase
const toCamel = (str) => str.replace(/_([a-z])/g, (_, l) => l.toUpperCase());

// Convert a MySQL row object to camelCase
const rowToCamel = (row) => {
  const obj = {};
  for (const [key, val] of Object.entries(row)) {
    obj[toCamel(key)] = val;
  }
  return obj;
};

const BATCH_SIZE = 500;

async function migrateTable(mysqlConn, mongoDb, tableName) {
  const collectionName = tableName.replace(/_/g, '');
  const collection = mongoDb.collection(collectionName);

  // Get total count
  const [[{ total }]] = await mysqlConn.execute(`SELECT COUNT(*) as total FROM \`${tableName}\``);
  if (total === 0) {
    console.log(`  ⏭  ${tableName} — empty, skipping`);
    return 0;
  }

  // Clear existing data
  await collection.deleteMany({});

  let offset = 0;
  let inserted = 0;

  while (offset < total) {
    const [rows] = await mysqlConn.execute(
      `SELECT * FROM \`${tableName}\` LIMIT ${BATCH_SIZE} OFFSET ${offset}`
    );

    if (rows.length === 0) break;

    const docs = rows.map((row) => {
      const doc = rowToCamel(row);
      // Store original MySQL id as legacyId
      if (doc.id !== undefined) {
        doc.legacyId = doc.id;
        delete doc.id;
      }
      return doc;
    });

    await collection.insertMany(docs, { ordered: false });
    inserted += docs.length;
    offset += BATCH_SIZE;

    process.stdout.write(`\r  ✓  ${tableName} — ${inserted}/${total}`);
  }

  console.log(`\r  ✓  ${tableName} — ${inserted} rows migrated`);
  return inserted;
}

async function main() {
  console.log('🚀 Starting MySQL → MongoDB migration...\n');

  const mysqlConn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    dateStrings: true,
  });

  await mongoose.connect(process.env.MONGO_URI);
  const mongoDb = mongoose.connection.db;

  console.log('✅ Connected to MySQL and MongoDB\n');

  // Get existing MySQL tables
  const [existingTables] = await mysqlConn.execute('SHOW TABLES');
  const tableKey = Object.keys(existingTables[0])[0];
  const availableTables = new Set(existingTables.map((r) => r[tableKey]));

  let totalInserted = 0;
  let skipped = 0;

  for (const table of TABLES) {
    if (!availableTables.has(table)) {
      console.log(`  ⚠  ${table} — not found in MySQL, skipping`);
      skipped++;
      continue;
    }
    try {
      const count = await migrateTable(mysqlConn, mongoDb, table);
      totalInserted += count;
    } catch (err) {
      console.error(`  ✗  ${table} — ERROR: ${err.message}`);
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   Total rows inserted: ${totalInserted}`);
  console.log(`   Tables skipped: ${skipped}`);

  await mysqlConn.end();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
});

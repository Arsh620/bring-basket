require('dotenv').config();

const mysql = require('mysql2/promise');
const mongoose = require('mongoose');

const parseJson = (value, fallback = null) => {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const numberValue = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const dateValue = (value) => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const text = String(value);
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(text)
    ? text
    : `${text.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid order timestamp: ${text}`);
  return date;
};

const mapLegacyOrder = (row, details, references) => {
  const store = references.stores.get(String(row.store_id));
  const module = references.modules.get(String(row.module_id));
  if (!store || !module) {
    throw new Error(`Missing Store or Module reference for legacy order ${row.id}`);
  }

  const items = details.map((detail) => {
    const snapshot = parseJson(detail.item_details, {});
    const quantity = numberValue(detail.quantity);
    const unitPrice = numberValue(detail.price);
    const discount = numberValue(detail.discount_on_item);
    const tax = numberValue(detail.tax_amount);
    const addOnTotal = numberValue(detail.total_add_on_price);
    const snapshotImage = snapshot.image;
    return {
      itemId: String(detail.item_id),
      itemName: snapshot.name || detail.item_name || `Item ${detail.item_id}`,
      ...(typeof snapshotImage === 'string' ? { image: snapshotImage } : {}),
      variant: detail.variant || '',
      variations: parseJson(detail.variation, []),
      addOns: parseJson(detail.add_ons, []),
      addOnTotal,
      quantity,
      unitPrice,
      discountAmount: discount * quantity,
      taxAmount: tax,
      lineTotal: Math.max(0, (unitPrice - discount) * quantity + addOnTotal),
    };
  });

  const rawAddress = parseJson(row.delivery_address, row.delivery_address);
  const address = typeof rawAddress === 'string'
    ? { address: rawAddress }
    : rawAddress;
  const zone = references.zones.get(String(row.zone_id));
  const orderStatus = String(row.order_status || 'pending');

  return {
    legacyId: numberValue(row.id),
    orderNumber: String(row.id),
    ownerId: String(row.user_id ?? `guest-${row.id}`),
    isGuest: Number(row.is_guest) === 1 || row.user_id == null,
    moduleId: String(module._id),
    storeId: String(store._id),
    ...(zone ? { zoneId: String(zone._id) } : {}),
    storeName: row.store_name || store.name || `Store ${row.store_id}`,
    orderType: String(row.order_type || 'delivery'),
    orderStatus,
    paymentMethod: String(row.payment_method || 'cash'),
    paymentStatus: String(row.payment_status || 'unpaid'),
    currency: 'INR',
    items,
    itemSubtotal: items.reduce((total, item) => total + item.lineTotal, 0),
    itemDiscount: numberValue(row.coupon_discount_amount) + numberValue(row.store_discount_amount),
    taxAmount: numberValue(row.total_tax_amount),
    deliveryCharge: numberValue(row.delivery_charge),
    dmTips: numberValue(row.dm_tips),
    distanceKm: numberValue(row.distance),
    orderAmount: numberValue(row.order_amount),
    deliveryAddress: address && typeof address === 'object' && !Array.isArray(address)
      ? {
        contact_person_name: String(address.contact_person_name || ''),
        contact_person_number: String(address.contact_person_number || ''),
        address: String(address.address || ''),
        latitude: numberValue(address.latitude),
        longitude: numberValue(address.longitude),
      }
      : null,
    orderNote: row.order_note || undefined,
    pendingAt: dateValue(row.pending),
    acceptedAt: dateValue(row.accepted),
    confirmedAt: dateValue(row.confirmed),
    processingAt: dateValue(row.processing),
    handoverAt: dateValue(row.handover),
    pickedUpAt: dateValue(row.picked_up),
    deliveredAt: dateValue(row.delivered),
    canceledAt: dateValue(row.canceled),
    failedAt: dateValue(row.failed),
    refundRequestedAt: dateValue(row.refund_requested),
    refundedAt: dateValue(row.refunded),
    refundStatus: orderStatus === 'refunded' ? 'approved' : orderStatus === 'refund_requested' ? 'pending' : 'none',
    cancellationReason: row.cancellation_reason || undefined,
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
  };
};

const mapByLegacyId = (documents) => new Map(
  documents
    .filter((document) => document.legacyId != null)
    .map((document) => [String(document.legacyId), document]),
);

async function main() {
  const apply = process.argv.includes('--apply');
  const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE', 'MONGO_URI', 'ORDER_MONGO_URI'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing migration configuration: ${missing.join(', ')}`);

  const mysqlConnection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    dateStrings: true,
    timezone: 'Z',
  });
  let referenceConnection;
  let orderConnection;

  try {
    referenceConnection = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
    orderConnection = await mongoose.createConnection(process.env.ORDER_MONGO_URI).asPromise();

    const referenceDb = referenceConnection.db;
    const orderCollection = orderConnection.collection('orders');
    const [orders] = await mysqlConnection.execute(
      'SELECT orders.*, stores.name AS store_name FROM orders LEFT JOIN stores ON stores.id = orders.store_id ORDER BY orders.id',
    );
    const [details] = await mysqlConnection.execute(
      'SELECT order_details.*, items.name AS item_name FROM order_details LEFT JOIN items ON items.id = order_details.item_id ORDER BY order_details.order_id, order_details.id',
    );
    const [stores, modules, zones] = await Promise.all([
      referenceDb.collection('stores').find({}).project({ _id: 1, legacyId: 1, name: 1 }).toArray(),
      referenceDb.collection('modules').find({}).project({ _id: 1, legacyId: 1 }).toArray(),
      referenceDb.collection('zones').find({}).project({ _id: 1, legacyId: 1 }).toArray(),
    ]);
    const references = {
      stores: mapByLegacyId(stores),
      modules: mapByLegacyId(modules),
      zones: mapByLegacyId(zones),
    };
    const detailsByOrder = new Map();
    for (const detail of details) {
      const key = String(detail.order_id);
      if (!detailsByOrder.has(key)) detailsByOrder.set(key, []);
      detailsByOrder.get(key).push(detail);
    }

    const documents = orders.map((order) => mapLegacyOrder(
      order,
      detailsByOrder.get(String(order.id)) || [],
      references,
    ));
    const existing = await orderCollection.countDocuments({
      legacyId: { $in: documents.map(({ legacyId }) => legacyId) },
    });

    if (apply && documents.length) {
      await orderCollection.createIndex({ legacyId: 1 }, { unique: true, sparse: true });
      await orderCollection.bulkWrite(documents.map((document) => ({
        updateOne: {
          filter: { legacyId: document.legacyId },
          update: { $setOnInsert: document },
          upsert: true,
        },
      })), { ordered: true });
    }

    const verified = apply
      ? await orderCollection.countDocuments({ legacyId: { $in: documents.map(({ legacyId }) => legacyId) } })
      : existing;
    if (apply && verified !== documents.length) {
      throw new Error(`Order migration verification failed: expected ${documents.length}, found ${verified}`);
    }
    process.stdout.write(`${JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      sourceOrders: documents.length,
      sourceOrderDetails: details.length,
      alreadyPresent: existing,
      verifiedInOrderService: verified,
    })}\n`);
  } finally {
    await Promise.all([
      mysqlConnection.end(),
      referenceConnection?.close(),
      orderConnection?.close(),
    ]);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Order migration failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { mapLegacyOrder };

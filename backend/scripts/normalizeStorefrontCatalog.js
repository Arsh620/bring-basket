const mongoose = require('mongoose');

const catalogFields = {
  stores: {
    flags: ['status', 'active', 'featured', 'delivery', 'takeAway', 'freeDelivery', 'selfDeliverySystem'],
    references: { moduleId: 'modules', zoneId: 'zones' },
  },
  items: {
    flags: ['status', 'isApproved', 'veg', 'trackBatch', 'offerAllowSingle'],
    numbers: ['price', 'mrp', 'stock'],
    references: { storeId: 'stores', moduleId: 'modules', categoryId: 'categories' },
    referenceArrays: { addOns: 'addons' },
  },
  addons: { flags: ['status'], references: { storeId: 'stores' } },
  zones: { flags: ['status', 'cashOnDelivery', 'digitalPayment', 'offlinePayment', 'increasedDeliveryFeeStatus'] },
  modules: { flags: ['status'] },
};

function normalizeFlag(value) {
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return value;
}

async function normalizeStorefrontCatalog(db, { apply = false, session } = {}) {
  if (apply && !session?.inTransaction()) throw new Error('Apply requires a MongoDB transaction');
  const legacy = { legacyId: { $exists: true, $ne: null } };
  const targets = new Map();
  const plans = new Map();
  const unresolved = new Map();
  const options = session ? { session } : {};

  for (const [name, { flags, numbers = [], references = {}, referenceArrays = {} }] of Object.entries(catalogFields)) {
    for (const target of new Set([...Object.values(references), ...Object.values(referenceArrays)])) {
      if (targets.has(target)) continue;
      const rows = await db.collection(target).find(legacy, options).project({ _id: 1, legacyId: 1 }).toArray();
      const byLegacyId = new Map(rows.map((row) => [String(row.legacyId), row._id]));
      if (byLegacyId.size !== rows.length) throw new Error(`Duplicate legacy IDs in ${target}`);
      targets.set(target, byLegacyId);
    }

    const fields = [...flags, ...numbers, ...Object.keys(references), ...Object.keys(referenceArrays)];
    const rows = db.collection(name).find(legacy, options).project(Object.fromEntries(fields.map((field) => [field, 1])));
    const operations = [];
    for await (const row of rows) {
      const changes = {};
      const recordUnresolved = (field, value) => {
        const gate = name === 'items' ? row.isApproved : name === 'stores' ? row.active : true;
        const key = `${name}.${field}=${value}`;
        const counts = unresolved.get(key) || { records: 0, active: 0 };
        counts.records += 1;
        if (normalizeFlag(row.status) === true && normalizeFlag(gate) === true) counts.active += 1;
        unresolved.set(key, counts);
      };
      for (const field of flags) {
        const value = normalizeFlag(row[field]);
        if (value !== row[field]) changes[field] = value;
      }
      for (const field of numbers) {
        const value = row[field];
        if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) changes[field] = Number(value);
      }
      for (const [field, target] of Object.entries(references)) {
        const value = row[field];
        if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value))) continue;
        const id = targets.get(target).get(String(value));
        if (id) {
          changes[field] = id;
          continue;
        }
        recordUnresolved(field, value);
      }
      for (const [field, target] of Object.entries(referenceArrays)) {
        const original = row[field];
        if (original === undefined) continue;
        let values = original === null ? [] : original;
        if (typeof values === 'string') {
          try { values = JSON.parse(values); } catch { values = null; }
        }
        if (!Array.isArray(values)) {
          recordUnresolved(field, 'invalid list');
          continue;
        }
        const ids = values.map((value) => {
          if (value instanceof mongoose.Types.ObjectId) return value;
          if (typeof value === 'string' && mongoose.isObjectIdOrHexString(value)) return new mongoose.Types.ObjectId(value);
          return targets.get(target).get(String(value));
        });
        if (ids.some((id) => !id)) {
          recordUnresolved(field, 'missing add-on');
          continue;
        }
        if (!Array.isArray(original) || values.some((value, index) => value !== ids[index])) changes[field] = ids;
      }
      if (Object.keys(changes).length) operations.push({
        updateOne: { filter: { _id: row._id }, update: { $set: changes } },
      });
    }
    plans.set(name, operations);
  }

  const result = {
    documents: Object.fromEntries([...plans].map(([name, operations]) => [name, operations.length])),
    unresolved: Object.fromEntries(unresolved),
  };
  if (!apply) return result;
  if ([...unresolved.values()].some(({ active }) => active > 0)) {
    throw new Error(`Unresolved references on active storefront records: ${JSON.stringify(result.unresolved)}`);
  }
  for (const [name, operations] of plans) {
    if (operations.length) await db.collection(name).bulkWrite(operations, { session });
  }
  return result;
}

async function run() {
  require('dotenv').config({ quiet: true });
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const { db } = mongoose.connection;
    const apply = process.argv.includes('--apply');
    const result = apply
      ? await mongoose.connection.transaction((session) => normalizeStorefrontCatalog(db, { apply, session }))
      : await normalizeStorefrontCatalog(db);
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'preview', database: db.databaseName, ...result }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { normalizeStorefrontCatalog };

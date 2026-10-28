require('dotenv').config();

const mongoose = require('mongoose');

const BATCH_SIZE = 500;
const applyChanges = process.argv.includes('--apply');
const ITEM_COLLECTION = 'items';
const STORE_STOCK_COLLECTION = 'storeitemstocks';

const migrateStoreStock = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set in backend/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const db = mongoose.connection.db;
  const itemsCollection = db.collection(ITEM_COLLECTION);
  const stockCollection = db.collection(STORE_STOCK_COLLECTION);
  let stockModel;
  if (applyChanges) {
    stockModel = require('../src/domains/inventory/store-item-stock.model');
    await stockModel.init();
  }

  const cursor = itemsCollection.find(
    { storeId: { $exists: true, $ne: null } },
    { projection: { _id: 1, storeId: 1, stock: 1 } },
  );
  let items = [];
  let created = 0;
  let skipped = 0;

  const flush = async () => {
    if (!items.length) return;
    const existing = await stockCollection.find({
      itemId: { $in: items.map((item) => item._id) },
      variant: '',
    }, { projection: { storeId: 1, itemId: 1 } }).toArray();
    const existingPairs = new Set(existing.map((record) => (
      `${record.storeId.toString()}:${record.itemId.toString()}`
    )));
    const missingItems = items.filter((item) => (
      !existingPairs.has(`${item.storeId.toString()}:${item._id.toString()}`)
    ));
    skipped += items.length - missingItems.length;

    if (applyChanges && missingItems.length) {
      const operations = missingItems.map((item) => ({
        updateOne: {
          filter: { storeId: item.storeId, itemId: item._id, variant: '' },
          update: {
            $setOnInsert: {
              storeId: item.storeId,
              itemId: item._id,
              variant: '',
              qty: item.stock ?? 0,
            },
          },
          upsert: true,
        },
      }));
      const result = await stockModel.bulkWrite(operations, { ordered: false });
      created += result.upsertedCount;
    } else {
      created += missingItems.length;
    }

    items = [];
  };

  for await (const item of cursor) {
    items.push(item);
    if (items.length >= BATCH_SIZE) await flush();
  }
  await flush();
  const action = applyChanges ? 'created' : 'would create';
  console.log(`Store stock migration ${applyChanges ? 'complete' : 'dry run'}: ${created} records ${action}, ${skipped} already existed.`);
};

migrateStoreStock()
  .catch((err) => {
    console.error('Store stock migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

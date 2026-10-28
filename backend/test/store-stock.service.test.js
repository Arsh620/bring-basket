const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const StoreItemStock = require('../src/domains/inventory/store-item-stock.model');
const storeStockService = require('../src/domains/inventory/store-stock.service');

const objectId = () => new mongoose.Types.ObjectId();

test('store stock reads prefer Inventory records and fall back to legacy Item.stock', async () => {
  const originalFind = StoreItemStock.find;
  const storeId = objectId();
  const inventoryItemId = objectId();
  const legacyItemId = objectId();
  StoreItemStock.find = () => ({
    lean: async () => [{ storeId, itemId: inventoryItemId, qty: 7 }],
  });

  try {
    const items = await storeStockService.getStoreStocks([
      { _id: inventoryItemId, storeId, stock: 2 },
      { _id: legacyItemId, storeId, stock: 4 },
    ]);
    assert.deepEqual(items.map((item) => item.stock), [7, 4]);
  } finally {
    StoreItemStock.find = originalFind;
  }
});

test('setting stock writes the quantity to Inventory instead of Item.stock', async () => {
  const originalFindOneAndUpdate = StoreItemStock.findOneAndUpdate;
  const originalDeleteMany = StoreItemStock.deleteMany;
  const stockContext = { itemId: objectId(), storeId: objectId() };
  let update;
  StoreItemStock.findOneAndUpdate = async (_filter, updateDoc) => {
    update = updateDoc;
    return { qty: updateDoc.$set.qty };
  };
  StoreItemStock.deleteMany = async () => ({ deletedCount: 0 });

  try {
    const result = await storeStockService.setStoreItemStock({ ...stockContext, qty: 12 });
    assert.equal(result.qty, 12);
    assert.deepEqual(update, { $set: { qty: 12 } });
  } finally {
    StoreItemStock.findOneAndUpdate = originalFindOneAndUpdate;
    StoreItemStock.deleteMany = originalDeleteMany;
  }
});

test('stock changes initialize missing records from legacy stock without going negative', async () => {
  const originalFindOne = StoreItemStock.findOne;
  const originalCreate = StoreItemStock.create;
  const stockContext = { itemId: objectId(), storeId: objectId(), legacyQty: 5 };
  let created;
  StoreItemStock.findOne = async () => null;
  StoreItemStock.create = async (record) => {
    created = record;
    return record;
  };

  try {
    const record = await storeStockService.changeStoreItemStock(stockContext, 3);
    assert.equal(record.qty, 8);
    assert.equal(created.qty, 8);
    await assert.rejects(
      storeStockService.changeStoreItemStock(stockContext, -9),
      { message: 'Insufficient store stock' },
    );
  } finally {
    StoreItemStock.findOne = originalFindOne;
    StoreItemStock.create = originalCreate;
  }
});

test('stock deductions use an atomic non-negative quantity check', async () => {
  const originalFindOne = StoreItemStock.findOne;
  const originalFindOneAndUpdate = StoreItemStock.findOneAndUpdate;
  const stockContext = { itemId: objectId(), storeId: objectId(), legacyQty: 5 };
  const stockRecord = { _id: objectId() };
  let updateFilter;
  StoreItemStock.findOne = async () => stockRecord;
  StoreItemStock.findOneAndUpdate = async (filter, update) => {
    updateFilter = filter;
    assert.deepEqual(update, { $inc: { qty: -3 } });
    return { qty: 2 };
  };

  try {
    const result = await storeStockService.changeStoreItemStock(
      stockContext,
      -3,
      stockContext.storeId,
    );
    assert.equal(result.qty, 2);
    assert.deepEqual(updateFilter, { _id: stockRecord._id, qty: { $gte: 3 } });
    await assert.rejects(
      storeStockService.changeStoreItemStock(stockContext, -3, objectId()),
      { message: 'Item does not belong to the requested store' },
    );
  } finally {
    StoreItemStock.findOne = originalFindOne;
    StoreItemStock.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('StoreItemStock has unique store, item, and variant ownership', () => {
  const index = StoreItemStock.schema.indexes().find(([fields, options]) => (
    fields.storeId === 1 && fields.itemId === 1 && fields.variant === 1 && options.unique
  ));
  assert.ok(index);
});

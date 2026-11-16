const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Item = require('../src/models/catalog/Item');
const Store = require('../src/models/store/Store');
const storeStockService = require('../src/domains/inventory/store-stock.service');
const customerItems = require('../src/domains/catalog/customer-items.controller');

test('customer item detail supports legacy numeric status and store references', async () => {
  const itemId = new mongoose.Types.ObjectId();
  const storeId = new mongoose.Types.ObjectId();
  const originalItemFindOne = Item.findOne;
  const originalItemCollectionFindOne = Item.collection.findOne;
  const originalStoreCollectionFindOne = Store.collection.findOne;
  const originalGetStoreStocks = storeStockService.getStoreStocks;
  let itemFilter;

  Item.findOne = async () => {
    throw new Error('Customer detail lookup should preserve legacy BSON values');
  };
  Item.collection.findOne = async (filter) => {
    itemFilter = filter;
    return {
      _id: itemId,
      storeId: 5,
      moduleId: 3,
      status: 1,
      isApproved: 1,
      name: 'Test item',
      price: 10,
    };
  };
  Store.collection.findOne = async (filter) => {
    assert.deepEqual(filter, {
      legacyId: 5,
      status: { $in: [true, 1, '1'] },
      active: { $in: [true, 1, '1'] },
    });
    return { _id: storeId };
  };
  storeStockService.getStoreStocks = async (items) => items;

  try {
    const response = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    await customerItems.getOne(
      { params: { id: itemId.toString() } },
      response,
      (error) => { throw error; },
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data._id, itemId.toString());
    assert.equal(response.body.data.storeId, storeId.toString());
    assert.ok(itemFilter._id instanceof mongoose.Types.ObjectId);
    assert.deepEqual(itemFilter.status.$in, [true, 1, '1']);
    assert.deepEqual(itemFilter.isApproved.$in, [true, 1, '1']);
  } finally {
    Item.findOne = originalItemFindOne;
    Item.collection.findOne = originalItemCollectionFindOne;
    Store.collection.findOne = originalStoreCollectionFindOne;
    storeStockService.getStoreStocks = originalGetStoreStocks;
  }
});

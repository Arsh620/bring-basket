const test = require('node:test');
const assert = require('node:assert/strict');

const { registeredModels } = require('../src/models/GeneratedBusinessModels');
const legacyOrder = registeredModels.orders;
const orderModel = require('../src/domains/orders/order.model');

test('canonical order model does not reuse the generated legacy Order model', () => {
  assert.equal(legacyOrder.modelName, 'Order');
  assert.notEqual(orderModel.modelName, legacyOrder.modelName);
  assert.equal(orderModel.collection.name, 'orders');
  assert.equal(orderModel.schema.path('orderNumber').isRequired, true);

  const order = new orderModel({ orderNumber: 'POS-test' });
  assert.equal(order.orderNumber, 'POS-test');
});

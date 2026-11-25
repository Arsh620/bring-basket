const test = require('node:test');
const assert = require('node:assert/strict');
const { mapLegacyOrder } = require('../scripts/migrateOrdersToOrderService');

test('legacy Laravel order conversion preserves order, store, status and line totals', () => {
  const order = mapLegacyOrder({
    id: 100001,
    user_id: 653,
    is_guest: 0,
    module_id: 3,
    store_id: 8,
    zone_id: 5,
    store_name: 'Sample Store',
    order_type: 'pos',
    order_status: 'delivered',
    payment_method: 'cash',
    payment_status: 'paid',
    order_amount: '135.38',
    coupon_discount_amount: '0',
    store_discount_amount: '18.75',
    total_tax_amount: '22.50',
    delivery_charge: '0',
    delivery_address: null,
    created_at: '2025-03-11 05:15:26',
    delivered: '2025-03-11 05:16:36',
  }, [{
    order_id: 100001,
    item_id: 6,
    item_details: JSON.stringify({ name: 'Mustard Oil' }),
    variant: '1LTR',
    price: '125.00',
    quantity: '1.000',
    discount_on_item: '18.75',
    total_add_on_price: '0',
    tax_amount: '22.50',
  }], {
    stores: new Map([['8', { _id: 'store-object-id', name: 'Sample Store' }]]),
    modules: new Map([['3', { _id: 'module-object-id' }]]),
    zones: new Map([['5', { _id: 'zone-object-id' }]]),
  });

  assert.equal(order.legacyId, 100001);
  assert.equal(order.orderNumber, '100001');
  assert.equal(order.ownerId, '653');
  assert.equal(order.orderType, 'pos');
  assert.equal(order.orderStatus, 'delivered');
  assert.equal(order.moduleId, 'module-object-id');
  assert.equal(order.storeId, 'store-object-id');
  assert.equal(order.zoneId, 'zone-object-id');
  assert.equal(order.deliveredAt.toISOString(), '2025-03-11T05:16:36.000Z');
  assert.deepEqual(order.items[0], {
    itemId: '6',
    itemName: 'Mustard Oil',
    variant: '1LTR',
    variations: [],
    addOns: [],
    addOnTotal: 0,
    quantity: 1,
    unitPrice: 125,
    discountAmount: 18.75,
    taxAmount: 22.5,
    lineTotal: 106.25,
  });
});

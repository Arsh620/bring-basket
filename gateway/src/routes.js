// Har service ka base URL — env se aata hai, default localhost ports
module.exports = {
  identity: {
    target: process.env.IDENTITY_SERVICE_URL || 'http://localhost:5001',
    pathPrefix: [
      '/api/v1/admin/auth',
      '/api/v1/admin/admins',
      '/api/v1/admin/roles',
      '/api/v1/customer/auth',
      '/api/v1/vendor/auth',
      '/api/v1/supplier/auth',
      '/api/v1/warehouse/auth',
      '/api/v1/deliveryman/auth',
    ],
  },
  catalog: {
    target: process.env.CATALOG_SERVICE_URL || 'http://localhost:5002',
    pathPrefix: [
      '/api/v1/admin/categories',
      '/api/v1/admin/brands',
      '/api/v1/admin/units',
      '/api/v1/admin/unit-groups',
      '/api/v1/admin/items',
      '/api/v1/admin/item-batches',
    ],
  },
  store: {
    target: process.env.STORE_SERVICE_URL || 'http://localhost:5003',
    pathPrefix: [
      '/api/v1/admin/modules',
      '/api/v1/admin/zones',
      '/api/v1/admin/stores',
    ],
  },
  inventory: {
    target: process.env.INVENTORY_SERVICE_URL || 'http://localhost:5004',
    pathPrefix: [
      '/api/v1/admin/warehouses',
      '/api/v1/admin/stock-movements',
      '/api/v1/admin/stock-transfers',
      '/api/v1/admin/store-stock-requests',
      '/api/v1/admin/batch-write-offs',
    ],
  },
  procurement: {
    target: process.env.PROCUREMENT_SERVICE_URL || 'http://localhost:5005',
    pathPrefix: [
      '/api/v1/admin/purchases',
    ],
  },
  order: {
    target: process.env.ORDER_SERVICE_URL || 'http://localhost:5006',
    pathPrefix: [
      '/api/v1/customer/orders',
      '/api/v1/customer/cart',
      '/api/v1/customer/coupons',
      '/api/v1/admin/orders',
    ],
  },
  accounting: {
    target: process.env.ACCOUNTING_SERVICE_URL || 'http://localhost:5007',
    pathPrefix: [
      '/api/v1/admin/accounting',
      '/api/v1/customer/wallet',
    ],
  },
  notification: {
    target: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5008',
    pathPrefix: [
      '/api/v1/admin/notifications',
      '/api/v1/customer/notifications',
    ],
  },
  settings: {
    target: process.env.SETTINGS_SERVICE_URL || 'http://localhost:5009',
    pathPrefix: [
      '/api/v1/admin/settings',
    ],
  },
};

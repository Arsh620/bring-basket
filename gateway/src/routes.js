// Har service ka base URL — env se aata hai, default localhost ports
module.exports = {
  // Identity service (5001) — all auth + admins + roles
  identity: {
    target: process.env.IDENTITY_SERVICE_URL || 'http://localhost:5001',
    pathPrefix: [
      '/api/v1/admin/auth',
      '/api/v1/admin/admins',
      '/api/v1/admin/roles',
      '/api/v1/customer/auth',
      '/api/v1/customer/addresses',
      '/api/v1/vendor/auth',
      '/api/v1/supplier/auth',
      '/api/v1/warehouse/auth',
      '/api/v1/deliveryman/auth',
    ],
  },

  // Catalog service (5002) — items, categories, brands, units
  catalog: {
    target: process.env.CATALOG_SERVICE_URL || 'http://localhost:5002',
    pathPrefix: [
      '/api/v1/admin/categories',
      '/api/v1/admin/brands',
      '/api/v1/admin/units',
      '/api/v1/admin/unit-groups',
      '/api/v1/admin/items',
      '/api/v1/admin/item-batches',
      '/api/v1/customer/items',
      '/api/v1/customer/categories',
    ],
  },

  // Store service (5003) — modules, zones, stores, banners, marketing
  store: {
    target: process.env.STORE_SERVICE_URL || 'http://localhost:5003',
    pathPrefix: [
      '/api/v1/admin/modules',
      '/api/v1/admin/zones',
      '/api/v1/admin/stores',
      '/api/v1/admin/banners',
      '/api/v1/admin/coupons',
      '/api/v1/admin/flash-sales',
      '/api/v1/admin/campaigns',
      '/api/v1/admin/advertisements',
      '/api/v1/customer/stores',
      '/api/v1/customer/zones',
      '/api/v1/customer/banners',
      '/api/v1/customer/flash-sales',
      '/api/v1/customer/campaigns',
      '/api/v1/customer/advertisements',
    ],
  },

  // Inventory service (5004) — warehouses, stock, transfers, requests
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

  // Procurement service (5005) — purchase orders, bills, payments, returns
  procurement: {
    target: process.env.PROCUREMENT_SERVICE_URL || 'http://localhost:5005',
    pathPrefix: [
      '/api/v1/admin/purchases',
    ],
  },

  // Order service (5006) — cart, orders
  order: {
    target: process.env.ORDER_SERVICE_URL || 'http://localhost:5006',
    pathPrefix: [
      '/api/v1/customer/cart',
      '/api/v1/customer/order',
      '/api/v1/customer/orders',
      '/api/v1/customer/coupons',
      '/api/v1/admin/orders',
    ],
  },

  // Accounting service (5007) — wallet, loyalty, cashback, wallet-bonus, customer mgmt
  accounting: {
    target: process.env.ACCOUNTING_SERVICE_URL || 'http://localhost:5007',
    pathPrefix: [
      '/api/v1/customer/wallet',
      '/api/v1/customer/loyalty-point',
      '/api/v1/cashback',
      '/api/v1/admin/cashback',
      '/api/v1/admin/wallet-bonus',
      '/api/v1/admin/customers',
    ],
  },

  // Notification service (5008) — in-app notifications
  notification: {
    target: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5008',
    pathPrefix: [
      '/api/v1/admin/notifications',
      '/api/v1/customer/notifications',
      '/api/v1/deliveryman/notifications',
    ],
  },

  // Payment service (5010) — Razorpay
  payment: {
    target: process.env.PAYMENT_SERVICE_URL || 'http://localhost:5010',
    pathPrefix: [
      '/api/v1/payment',
    ],
  },

  // Settings service — still on backend monolith (5000), extract later
  settings: {
    target: process.env.SETTINGS_SERVICE_URL || 'http://localhost:5000',
    pathPrefix: [
      '/api/v1/admin/settings',
      '/api/v1/config',
      '/api/v1/terms-and-conditions',
      '/api/v1/about-us',
      '/api/v1/privacy-policy',
      '/api/v1/refund-policy',
      '/api/v1/shipping-policy',
      '/api/v1/cancellation',
      '/api/v1/zones',
    ],
  },

  // Vendor portal — backend monolith (5000)
  vendor: {
    target: process.env.BACKEND_URL || 'http://localhost:5000',
    pathPrefix: [
      '/api/v1/vendor',
    ],
  },

  // Admin management — backend monolith (5000)
  adminMgmt: {
    target: process.env.BACKEND_URL || 'http://localhost:5000',
    pathPrefix: [
      '/api/v1/admin/vendors',
      '/api/v1/admin/delivery-men',
    ],
  },

  // Delivery man portal — backend monolith (5000)
  deliveryman: {
    target: process.env.BACKEND_URL || 'http://localhost:5000',
    pathPrefix: [
      '/api/v1/deliveryman',
    ],
  },
};

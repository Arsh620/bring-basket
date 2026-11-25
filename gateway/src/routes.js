// Har service ka base URL — env se aata hai, default localhost ports
module.exports = {
  // Identity service (5001) — all auth + admins + roles
  identity: {
    target: process.env.IDENTITY_SERVICE_URL || 'http://localhost:5001',
    pathPrefix: [
      '/api/v1/admin/auth',
      '/api/v1/admin/master',
      '/api/v1/admin/admins',
      '/api/v1/admin/employee-roles',
      '/api/v1/admin/roles',
      '/api/v1/customer/auth',
      '/api/v1/customer/addresses',
      '/api/v1/vendor/auth',
      '/api/v1/supplier/auth',
      '/api/v1/warehouse/auth',
      '/api/v1/deliveryman/auth',
      '/api/v1/vendor/roles',
      '/api/v1/vendor/employees',
    ],
  },

  // Catalog service (5002) — items, categories, brands, units, reviews
  catalog: {
    target: process.env.CATALOG_SERVICE_URL || 'http://localhost:5002',
    pathPrefix: [
      '/api/v1/admin/categories',
      '/api/v1/admin/brands',
      '/api/v1/admin/units',
      '/api/v1/admin/unit-groups',
      '/api/v1/admin/items',
      '/api/v1/admin/item-batches',
      '/api/v1/admin/reviews',
      '/api/v1/admin/item-review',
      '/api/v1/customer/items',
      '/api/v1/customer/categories',
      '/api/v1/item-review',
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
      '/api/v1/admin/brand-sales',
      '/api/v1/admin/advertisements',
      '/api/v1/customer/stores',
      '/api/v1/customer/zones',
      '/api/v1/customer/banners',
      '/api/v1/customer/flash-sales',
      '/api/v1/customer/campaigns',
      '/api/v1/customer/advertisements',
      '/api/v1/zones',
      '/api/v1/config',
      '/api/v1/terms-and-conditions',
      '/api/v1/about-us',
      '/api/v1/privacy-policy',
      '/api/v1/refund-policy',
      '/api/v1/shipping-policy',
      '/api/v1/cancellation',
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

  // Procurement service (5005) — purchase orders, bills, payments, returns, supplier
  procurement: {
    target: process.env.PROCUREMENT_SERVICE_URL || 'http://localhost:5005',
    pathPrefix: [
      '/api/v1/admin/purchases',
      '/api/v1/supplier',
    ],
  },

  // Order service (5006) — cart, orders, parcel, cancel reasons
  order: {
    target: process.env.ORDER_SERVICE_URL || 'http://localhost:5006',
    pathPrefix: [
      '/api/v1/customer/cart',
      '/api/v1/customer/order',
      '/api/v1/cart',
      '/api/v1/order',
      '/api/v1/parcel-categories',
      '/api/v1/cancel-reasons',
      '/api/v1/dm-review',
      '/api/v1/admin/orders',
      '/api/v1/admin/parcel-categories',
      '/api/v1/admin/cancel-reasons',
    ],
  },

  customerWishlist: {
    target: process.env.BACKEND_URL || 'http://localhost:5000',
    pathPrefix: ['/api/v1/customer/wish-list'],
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
      '/api/v1/admin/dashboard/customer-stats',
    ],
  },

  // Notification service (5008) — in-app notifications, push templates, chat
  notification: {
    target: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5008',
    pathPrefix: [
      '/api/v1/admin/notifications',
      '/api/v1/admin/automated-messages',
      '/api/v1/admin/conversations',
      '/api/v1/customer/notifications',
      '/api/v1/customer/conversations',
      '/api/v1/vendor/conversations',
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

  // POS + Accounting/GST — backend monolith (5000) until extracted
  pos: {
    target: process.env.BACKEND_URL || 'http://localhost:5000',
    pathPrefix: [
      '/api/v1/admin/pos',
      '/api/v1/vendor/pos',
      '/api/v1/admin/account',
    ],
  },

  // Vendor portal — backend monolith (5000)
  vendor: {
    target: process.env.BACKEND_URL || 'http://localhost:5000',
    pathPrefix: [
      '/api/v1/vendor',
    ],
  },

  // Warehouse portal — backend monolith (5000)
  warehouse: {
    target: process.env.BACKEND_URL || 'http://localhost:5000',
    pathPrefix: [
      '/api/v1/warehouse',
    ],
  },

  // Delivery man portal — backend monolith (5000)
  deliveryman: {
    target: process.env.BACKEND_URL || 'http://localhost:5000',
    pathPrefix: [
      '/api/v1/deliveryman',
    ],
  },

  // Admin management (vendors, DMs, reports, settings, disbursements) — monolith
  adminMgmt: {
    target: process.env.BACKEND_URL || 'http://localhost:5000',
    pathPrefix: [
      '/api/v1/admin/vendors',
      '/api/v1/admin/delivery-men',
      '/api/v1/admin/vehicles',
      '/api/v1/admin/dashboard/order-stats',
      '/api/v1/admin/settings',
      '/api/v1/admin/membership',
      '/api/v1/admin/loyalty',
      '/api/v1/admin/wallet',
      '/api/v1/admin/withdrawal-methods',
      '/api/v1/admin/store-disbursements',
      '/api/v1/admin/withdraw-requests',
      '/api/v1/admin/activity-logs',
      '/api/v1/admin/reports',
    ],
  },
};

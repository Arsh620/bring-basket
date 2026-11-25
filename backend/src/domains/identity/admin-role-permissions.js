const permissionModules = [
  { key: 'account', label: 'Account' },
  { key: 'collect_cash', label: 'Collect Cash' },
  { key: 'addon', label: 'Add-ons' },
  { key: 'attribute', label: 'Attributes' },
  { key: 'banner', label: 'Banners' },
  { key: 'campaign', label: 'Campaigns' },
  { key: 'category', label: 'Categories' },
  { key: 'coupon', label: 'Coupons' },
  { key: 'cashback', label: 'Cashback' },
  { key: 'customer_management', label: 'Customer Management' },
  { key: 'deliveryman', label: 'Delivery Man' },
  { key: 'provide_dm_earning', label: 'Provide Delivery Earnings' },
  { key: 'employee', label: 'Employees' },
  { key: 'custom_role', label: 'Custom Roles' },
  { key: 'item', label: 'Items / Products' },
  { key: 'notification', label: 'Notifications' },
  { key: 'order', label: 'Orders' },
  { key: 'store', label: 'Stores' },
  { key: 'report', label: 'Reports' },
  { key: 'settings', label: 'Settings' },
  { key: 'withdraw_list', label: 'Withdrawals' },
  { key: 'zone', label: 'Zones' },
  { key: 'module', label: 'Modules' },
  { key: 'parcel', label: 'Parcel' },
  { key: 'pos', label: 'Point of Sale' },
  { key: 'unit', label: 'Units' },
  { key: 'subscription', label: 'Subscriptions' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'purchase', label: 'Purchases' },
  { key: 'trip', label: 'Trips' },
  { key: 'promotion', label: 'Promotions' },
  { key: 'vehicle', label: 'Vehicles' },
  { key: 'provider', label: 'Providers' },
  { key: 'driver', label: 'Drivers' },
  { key: 'download_app', label: 'Download App' },
  { key: 'rental_report', label: 'Rental Reports' },
];

const permissionModuleKeys = new Set(permissionModules.map(({ key }) => key));

const normalizeModules = (value) => {
  let modules = value;
  if (typeof modules === 'string') {
    try {
      modules = JSON.parse(modules);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(modules)) return [];
  return [...new Set(modules.filter((module) => typeof module === 'string'))];
};

module.exports = { permissionModules, permissionModuleKeys, normalizeModules };

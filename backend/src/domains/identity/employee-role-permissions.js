const permissionModules = [
  { key: 'item', label: 'Items' },
  { key: 'order', label: 'Orders' },
  { key: 'store_setup', label: 'Store setup' },
  { key: 'addon', label: 'Add-ons' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'bank_info', label: 'Bank information' },
  { key: 'employee', label: 'Employees' },
  { key: 'custom_role', label: 'Custom roles' },
  { key: 'my_shop', label: 'My shop' },
  { key: 'campaign', label: 'Campaigns' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'pos', label: 'Point of sale' },
  { key: 'chat', label: 'Chat' },
];

const permissionModuleKeys = new Set(permissionModules.map(({ key }) => key));

const normalizeModules = (value) => {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((module) => typeof module === 'string'))];
};

module.exports = { permissionModules, permissionModuleKeys, normalizeModules };

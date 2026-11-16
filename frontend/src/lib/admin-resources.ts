export type AdminField = {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'boolean' | 'select' | 'json' | 'date';
  required?: boolean;
  placeholder?: string;
  createOnly?: boolean;
  editOnly?: boolean;
  options?: { label: string; value: string }[];
  optionsPath?: string;
  optionLabel?: string;
  optionValue?: string;
  nullable?: boolean;
  help?: string;
};

export type AdminResource = {
  key: string;
  title: string;
  description: string;
  endpoint: string;
  singular: string;
  icon: string;
  paginated?: boolean;
  searchable?: boolean;
  readOnly?: boolean;
  createOnly?: boolean;
  createEndpoint?: string;
  updateEndpoint?: string;
  deleteEndpoint?: string;
  statusEndpoint?: string;
  statusValues?: { active: string | boolean; inactive: string | boolean };
  extraAction?: 'schedule' | 'conversions';
  fields: AdminField[];
  columns: { key: string; label: string; type?: 'status' | 'date' | 'number' }[];
};

const activeStatus = { active: true, inactive: false };

export const adminResources: Record<string, AdminResource> = {
  items: {
    key: 'items',
    title: 'Products',
    description: 'Manage grocery products, pricing and store inventory.',
    endpoint: '/admin/items',
    singular: 'product',
    icon: 'Package',
    paginated: true,
    searchable: true,
    statusEndpoint: '/admin/items/:id/status',
    statusValues: activeStatus,
    fields: [
      { key: 'name', label: 'Product name', required: true },
      { key: 'storeId', label: 'Store', type: 'select', required: true, optionsPath: '/admin/stores', optionLabel: 'name' },
      { key: 'moduleId', label: 'Module', type: 'select', required: true, optionsPath: '/admin/modules', optionLabel: 'moduleName' },
      { key: 'categoryId', label: 'Category', type: 'select', nullable: true, optionsPath: '/admin/categories', optionLabel: 'name' },
      { key: 'brandId', label: 'Brand', type: 'select', nullable: true, optionsPath: '/admin/brands', optionLabel: 'name' },
      { key: 'unitId', label: 'Unit', type: 'select', nullable: true, optionsPath: '/admin/units', optionLabel: 'unit' },
      { key: 'sku', label: 'SKU' },
      { key: 'barcode', label: 'Barcode' },
      { key: 'price', label: 'Selling price', type: 'number', required: true },
      { key: 'mrp', label: 'MRP', type: 'number' },
      { key: 'purchasePrice', label: 'Purchase price', type: 'number' },
      { key: 'stock', label: 'Opening stock', type: 'number', help: 'Stock is saved to the store inventory ledger.' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'image', label: 'Image URL' },
      { key: 'status', label: 'Active', type: 'boolean' },
    ],
    columns: [
      { key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' },
      { key: 'price', label: 'Price', type: 'number' }, { key: 'stock', label: 'Stock', type: 'number' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
  },
  categories: {
    key: 'categories', title: 'Categories', description: 'Organize products into clear, easy-to-browse categories.',
    endpoint: '/admin/categories', singular: 'category', icon: 'Tags',
    statusEndpoint: '/admin/categories/:id/status', statusValues: activeStatus,
    fields: [
      { key: 'name', label: 'Category name', required: true },
      { key: 'moduleId', label: 'Module', type: 'select', required: true, optionsPath: '/admin/modules', optionLabel: 'moduleName' },
      { key: 'parentId', label: 'Parent category', type: 'select', nullable: true, optionsPath: '/admin/categories', optionLabel: 'name' },
      { key: 'priority', label: 'Display priority', type: 'number' },
      { key: 'image', label: 'Image URL' },
      { key: 'featured', label: 'Featured', type: 'boolean' },
      { key: 'isPromotion', label: 'Promotion category', type: 'boolean' },
      { key: 'status', label: 'Active', type: 'boolean' },
    ],
    columns: [{ key: 'name', label: 'Category' }, { key: 'moduleId', label: 'Module' }, { key: 'priority', label: 'Priority', type: 'number' }, { key: 'status', label: 'Status', type: 'status' }],
  },
  brands: {
    key: 'brands', title: 'Brands', description: 'Maintain the brands shown across your product catalog.',
    endpoint: '/admin/brands', singular: 'brand', icon: 'Bookmark',
    statusEndpoint: '/admin/brands/:id/status', statusValues: activeStatus,
    fields: [{ key: 'name', label: 'Brand name', required: true }, { key: 'slug', label: 'URL slug' }, { key: 'image', label: 'Image URL' }, { key: 'status', label: 'Active', type: 'boolean' }],
    columns: [{ key: 'name', label: 'Brand' }, { key: 'slug', label: 'Slug' }, { key: 'status', label: 'Status', type: 'status' }],
  },
  units: {
    key: 'units', title: 'Units', description: 'Set the individual units used to describe products.',
    endpoint: '/admin/units', singular: 'unit', icon: 'Ruler',
    fields: [{ key: 'unit', label: 'Unit name', required: true, placeholder: 'e.g. kilogram, piece, litre' }],
    columns: [{ key: 'unit', label: 'Unit' }],
  },
  'unit-groups': {
    key: 'unit-groups', title: 'Unit groups', description: 'Define base units and their conversion groups.',
    endpoint: '/admin/unit-groups', singular: 'unit group', icon: 'Layers', extraAction: 'conversions',
    statusEndpoint: '/admin/unit-groups/:id/status',
    fields: [
      { key: 'name', label: 'Group name', required: true },
      { key: 'baseUnit', label: 'Base unit', required: true, placeholder: 'e.g. gram' },
      { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }] },
    ],
    columns: [{ key: 'name', label: 'Group' }, { key: 'baseUnit', label: 'Base unit' }, { key: 'status', label: 'Status', type: 'status' }],
  },
  'item-batches': {
    key: 'item-batches', title: 'Item batches', description: 'Track batches, quantities and product expiry dates.',
    endpoint: '/admin/item-batches', singular: 'batch', icon: 'Layers', paginated: true,
    fields: [
      { key: 'itemId', label: 'Product', type: 'select', required: true, optionsPath: '/admin/items', optionLabel: 'name' },
      { key: 'storeId', label: 'Store', type: 'select', required: true, optionsPath: '/admin/stores', optionLabel: 'name' },
      { key: 'batchCode', label: 'Batch code' },
      { key: 'qty', label: 'Quantity', type: 'number', required: true },
      { key: 'expiryDate', label: 'Expiry date', type: 'date' },
    ],
    columns: [{ key: 'itemId', label: 'Product' }, { key: 'storeId', label: 'Store' }, { key: 'batchCode', label: 'Batch code' }, { key: 'qty', label: 'Quantity', type: 'number' }, { key: 'expiryDate', label: 'Expiry', type: 'date' }],
  },
  stores: {
    key: 'stores', title: 'Stores', description: 'Manage grocery store profiles, assignments and availability.',
    endpoint: '/admin/stores', singular: 'store', icon: 'Store', paginated: true, searchable: true,
    extraAction: 'schedule',
    statusEndpoint: '/admin/stores/:id/status', statusValues: activeStatus,
    fields: [
      { key: 'name', label: 'Store name', required: true },
      { key: 'phone', label: 'Phone number', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'vendorId', label: 'Vendor ID', required: true, help: 'Enter the existing vendor record ID.' },
      { key: 'moduleId', label: 'Module', type: 'select', required: true, optionsPath: '/admin/modules', optionLabel: 'moduleName' },
      { key: 'zoneId', label: 'Zone', type: 'select', nullable: true, optionsPath: '/admin/zones', optionLabel: 'name' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'minimumOrder', label: 'Minimum order', type: 'number' },
      { key: 'tax', label: 'Tax (%)', type: 'number' },
      { key: 'deliveryTime', label: 'Delivery estimate', placeholder: '30-40' },
      { key: 'status', label: 'Active', type: 'boolean' },
    ],
    columns: [{ key: 'name', label: 'Store' }, { key: 'phone', label: 'Phone' }, { key: 'moduleId', label: 'Module' }, { key: 'zoneId', label: 'Zone' }, { key: 'status', label: 'Status', type: 'status' }],
  },
  modules: {
    key: 'modules', title: 'Modules', description: 'Configure the business modules available to stores.',
    endpoint: '/admin/modules', singular: 'module', icon: 'Layers',
    statusEndpoint: '/admin/modules/:id/status', statusValues: activeStatus,
    fields: [
      { key: 'moduleName', label: 'Module name', required: true },
      { key: 'moduleType', label: 'Module type', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'themeId', label: 'Theme ID', type: 'number' },
      { key: 'allZoneService', label: 'Available in all zones', type: 'boolean' },
      { key: 'status', label: 'Active', type: 'boolean' },
    ],
    columns: [{ key: 'moduleName', label: 'Module' }, { key: 'moduleType', label: 'Type' }, { key: 'storesCount', label: 'Stores', type: 'number' }, { key: 'status', label: 'Status', type: 'status' }],
  },
  zones: {
    key: 'zones', title: 'Zones', description: 'Set delivery zones, boundaries and payment availability.',
    endpoint: '/admin/zones', singular: 'zone', icon: 'Map',
    statusEndpoint: '/admin/zones/:id/status', statusValues: activeStatus,
    fields: [
      { key: 'name', label: 'Zone name', required: true },
      { key: 'displayName', label: 'Display name' },
      { key: 'state', label: 'State', required: true },
      { key: 'coordinates', label: 'Coordinates (JSON)', type: 'json', required: true, placeholder: '[]', help: 'Paste the zone boundary coordinates as valid JSON.' },
      { key: 'cashOnDelivery', label: 'Cash on delivery', type: 'boolean' },
      { key: 'digitalPayment', label: 'Digital payment', type: 'boolean' },
      { key: 'offlinePayment', label: 'Offline payment', type: 'boolean' },
      { key: 'increasedDeliveryFee', label: 'Additional delivery fee', type: 'number' },
    ],
    columns: [{ key: 'name', label: 'Zone' }, { key: 'state', label: 'State' }, { key: 'status', label: 'Status', type: 'status' }],
  },
  warehouses: {
    key: 'warehouses', title: 'Warehouses', description: 'Manage warehouse locations and fulfillment hierarchy.',
    endpoint: '/admin/warehouses', singular: 'warehouse', icon: 'Warehouse',
    statusEndpoint: '/admin/warehouses/:id/status',
    statusValues: { active: 'active', inactive: 'inactive' },
    fields: [
      { key: 'name', label: 'Warehouse name', required: true },
      { key: 'code', label: 'Warehouse code', required: true },
      { key: 'type', label: 'Warehouse type', type: 'select', required: true, options: [{ label: 'Mother warehouse', value: 'mother' }, { label: 'Sub warehouse', value: 'sub' }] },
      { key: 'parentId', label: 'Parent warehouse ID', nullable: true },
      { key: 'ownerName', label: 'Owner / manager' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State', required: true },
      { key: 'zip', label: 'PIN code' },
      { key: 'country', label: 'Country', required: true },
      { key: 'isDefault', label: 'Default warehouse', type: 'boolean' },
      { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }] },
    ],
    columns: [{ key: 'name', label: 'Warehouse' }, { key: 'code', label: 'Code' }, { key: 'type', label: 'Type' }, { key: 'state', label: 'State' }, { key: 'status', label: 'Status', type: 'status' }],
  },
  admins: {
    key: 'admins', title: 'Administrators', description: 'Manage admin access and role assignments.',
    endpoint: '/admin/admins', singular: 'administrator', icon: 'Users',
    statusEndpoint: '/admin/admins/:id/status', statusValues: activeStatus,
    fields: [
      { key: 'fName', label: 'First name', required: true },
      { key: 'lName', label: 'Last name' },
      { key: 'email', label: 'Email', type: 'email', required: true, createOnly: true },
      { key: 'phone', label: 'Phone' },
      { key: 'password', label: 'Temporary password', type: 'password', required: true, createOnly: true },
      { key: 'roleId', label: 'Role', type: 'select', required: true, optionsPath: '/admin/roles', optionLabel: 'name' },
      { key: 'zoneId', label: 'Zone ID' },
      { key: 'status', label: 'Active', type: 'boolean' },
    ],
    columns: [{ key: 'fName', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'roleId', label: 'Role' }, { key: 'status', label: 'Status', type: 'status' }],
  },
  roles: {
    key: 'roles', title: 'Admin roles', description: 'Define administrator roles and module access.',
    endpoint: '/admin/roles', singular: 'role', icon: 'Shield',
    fields: [
      { key: 'name', label: 'Role name', required: true },
      { key: 'modules', label: 'Module permissions (JSON)', type: 'json', placeholder: '[]', help: 'Enter permissions as valid JSON.' },
      { key: 'status', label: 'Active', type: 'boolean' },
    ],
    columns: [{ key: 'name', label: 'Role' }, { key: 'status', label: 'Status', type: 'status' }],
  },
  'flash-sales': {
    key: 'flash-sales', title: 'Flash Sales', description: 'Create time-limited flash sales with special discounts.',
    endpoint: '/admin/flash-sales', singular: 'flash sale', icon: 'Zap', paginated: true,
    statusEndpoint: '/admin/flash-sales/:id/status', statusValues: activeStatus,
    fields: [
      { key: 'title', label: 'Title', required: true },
      { key: 'startDate', label: 'Start date', type: 'date', required: true },
      { key: 'endDate', label: 'End date', type: 'date', required: true },
      { key: 'moduleId', label: 'Module', type: 'select', nullable: true, optionsPath: '/admin/modules', optionLabel: 'moduleName' },
      { key: 'status', label: 'Active', type: 'boolean' },
    ],
    columns: [{ key: 'title', label: 'Title' }, { key: 'startDate', label: 'Start', type: 'date' }, { key: 'endDate', label: 'End', type: 'date' }, { key: 'status', label: 'Status', type: 'status' }],
  },
  campaigns: {
    key: 'campaigns', title: 'Campaigns', description: 'Manage promotional campaigns for stores and items.',
    endpoint: '/admin/campaigns', singular: 'campaign', icon: 'Megaphone', paginated: true,
    statusEndpoint: '/admin/campaigns/:id/status', statusValues: activeStatus,
    fields: [
      { key: 'title', label: 'Title', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'image', label: 'Image URL' },
      { key: 'type', label: 'Type', type: 'select', options: [{ label: 'Basic', value: 'basic' }, { label: 'Item', value: 'item' }] },
      { key: 'startDate', label: 'Start date', type: 'date', required: true },
      { key: 'endDate', label: 'End date', type: 'date', required: true },
      { key: 'moduleId', label: 'Module', type: 'select', nullable: true, optionsPath: '/admin/modules', optionLabel: 'moduleName' },
      { key: 'status', label: 'Active', type: 'boolean' },
    ],
    columns: [{ key: 'title', label: 'Title' }, { key: 'type', label: 'Type' }, { key: 'startDate', label: 'Start', type: 'date' }, { key: 'endDate', label: 'End', type: 'date' }, { key: 'status', label: 'Status', type: 'status' }],
  },
  advertisements: {
    key: 'advertisements', title: 'Advertisements', description: 'Manage promotional advertisements shown in the app.',
    endpoint: '/admin/advertisements', singular: 'advertisement', icon: 'Image', paginated: true,
    statusEndpoint: '/admin/advertisements/:id/status', statusValues: activeStatus,
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'image', label: 'Image URL', required: true },
      { key: 'type', label: 'Link type', type: 'select', options: [{ label: 'None', value: 'none' }, { label: 'Item', value: 'item' }, { label: 'Store', value: 'store' }, { label: 'URL', value: 'url' }] },
      { key: 'url', label: 'External URL' },
      { key: 'moduleId', label: 'Module', type: 'select', nullable: true, optionsPath: '/admin/modules', optionLabel: 'moduleName' },
      { key: 'status', label: 'Active', type: 'boolean' },
    ],
    columns: [{ key: 'title', label: 'Title' }, { key: 'type', label: 'Type' }, { key: 'moduleId', label: 'Module' }, { key: 'status', label: 'Status', type: 'status' }],
  },
  banners: {
    key: 'banners', title: 'Banners', description: 'Manage promotional banners shown on the customer app.',
    endpoint: '/admin/banners', singular: 'banner', icon: 'Image',
    statusEndpoint: '/admin/banners/:id/status', statusValues: activeStatus,
    fields: [
      { key: 'title', label: 'Banner title' },
      { key: 'image', label: 'Image URL', required: true },
      { key: 'type', label: 'Link type', type: 'select', options: [{ label: 'None', value: 'none' }, { label: 'Item', value: 'item' }, { label: 'Store', value: 'store' }, { label: 'Category', value: 'category' }, { label: 'URL', value: 'url' }] },
      { key: 'url', label: 'External URL' },
      { key: 'moduleId', label: 'Module', type: 'select', nullable: true, optionsPath: '/admin/modules', optionLabel: 'moduleName' },
      { key: 'zoneId', label: 'Zone', type: 'select', nullable: true, optionsPath: '/admin/zones', optionLabel: 'name' },
      { key: 'status', label: 'Active', type: 'boolean' },
    ],
    columns: [{ key: 'title', label: 'Title' }, { key: 'type', label: 'Type' }, { key: 'moduleId', label: 'Module' }, { key: 'status', label: 'Status', type: 'status' }],
  },
  coupons: {
    key: 'coupons', title: 'Coupons', description: 'Create and manage discount coupons for customers.',
    endpoint: '/admin/coupons', singular: 'coupon', icon: 'Ticket', paginated: true,
    statusEndpoint: '/admin/coupons/:id/status', statusValues: activeStatus,
    fields: [
      { key: 'title', label: 'Coupon title', required: true },
      { key: 'code', label: 'Coupon code', required: true, placeholder: 'e.g. SAVE20' },
      { key: 'couponType', label: 'Type', type: 'select', options: [{ label: 'Default', value: 'default' }, { label: 'First order', value: 'first_order' }, { label: 'Free delivery', value: 'free_delivery' }] },
      { key: 'discountType', label: 'Discount type', type: 'select', options: [{ label: 'Percent', value: 'percent' }, { label: 'Fixed amount', value: 'amount' }] },
      { key: 'discount', label: 'Discount value', type: 'number', required: true },
      { key: 'maxDiscount', label: 'Max discount cap', type: 'number' },
      { key: 'minPurchase', label: 'Minimum order amount', type: 'number' },
      { key: 'limit', label: 'Usage limit (0 = unlimited)', type: 'number' },
      { key: 'startDate', label: 'Start date', type: 'date', required: true },
      { key: 'expireDate', label: 'Expiry date', type: 'date', required: true },
      { key: 'moduleId', label: 'Module', type: 'select', nullable: true, optionsPath: '/admin/modules', optionLabel: 'moduleName' },
      { key: 'status', label: 'Active', type: 'boolean' },
    ],
    columns: [{ key: 'title', label: 'Title' }, { key: 'code', label: 'Code' }, { key: 'discount', label: 'Discount', type: 'number' }, { key: 'discountType', label: 'Type' }, { key: 'expireDate', label: 'Expires', type: 'date' }, { key: 'usedCount', label: 'Used', type: 'number' }, { key: 'status', label: 'Status', type: 'status' }],
  },
  customers: {
    key: 'customers',
    title: 'Customers',
    description: 'View and manage customer accounts, wallet balances and loyalty points.',
    endpoint: '/admin/customers',
    singular: 'customer',
    icon: 'Users',
    paginated: true,
    searchable: true,
    readOnly: true,
    statusEndpoint: '/admin/customers/:id/status',
    statusValues: activeStatus,
    fields: [],
    columns: [
      { key: 'fName', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'walletBalance', label: 'Wallet', type: 'number' },
      { key: 'loyaltyPoint', label: 'Points', type: 'number' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
  },
  vendors: {
    key: 'vendors',
    title: 'Vendors',
    description: 'Manage vendor accounts, approval status and store assignments.',
    endpoint: '/admin/vendors',
    singular: 'vendor',
    icon: 'Store',
    paginated: true,
    searchable: true,
    readOnly: true,
    statusEndpoint: '/admin/vendors/:id/status',
    statusValues: activeStatus,
    fields: [],
    columns: [
      { key: 'fName', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
  },
  'delivery-men': {
    key: 'delivery-men',
    title: 'Delivery Men',
    description: 'Manage delivery personnel, applications and active status.',
    endpoint: '/admin/delivery-men',
    singular: 'delivery man',
    icon: 'Users',
    paginated: true,
    searchable: true,
    statusEndpoint: '/admin/delivery-men/:id/status',
    statusValues: activeStatus,
    fields: [
      { key: 'fName', label: 'First name', required: true },
      { key: 'lName', label: 'Last name' },
      { key: 'email', label: 'Email', type: 'email', required: true, createOnly: true },
      { key: 'phone', label: 'Phone', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true, createOnly: true },
      { key: 'zoneId', label: 'Zone', type: 'select', nullable: true, optionsPath: '/admin/zones', optionLabel: 'name' },
      { key: 'status', label: 'Active', type: 'boolean' },
    ],
    columns: [
      { key: 'fName', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'applicationStatus', label: 'Application' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
  },
  cashback: {
    key: 'cashback',
    title: 'Cashback Rules',
    description: 'Configure cashback rules applied to customer orders.',
    endpoint: '/admin/cashback',
    singular: 'cashback rule',
    icon: 'Ticket',
    statusEndpoint: '/admin/cashback/:id/status',
    statusValues: activeStatus,
    fields: [
      { key: 'title', label: 'Title', required: true },
      { key: 'cashbackType', label: 'Type', type: 'select', required: true, options: [{ label: 'Percent', value: 'percent' }, { label: 'Fixed', value: 'fixed' }] },
      { key: 'cashback', label: 'Cashback value', type: 'number', required: true },
      { key: 'maxCashback', label: 'Max cashback cap', type: 'number' },
      { key: 'minPurchase', label: 'Minimum order', type: 'number' },
      { key: 'moduleId', label: 'Module', type: 'select', nullable: true, optionsPath: '/admin/modules', optionLabel: 'moduleName' },
      { key: 'status', label: 'Active', type: 'boolean' },
    ],
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'cashbackType', label: 'Type' },
      { key: 'cashback', label: 'Value', type: 'number' },
      { key: 'minPurchase', label: 'Min order', type: 'number' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
  },
  'wallet-bonus': {
    key: 'wallet-bonus',
    title: 'Wallet Bonus',
    description: 'Configure bonus amounts given when customers add funds to wallet.',
    endpoint: '/admin/wallet-bonus',
    singular: 'wallet bonus',
    icon: 'Ticket',
    statusEndpoint: '/admin/wallet-bonus/:id/status',
    statusValues: activeStatus,
    fields: [
      { key: 'minimumAddAmount', label: 'Minimum add amount', type: 'number', required: true },
      { key: 'bonusAmount', label: 'Bonus amount', type: 'number', required: true },
      { key: 'status', label: 'Active', type: 'boolean' },
    ],
    columns: [
      { key: 'minimumAddAmount', label: 'Min amount', type: 'number' },
      { key: 'bonusAmount', label: 'Bonus', type: 'number' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
  },
  'batch-write-offs': {
    key: 'batch-write-offs', title: 'Stock write-offs', description: 'Record expired, damaged or missing store stock and keep inventory balances accurate.',
    endpoint: '/admin/batch-write-offs', singular: 'write-off', icon: 'ClipboardMinus', paginated: true, createOnly: true,
    fields: [
      { key: 'itemId', label: 'Product', type: 'select', required: true, optionsPath: '/admin/items', optionLabel: 'name' },
      { key: 'storeId', label: 'Store', type: 'select', nullable: true, optionsPath: '/admin/stores', optionLabel: 'name' },
      { key: 'batchCode', label: 'Batch code' },
      { key: 'expiryDate', label: 'Expiry date', type: 'date' },
      { key: 'qty', label: 'Quantity to write off', type: 'number', required: true },
      { key: 'reason', label: 'Reason', required: true, placeholder: 'expired, damaged, missing…' },
    ],
    columns: [{ key: 'itemId', label: 'Product' }, { key: 'storeId', label: 'Store' }, { key: 'batchCode', label: 'Batch' }, { key: 'qty', label: 'Quantity', type: 'number' }, { key: 'reason', label: 'Reason' }],
  },
  'stock-movements': {
    key: 'stock-movements', title: 'Stock movements', description: 'Review the audit trail for warehouse stock changes and transfers.',
    endpoint: '/admin/stock-movements', singular: 'movement', icon: 'ArrowLeftRight', paginated: true, readOnly: true,
    fields: [],
    columns: [{ key: 'movedAt', label: 'Date', type: 'date' }, { key: 'itemId', label: 'Product' }, { key: 'warehouseId', label: 'Warehouse' }, { key: 'type', label: 'Movement' }, { key: 'qtyChange', label: 'Change', type: 'number' }, { key: 'balanceAfter', label: 'Balance', type: 'number' }, { key: 'note', label: 'Note' }],
  },
};

export const adminResourceGroups = [
  { label: 'Catalog', items: ['items', 'categories', 'brands', 'units', 'unit-groups', 'item-batches'] },
  { label: 'Stores & delivery', items: ['stores', 'modules', 'zones'] },
  { label: 'Inventory', items: ['warehouses', 'stock-movements', 'batch-write-offs'] },
  { label: 'Access control', items: ['admins', 'roles'] },
] as const;

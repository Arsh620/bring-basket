import type { useAuthStore } from '@/store/auth.store';

type Admin = NonNullable<ReturnType<typeof useAuthStore.getState>['admin']>;

const moduleByPath: Record<string, string> = {
  '/admin/catalog/items': 'item',
  '/admin/catalog/brands': 'item',
  '/admin/catalog/item-batches': 'item',
  '/admin/catalog/categories': 'category',
  '/admin/catalog/units': 'unit',
  '/admin/catalog/unit-groups': 'unit',
  '/admin/stores': 'store',
  '/admin/modules': 'module',
  '/admin/zones': 'zone',
  '/admin/warehouse': 'warehouse',
  '/admin/inventory': 'warehouse',
  '/admin/procurement': 'purchase',
  '/admin/orders': 'order',
  '/admin/banners': 'banner',
  '/admin/flash-sales': 'campaign',
  '/admin/campaigns': 'campaign',
  '/admin/advertisements': 'campaign',
  '/admin/brand-sales': 'campaign',
  '/admin/coupons': 'coupon',
  '/admin/customers': 'customer_management',
  '/admin/vendors': 'store',
  '/admin/delivery-men': 'deliveryman',
  '/admin/cashback': 'cashback',
  '/admin/wallet-bonus': 'customer_management',
  '/admin/membership': 'customer_management',
  '/admin/admins': 'employee',
  '/admin/employees': 'employee',
  '/admin/roles': 'custom_role',
  '/admin/account': 'account',
  '/admin/pos': 'pos',
  '/admin/reports': 'report',
  '/admin/notifications': 'notification',
  '/admin/conversations': 'notification',
  '/admin/withdraw-requests': 'withdraw_list',
  '/admin/store-disbursements': 'report',
  '/admin/parcel-categories': 'parcel',
  '/admin/cancel-reasons': 'order',
  '/admin/activity-logs': 'report',
  '/admin/vehicles': 'deliveryman',
  '/admin/settings': 'settings',
};

export const sidebarModuleByKey: Record<string, string> = {
  items: 'item',
  categories: 'category',
  brands: 'item',
  units: 'unit',
  'unit-groups': 'unit',
  'item-batches': 'item',
  stores: 'store',
  modules: 'module',
  zones: 'zone',
  warehouses: 'warehouse',
  admins: 'employee',
  roles: 'custom_role',
  'stock-movements': 'warehouse',
  'batch-write-offs': 'warehouse',
  'warehouse-stock': 'warehouse',
  'stock-transfers': 'warehouse',
  'store-stock-requests': 'warehouse',
  'purchase-vendors': 'purchase',
  'purchase-orders': 'purchase',
  'purchase-bills': 'purchase',
  'purchase-payments': 'purchase',
  'purchase-returns': 'purchase',
  'order-all': 'order',
  'order-stock-pending': 'order',
  'order-pending': 'order',
  'order-confirmed': 'order',
  'order-processing': 'order',
  'order-handover': 'order',
  'order-picked-up': 'order',
  'order-delivered': 'order',
  'order-canceling': 'order',
  'order-canceled': 'order',
  'order-failed': 'order',
  'order-refunds': 'order',
  'cancel-reasons': 'order',
  'parcel-categories': 'parcel',
  banners: 'banner',
  'flash-sales': 'campaign',
  campaigns: 'campaign',
  advertisements: 'campaign',
  'brand-sales': 'campaign',
  coupons: 'coupon',
  customers: 'customer_management',
  vendors: 'store',
  'delivery-men': 'deliveryman',
  vehicles: 'deliveryman',
  cashback: 'cashback',
  'wallet-bonus': 'customer_management',
  membership: 'customer_management',
  'withdraw-requests': 'withdraw_list',
  'store-disbursements': 'report',
  'activity-logs': 'report',
  reports: 'report',
  notifications: 'notification',
  conversations: 'notification',
  pos: 'pos',
  account: 'account',
  settings: 'settings',
};

const normalizedModules = (value: string[] | string | undefined) => {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as string[];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value.filter((module): module is string => typeof module === 'string') : [];
};

export function isPrimaryAdmin(admin: Admin | null) {
  return !!admin?.roleId && typeof admin.roleId === 'object' && Number(admin.roleId.legacyId) === 1;
}

export function getAdminDashboardPath(admin: Admin | null) {
  return isPrimaryAdmin(admin) ? '/admin/dashboard' : '/admin/employee-dashboard';
}

export function canAccessAdminModule(admin: Admin | null, module: string) {
  if (!admin?.roleId || admin.status === false || typeof admin.roleId !== 'object') return false;
  const role = admin.roleId;
  if (role.status === false) return false;
  if (isPrimaryAdmin(admin)) return true;
  if (admin.zoneId && module === 'zone') return false;
  return normalizedModules(role.modules).includes(module);
}

export function getAdminModuleForPath(pathname: string) {
  return Object.entries(moduleByPath)
    .sort(([a], [b]) => b.length - a.length)
    .find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1];
}

import type { useVendorStore } from '@/store/vendor.store';

type VendorUser = NonNullable<ReturnType<typeof useVendorStore.getState>['vendor']>;

const moduleByPath: Record<string, string> = {
  '/vendor/items': 'item',
  '/vendor/orders': 'order',
  '/vendor/pos': 'pos',
  '/vendor/stores': 'my_shop',
  '/vendor/roles': 'custom_role',
  '/vendor/employees': 'employee',
  '/vendor/store-stock-requests': 'item',
  '/vendor/wallet': 'bank_info',
  '/vendor/reviews': 'report',
};

export const vendorMenuModuleByPath: Record<string, string | undefined> = {
  '/vendor/dashboard': undefined,
  '/vendor/items': 'item',
  '/vendor/orders': 'order',
  '/vendor/pos': 'pos',
  '/vendor/stores': 'my_shop',
  '/vendor/roles': 'custom_role',
  '/vendor/employees': 'employee',
  '/vendor/store-stock-requests': 'item',
  '/vendor/wallet': 'bank_info',
  '/vendor/reviews': 'report',
};

const getModules = (vendor: VendorUser) => {
  const modules = vendor.modules
    ?? (typeof vendor.employeeRoleId === 'object' ? vendor.employeeRoleId.modules : undefined);
  if (typeof modules === 'string') {
    try {
      return JSON.parse(modules) as string[];
    } catch {
      return [];
    }
  }
  return Array.isArray(modules) ? modules : [];
};

export function canAccessVendorModule(vendor: VendorUser | null, module: string) {
  if (!vendor) return false;
  return !vendor.isEmployee || getModules(vendor).includes(module);
}

export function getVendorModuleForPath(pathname: string) {
  return Object.entries(moduleByPath)
    .sort(([a], [b]) => b.length - a.length)
    .find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1];
}

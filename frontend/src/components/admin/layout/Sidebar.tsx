'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Bookmark,
  Boxes,
  Building2,
  ChevronDown,
  Command,
  ClipboardList,
  ClipboardMinus,
  CreditCard,
  FileText,
  Zap,
  Megaphone,
  MessageSquare,
  Package2,
  Search,
  Settings,
  ShoppingBag,
  ShoppingBasket,
  LayoutDashboard,
  Layers,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  Ruler,
  RotateCcw,
  Shield,
  Star,
  Store,
  Tags,
  Ticket,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { canAccessAdminModule, getAdminDashboardPath, isPrimaryAdmin, sidebarModuleByKey } from '@/lib/admin-permissions';
import { useAuthStore } from '@/store/auth.store';

const iconByKey = {
  items: Package,
  categories: Tags,
  brands: Bookmark,
  units: Ruler,
  'unit-groups': Layers,
  'item-batches': Boxes,
  stores: Store,
  modules: Layers,
  zones: Map,
  warehouses: Building2,
  admins: Users,
  roles: Shield,
  'stock-movements': ArrowLeftRight,
  'batch-write-offs': ClipboardMinus,
  'warehouse-stock': Package,
  'stock-transfers': ArrowLeftRight,
  'store-stock-requests': ClipboardMinus,
  'purchase-vendors': Users,
  'purchase-orders': FileText,
  'purchase-bills': ShoppingBag,
  'purchase-payments': CreditCard,
  'purchase-returns': RotateCcw,
  'order-all': ClipboardList,
  'order-stock-pending': ClipboardList,
  'order-pending': ClipboardList,
  'order-confirmed': ClipboardList,
  'order-processing': ClipboardList,
  'order-handover': ClipboardList,
  'order-picked-up': ClipboardList,
  'order-delivered': ClipboardList,
  'order-canceling': ClipboardList,
  'order-canceled': ClipboardList,
  'order-failed': ClipboardList,
  banners: Megaphone,
  'flash-sales': Zap,
  campaigns: Megaphone,
  advertisements: Megaphone,
  coupons: Ticket,
  customers: Users,
  vendors: Store,
  'delivery-men': Truck,
  cashback: Ticket,
  'wallet-bonus': Wallet,
  settings: Settings,
  'brand-sales': Zap,
  'cancel-reasons': ClipboardMinus,
  'parcel-categories': Package2,
  'order-refunds': RotateCcw,
  membership: Star,
  'withdraw-requests': Wallet,
  'store-disbursements': CreditCard,
  'activity-logs': FileText,
  reports: BarChart3,
  notifications: Bell,
  conversations: MessageSquare,
  pos: ShoppingBag,
  account: CreditCard,
  vehicles: Truck,
} as const;

const groups = [
  { label: 'Order management', links: [['order-all', 'All orders'], ['order-stock-pending', 'Stock pending'], ['order-pending', 'Pending'], ['order-confirmed', 'Confirmed'], ['order-processing', 'Processing'], ['order-handover', 'Handover'], ['order-picked-up', 'Picked up'], ['order-delivered', 'Delivered'], ['order-canceling', 'Canceling'], ['order-canceled', 'Canceled'], ['order-failed', 'Failed'], ['order-refunds', 'Refund requests'], ['cancel-reasons', 'Cancel reasons'], ['parcel-categories', 'Parcel categories']] },
  { label: 'Procurement', links: [['purchase-vendors', 'Vendors'], ['purchase-orders', 'Purchase Orders'], ['purchase-bills', 'Purchase Bills'], ['purchase-returns', 'Purchase Returns'], ['purchase-payments', 'Payments']] },
  { label: 'Catalog', links: [['items', 'Products'], ['categories', 'Categories'], ['brands', 'Brands'], ['units', 'Units'], ['unit-groups', 'Unit groups'], ['item-batches', 'Item batches']] },
  { label: 'Stores & delivery', links: [['stores', 'Stores'], ['modules', 'Modules'], ['zones', 'Delivery zones']] },
  { label: 'Inventory', links: [['warehouses', 'Warehouses'], ['warehouse-stock', 'Warehouse stock'], ['stock-transfers', 'Stock transfers'], ['store-stock-requests', 'Store stock requests'], ['stock-movements', 'Stock movements'], ['batch-write-offs', 'Stock write-offs']] },
  { label: 'Marketing', links: [['banners', 'Banners'], ['flash-sales', 'Flash Sales'], ['campaigns', 'Campaigns'], ['advertisements', 'Advertisements'], ['coupons', 'Coupons'], ['brand-sales', 'Brand Sales']] },
  { label: 'User management', links: [['customers', 'Customers'], ['vendors', 'Vendors'], ['delivery-men', 'Delivery Men'], ['vehicles', 'Vehicles']] },
  { label: 'Promotions', links: [['cashback', 'Cashback Rules'], ['wallet-bonus', 'Wallet Bonus'], ['membership', 'Membership Plans']] },
  { label: 'Finance', links: [['withdraw-requests', 'Withdraw Requests'], ['store-disbursements', 'Store Disbursements'], ['account', 'Accounting & GST'], ['reports', 'Reports']] },
  { label: 'Communication', links: [['notifications', 'Push Notifications'], ['conversations', 'Conversations']] },
  { label: 'POS', links: [['pos', 'Point of Sale']] },
  { label: 'Access control', links: [['admins', 'Employees'], ['roles', 'Admin roles']] },
  { label: 'Configuration', links: [['settings', 'Business Settings'], ['activity-logs', 'Activity Logs']] },
] as const;

const hrefByKey: Record<string, string> = {
  items: '/admin/catalog/items',
  categories: '/admin/catalog/categories',
  brands: '/admin/catalog/brands',
  units: '/admin/catalog/units',
  'unit-groups': '/admin/catalog/unit-groups',
  'item-batches': '/admin/catalog/item-batches',
  stores: '/admin/stores',
  modules: '/admin/modules',
  zones: '/admin/zones',
  warehouses: '/admin/warehouse',
  admins: '/admin/employees',
  roles: '/admin/roles',
  'stock-movements': '/admin/inventory/stock-movements',
  'batch-write-offs': '/admin/inventory/batch-write-offs',
  'warehouse-stock': '/admin/inventory/warehouse-stock',
  'stock-transfers': '/admin/inventory/stock-transfers',
  'store-stock-requests': '/admin/inventory/store-stock-requests',
  'purchase-vendors': '/admin/procurement/vendors',
  'purchase-orders': '/admin/procurement/orders',
  'purchase-bills': '/admin/procurement/bills',
  'purchase-payments': '/admin/procurement/payments',
  'purchase-returns': '/admin/procurement/returns',
  'order-all': '/admin/orders',
  'order-stock-pending': '/admin/orders/stock_pending',
  'order-pending': '/admin/orders/pending',
  'order-confirmed': '/admin/orders/confirmed',
  'order-processing': '/admin/orders/processing',
  'order-handover': '/admin/orders/handover',
  'order-picked-up': '/admin/orders/picked_up',
  'order-delivered': '/admin/orders/delivered',
  'order-canceling': '/admin/orders/canceling',
  'order-canceled': '/admin/orders/canceled',
  'order-failed': '/admin/orders/failed',
  banners: '/admin/banners',
  'flash-sales': '/admin/flash-sales',
  campaigns: '/admin/campaigns',
  advertisements: '/admin/advertisements',
  coupons: '/admin/coupons',
  customers: '/admin/customers',
  vendors: '/admin/vendors',
  'delivery-men': '/admin/delivery-men',
  cashback: '/admin/cashback',
  'wallet-bonus': '/admin/wallet-bonus',
  membership: '/admin/membership',
  'brand-sales': '/admin/brand-sales',
  'cancel-reasons': '/admin/cancel-reasons',
  'parcel-categories': '/admin/parcel-categories',
  'order-refunds': '/admin/orders/refunds',
  'withdraw-requests': '/admin/withdraw-requests',
  'employees': '/admin/employees',
  'store-disbursements': '/admin/store-disbursements',
  'activity-logs': '/admin/activity-logs',
  reports: '/admin/reports',
  notifications: '/admin/notifications',
  conversations: '/admin/conversations',
  pos: '/admin/pos',
  account: '/admin/account',
  vehicles: '/admin/vehicles',
  settings: '/admin/settings',
};

export function Sidebar({ mobileOpen = false, onNavigate }: { mobileOpen?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const admin = useAuthStore((state) => state.admin);
  const master = isPrimaryAdmin(admin);
  const dashboardPath = getAdminDashboardPath(admin);
  const isDashboard = pathname === dashboardPath;
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [compact, setCompact] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const isCompact = compact && !mobileOpen;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = useMemo(
    () => groups.map((group) => ({
      ...group,
      links: group.links.filter(([key, label]) => {
        const permissionKey = sidebarModuleByKey[key];
        return permissionKey
          && canAccessAdminModule(admin, permissionKey)
          && (!normalizedQuery
            || label.toLowerCase().includes(normalizedQuery)
            || key.replaceAll('-', ' ').includes(normalizedQuery));
      }),
    })).filter((group) => group.links.length > 0),
    [admin, normalizedQuery],
  );

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      event.preventDefault();
      if (compact) {
        setCompact(false);
        window.setTimeout(() => searchRef.current?.focus(), 0);
      } else {
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, [compact]);

  const content = (
    <>
      <div className={`flex h-[88px] shrink-0 items-center border-b border-white/[0.08] ${isCompact ? 'flex-col justify-center gap-1 px-2' : 'justify-between px-3'}`}>
        <Link href={dashboardPath} onClick={onNavigate} title={isCompact ? 'Bring Basket dashboard' : undefined} className={`flex min-w-0 items-center ${isCompact ? 'justify-center' : 'flex-1'}`}>
          {isCompact ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffe500] text-[#08234b] shadow-md shadow-black/15">
              <ShoppingBasket size={19} strokeWidth={2.2} />
            </span>
          ) : (
            <Image
              src="/Bring Basket Logo.png"
              alt="Bring Basket"
              width={2000}
              height={650}
              priority
              className="h-[68px] w-full max-w-[218px] rounded-xl object-contain"
            />
          )}
        </Link>
        <button
          type="button"
          onClick={() => setCompact((value) => !value)}
          aria-label={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`hidden rounded-lg text-white/55 transition hover:bg-white/10 hover:text-[#ffe500] lg:inline-flex ${isCompact ? 'p-1' : 'p-2'}`}
        >
          {isCompact ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
        {onNavigate && <button type="button" aria-label="Close navigation" onClick={onNavigate} className="ml-1 rounded-lg p-2 text-white/55 transition hover:bg-white/10 hover:text-white lg:hidden"><X size={18} /></button>}
      </div>

      <div className={isCompact ? 'px-3 pb-2 pt-4' : 'px-4 pb-2 pt-5'}>
        {isCompact ? (
          <button
            type="button"
            aria-label="Expand sidebar to search navigation"
            title="Search pages"
            onClick={() => setCompact(false)}
            className="flex h-10 w-full items-center justify-center rounded-xl border border-white/[0.09] bg-[#0a274f]/75 text-white/55 transition hover:border-[#ffe500]/50 hover:text-[#ffe500]"
          >
            <Search size={16} />
          </button>
        ) : (
        <label className="group relative flex h-10 items-center gap-2.5 rounded-xl border border-white/[0.09] bg-[#0a274f]/75 px-3 text-white/45 transition focus-within:border-[#ffe500]/50 focus-within:bg-[#0a274f] focus-within:text-[#ffe500]">
          <Search size={15} className="shrink-0" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a page..."
            aria-label="Search navigation"
            className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/35"
          />
          {query ? (
            <button type="button" aria-label="Clear navigation search" onClick={() => setQuery('')} className="rounded p-0.5 text-white/40 transition hover:text-white">
              <X size={13} />
            </button>
          ) : (
            <kbd className="flex h-[21px] items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.06] px-1.5 text-[10px] font-medium text-white/45">
              <Command size={10} /> /
            </kbd>
          )}
        </label>
        )}
      </div>

      <nav aria-label="Admin navigation" className={`flex-1 overflow-y-auto pb-4 pt-3 ${isCompact ? 'space-y-3 px-2' : 'space-y-5 px-3'}`}>
        <div>
          {!isCompact && <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#c2d2ec]/55">Workspace</p>}
          <Link
            href={dashboardPath}
            onClick={onNavigate}
            aria-current={isDashboard ? 'page' : undefined}
            title={isCompact ? 'Overview' : undefined}
            className={`group relative flex items-center overflow-hidden rounded-xl py-3 text-sm font-semibold transition-all duration-200 ${isCompact ? 'justify-center px-0' : 'gap-3 px-3'} ${isDashboard ? 'bg-[#ffe500] text-[#08234b] shadow-lg shadow-black/15' : 'text-white/65 hover:bg-white/[0.07] hover:text-white'}`}
          >
            {isDashboard && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[#0755b8]" />}
            <LayoutDashboard size={16} className={isDashboard ? 'text-[#0755b8]' : 'text-white/45 transition group-hover:text-[#ffe500]'} />
            {!isCompact && <>Overview<span className={`ml-auto text-[10px] ${isDashboard ? 'text-[#08234b]/55' : 'text-white/25'}`}>01</span></>}
          </Link>
        </div>
        {visibleGroups.length === 0 && (
          <div className="mx-1 rounded-xl border border-dashed border-white/10 px-3 py-5 text-center">
            <Search size={17} className="mx-auto text-white/30" />
            <p className="mt-2 text-xs font-medium text-white/65">
              {normalizedQuery ? 'No pages found' : 'No sidebar pages assigned'}
            </p>
            <p className="mt-1 text-[10px] text-white/35">
              {normalizedQuery ? 'Try another search.' : 'Ask a Master admin to assign module access to this role.'}
            </p>
          </div>
        )}
        {visibleGroups.map((group) => {
          const collapsed = !normalizedQuery && Boolean(collapsedGroups[group.label]);
          const expanded = !collapsed;
          const groupId = `sidebar-group-${group.label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
          return (
          <section key={group.label}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={groupId}
              title={isCompact ? group.label : undefined}
              onClick={() => setCollapsedGroups((current) => ({ ...current, [group.label]: !current[group.label] }))}
              className={`mb-1.5 flex w-full items-center rounded-lg py-1.5 text-left transition hover:bg-white/[0.04] ${isCompact ? 'justify-center px-0' : 'justify-between px-3'}`}
            >
              {isCompact ? (
                <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.07] text-[10px] font-bold text-[#ffe500]">{group.label[0]}</span>
              ) : (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c2d2ec]/65">{group.label}</span>
                  <span className="flex items-center gap-2">
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-md bg-white/[0.07] px-1 text-[9px] font-semibold text-white/40">{group.links.length}</span>
                <ChevronDown size={13} className={`text-white/35 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
                  </span>
                </>
              )}
            </button>
            {expanded && <div id={groupId} className="space-y-0.5">
              {group.links.map(([key, label]) => {
                const Icon = iconByKey[key];
                const href = master && key === 'admins' ? '/master/employees'
                  : master && key === 'roles' ? '/master/roles'
                    : hrefByKey[key];
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={key}
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    title={isCompact ? label : undefined}
                    className={`group relative flex items-center overflow-hidden rounded-xl py-2.5 text-[13px] font-medium transition-all duration-200 ${isCompact ? 'justify-center px-0' : 'gap-3 px-3'} ${active ? 'bg-white/[0.11] text-white shadow-sm ring-1 ring-inset ring-white/[0.07]' : 'text-white/70 hover:translate-x-0.5 hover:bg-white/[0.06] hover:text-white'}`}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-[#ffe500]" />}
                    <Icon size={15} strokeWidth={active ? 2.2 : 1.8} className={active ? 'text-[#ffe500]' : 'text-white/40 transition group-hover:text-[#ffe500]'} />
                    {!isCompact && <span className="truncate">{label}</span>}
                    {!isCompact && active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffe500] shadow-[0_0_8px_rgba(255,229,0,0.5)]" />}
                  </Link>
                );
              })}
            </div>}
          </section>
          );
        })}
      </nav>

      <div className={`border-t border-white/[0.08] ${isCompact ? 'p-2' : 'p-3'}`}>
        <div title={isCompact ? 'Fresh goods. Better ops.' : undefined} className={`rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.07] to-white/[0.025] ${isCompact ? 'flex justify-center p-2' : 'px-3 py-3'}`}>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#ffe500] text-[#08234b]"><ShoppingBasket size={14} /></span>
            {!isCompact && <div>
              <p className="text-[11px] font-semibold text-white/85">Fresh goods. Better ops.</p>
              <p className="mt-0.5 text-[10px] text-white/40">Bring Basket admin</p>
            </div>}
          </div>
          {!isCompact && <div className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-2.5 text-[9px] font-medium text-white/35">
            <span>QUICK SEARCH</span>
            <span className="rounded border border-white/10 px-1.5 py-0.5 text-white/55">Press /</span>
          </div>}
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className={`hidden h-screen shrink-0 flex-col border-r border-[#061631] bg-[#071b3b] text-white transition-[width] duration-300 ease-in-out lg:flex ${isCompact ? 'w-[76px]' : 'w-[272px]'}`}>{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation overlay" className="absolute inset-0 bg-[#061631]/70 backdrop-blur-[2px]" onClick={onNavigate} />
          <aside className="relative flex h-full w-[min(86vw,320px)] flex-col border-r border-white/10 bg-[#071b3b] text-white shadow-2xl">{content}</aside>
        </div>
      )}
    </>
  );
}

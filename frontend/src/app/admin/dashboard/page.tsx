'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Building2,
  ChevronRight,
  Package,
  RefreshCw,
  Tags,
  Warehouse,
} from 'lucide-react';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api/client';
import { canAccessAdminModule, isPrimaryAdmin } from '@/lib/admin-permissions';
import { useAuthStore } from '@/store/auth.store';

/* ----------------------------- Types ----------------------------- */

interface ApiResponse<T> {
  data: T;
}

interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination: {
    total: number;
  };
}

interface DashboardItem {
  _id: string;
  name: string;
  stock?: number;
  categoryId?: { name?: string } | string | null;
}

interface OrderDashboardStats {
  period: 'this_week' | 'this_month' | 'this_year';
  totalOrders: number;
  newOrders: number;
  deliveredOrders: number;
  pendingOrders: number;
  canceledOrders: number;
  unassignedOrders: number;
  refundRequests: number;
  approvedRefunds: number;
  deliveredSales: number;
  periodDeliveredSales: number;
  statusCounts: Record<string, number>;
  dailySales: { date: string; label: string; sales: number; orders: number }[];
}

interface DashboardModule {
  _id: string;
  moduleName: string;
}

interface DashboardZone {
  _id: string;
  name: string;
}

interface DashboardData {
  itemCount: number | null;
  categoryCount: number | null;
  brandCount: number | null;
  storeCount: number | null;
  warehouseCount: number | null;
  lowStockItems: DashboardItem[];
}

interface CustomerDashboardStats {
  year: number;
  totalCustomers: number;
  activeCustomers: number;
  blockedCustomers: number;
  newCustomers: number;
  monthlyCustomers: { month: string; label: string; count: number }[];
}

/* --------------------------- Data fetching --------------------------- */

async function fetchDashboardData(access: {
  item: boolean;
  category: boolean;
  store: boolean;
  warehouse: boolean;
}): Promise<DashboardData> {
  const [items, categories, brands, stores, warehouses, lowStock] = await Promise.all([
    access.item ? api.get<PaginatedResponse<DashboardItem[]>>('/admin/items', { params: { page: 1, limit: 1 } }) : Promise.resolve(null),
    access.category ? api.get<ApiResponse<unknown[]>>('/admin/categories') : Promise.resolve(null),
    access.item ? api.get<ApiResponse<unknown[]>>('/admin/brands') : Promise.resolve(null),
    access.store ? api.get<PaginatedResponse<unknown[]>>('/admin/stores', { params: { page: 1, limit: 1 } }) : Promise.resolve(null),
    access.warehouse ? api.get<ApiResponse<unknown[]>>('/admin/warehouses') : Promise.resolve(null),
    access.item ? api.get<ApiResponse<DashboardItem[]>>('/admin/items/low-stock', { params: { threshold: 10 } }) : Promise.resolve(null),
  ]);

  return {
    itemCount: items?.data.pagination.total ?? null,
    categoryCount: categories?.data.data.length ?? null,
    brandCount: brands?.data.data.length ?? null,
    storeCount: stores?.data.pagination.total ?? null,
    warehouseCount: warehouses?.data.data.length ?? null,
    lowStockItems: lowStock?.data.data.slice(0, 6) ?? [],
  };
}

/* ------------------------------ Config ------------------------------ */

const catalogStats = [
  { key: 'itemCount', module: 'item', label: 'Items', icon: Package, href: '/admin/catalog/items' },
  { key: 'categoryCount', module: 'category', label: 'Categories', icon: Tags, href: '/admin/catalog/categories' },
  { key: 'brandCount', module: 'item', label: 'Brands', icon: Boxes, href: '/admin/catalog/brands' },
  { key: 'storeCount', module: 'store', label: 'Stores', icon: Building2, href: '/admin/stores' },
  { key: 'warehouseCount', module: 'warehouse', label: 'Warehouses', icon: Warehouse, href: '/admin/warehouse' },
] as const;

const quickLinks = [
  { module: 'item', label: 'Products', detail: 'Manage your catalog', href: '/admin/catalog/items', icon: Package },
  { module: 'store', label: 'Stores', detail: 'Manage store details', href: '/admin/stores', icon: Building2 },
  { module: 'warehouse', label: 'Warehouse stock', detail: 'Review stock levels', href: '/admin/inventory/warehouse-stock', icon: Warehouse },
] as const;

const dashboardPeriods = [
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'this_year', label: 'This year' },
] as const;

/** Orders move left to right through these stages. */
const orderFlow = [
  { key: 'stock_pending', label: 'Stock pending' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'processing', label: 'Processing' },
  { key: 'handover', label: 'Handover' },
  { key: 'picked_up', label: 'Picked up' },
  { key: 'delivered', label: 'Delivered' },
] as const;

/** Orders that left the normal flow. */
const orderExceptions = [
  { key: 'canceling', label: 'Canceling' },
  { key: 'canceled', label: 'Canceled' },
  { key: 'failed', label: 'Failed' },
] as const;

/* ----------------------------- Helpers ----------------------------- */

const inr = (value: number) => `₹${value.toLocaleString('en-IN')}`;

function getCategoryName(category: DashboardItem['categoryId']) {
  if (!category) return '—';
  return typeof category === 'string' ? category : category.name || '—';
}

interface BarDatum {
  key: string;
  label: string;
  value: number;
  title: string;
}

function BarChart({
  data,
  tone,
  ariaLabel,
  formatMax,
}: {
  data: BarDatum[];
  tone: 'dark' | 'light';
  ariaLabel: string;
  formatMax: (max: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const dark = tone === 'dark';

  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="relative h-36">
        <div
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 flex items-center gap-2 text-[10px] ${dark ? 'text-blue-200/60' : 'text-gray-400'}`}
        >
          <span>{formatMax(max)}</span>
          <span className={`h-px flex-1 ${dark ? 'bg-white/10' : 'bg-gray-200'}`} />
        </div>
        <div aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-px ${dark ? 'bg-white/20' : 'bg-gray-200'}`} />
        <div className="absolute inset-x-0 bottom-0 top-4 flex items-end gap-1 sm:gap-1.5">
          {data.map((d) => (
            <div key={d.key} title={d.title} className="flex h-full min-w-0 flex-1 items-end">
              <div
                className={`w-full rounded-t-[3px] transition-opacity hover:opacity-80 ${dark ? 'bg-[#ffe500]' : 'bg-[#0755b8]'}`}
                style={{ height: d.value ? `${Math.max(4, (d.value / max) * 100)}%` : '2px', opacity: d.value ? undefined : 0.25 }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-1 sm:gap-1.5" aria-hidden="true">
        {data.map((d, index) => (
          <span
            key={d.key}
            className={`min-w-0 flex-1 truncate text-center text-[10px] ${dark ? 'text-blue-200/70' : 'text-gray-400'}`}
          >
            {index % labelEvery === 0 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-9 min-w-28 rounded-lg border border-[#d7e1ef] bg-white px-2.5 text-sm font-medium text-[#0b2346] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0755b8] disabled:opacity-60"
      >
        {children}
      </select>
    </label>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

/* ------------------------------ Page ------------------------------ */

function DashboardContent() {
  const admin = useAuthStore((state) => state.admin);
  const primaryAdmin = isPrimaryAdmin(admin);
  const canViewOrders = canAccessAdminModule(admin, 'order');
  const canViewCustomers = canAccessAdminModule(admin, 'customer_management');
  const canSelectModule = canAccessAdminModule(admin, 'module');
  const canSelectZone = canAccessAdminModule(admin, 'zone');
  const [orderFilters, setOrderFilters] = useState({
    period: 'this_year' as OrderDashboardStats['period'],
    moduleId: 'all',
    zoneId: 'all',
  });
  const access = {
    item: canAccessAdminModule(admin, 'item'),
    category: canAccessAdminModule(admin, 'category'),
    store: canAccessAdminModule(admin, 'store'),
    warehouse: canAccessAdminModule(admin, 'warehouse'),
  };

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-dashboard', access],
    queryFn: () => fetchDashboardData(access),
  });
  const modules = useQuery({
    queryKey: ['admin-dashboard-modules'],
    queryFn: async () => (await api.get<ApiResponse<DashboardModule[]>>('/admin/modules')).data.data,
    enabled: canSelectModule,
  });
  const zones = useQuery({
    queryKey: ['admin-dashboard-zones'],
    queryFn: async () => (await api.get<ApiResponse<DashboardZone[]>>('/admin/zones')).data.data,
    enabled: canSelectZone,
  });
  const activeOrderFilters = {
    period: orderFilters.period,
    moduleId: canSelectModule ? orderFilters.moduleId : 'all',
    zoneId: canSelectZone ? orderFilters.zoneId : 'all',
  };
  const orderStats = useQuery({
    queryKey: ['admin-dashboard-order-stats', activeOrderFilters],
    queryFn: async () => (
      await api.get<{ data: OrderDashboardStats }>('/admin/dashboard/order-stats', { params: activeOrderFilters })
    ).data.data,
    enabled: canViewOrders,
  });
  const customerStats = useQuery({
    queryKey: ['admin-dashboard-customer-stats', activeOrderFilters.zoneId],
    queryFn: async () => (
      await api.get<{ data: CustomerDashboardStats }>('/admin/dashboard/customer-stats', {
        params: { zoneId: activeOrderFilters.zoneId },
      })
    ).data.data,
    enabled: canViewCustomers,
  });

  const isRefreshing =
    isFetching || orderStats.isFetching || customerStats.isFetching || modules.isFetching || zones.isFetching;
  const visibleCatalogStats = catalogStats.filter((stat) => canAccessAdminModule(admin, stat.module));
  const visibleQuickLinks = quickLinks.filter((link) => canAccessAdminModule(admin, link.module));
  const periodLabel = dashboardPeriods.find(({ value }) => value === orderFilters.period)?.label ?? '';
  const stats = orderStats.data;

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#0b2346]">{primaryAdmin ? 'Dashboard' : 'Employee dashboard'}</h2>
          <p className="mt-1 text-sm text-gray-500">{primaryAdmin ? 'Orders, customers and stock across Bring Basket.' : 'Overview of the modules assigned to your role.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canSelectModule && (
            <FilterSelect
              label="Module"
              value={orderFilters.moduleId}
              onChange={(moduleId) => setOrderFilters((current) => ({ ...current, moduleId }))}
              disabled={modules.isLoading}
            >
              <option value="all">All modules</option>
              {(modules.data || []).map((module) => (
                <option key={module._id} value={module._id}>{module.moduleName}</option>
              ))}
            </FilterSelect>
          )}
          {canSelectZone && (
            <FilterSelect
              label="Zone"
              value={orderFilters.zoneId}
              onChange={(zoneId) => setOrderFilters((current) => ({ ...current, zoneId }))}
              disabled={zones.isLoading}
            >
              <option value="all">All zones</option>
              {(zones.data || []).map((zone) => (
                <option key={zone._id} value={zone._id}>{zone.name}</option>
              ))}
            </FilterSelect>
          )}
          {canViewOrders && (
            <FilterSelect
              label="Period"
              value={orderFilters.period}
              onChange={(period) => setOrderFilters((current) => ({
                ...current,
                period: period as OrderDashboardStats['period'],
              }))}
            >
              {dashboardPeriods.map((period) => (
                <option key={period.value} value={period.value}>{period.label}</option>
              ))}
            </FilterSelect>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => void Promise.all([
              refetch(),
              ...(canViewOrders ? [orderStats.refetch()] : []),
              ...(canViewCustomers ? [customerStats.refetch()] : []),
              ...(canSelectModule ? [modules.refetch()] : []),
              ...(canSelectZone ? [zones.refetch()] : []),
            ])}
            disabled={isRefreshing}
            aria-label="Refresh dashboard data"
            className="border-[#d7e1ef] bg-white text-[#12396b] hover:bg-[#f1f5fb]"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </header>

      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>Catalog and stock data could not be loaded. Check the API connection and try again.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      <div className={canViewOrders ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]' : 'grid gap-6'}>
        {/* ------------------------ Main column ------------------------ */}
        {canViewOrders && (
          <div className="min-w-0 space-y-6">
            {/* Sales panel: the one bold element on the page */}
            <section aria-label="Sales" className="overflow-hidden rounded-2xl bg-[#0a2b59] text-white shadow-lg shadow-[#082b5a]/10">
              {orderStats.isLoading ? (
                <div className="space-y-4 p-6">
                  <Skeleton className="h-6 w-40 !bg-white/10" />
                  <Skeleton className="h-40 !bg-white/10" />
                </div>
              ) : orderStats.isError ? (
                <div role="alert" className="p-6 text-sm text-red-200">
                  Order analytics could not be loaded. Refresh the dashboard to retry.
                </div>
              ) : stats ? (
                <>
                  <div className="p-6 pb-4">
                    <p className="text-sm text-blue-200">Delivered sales · {periodLabel}</p>
                    <p className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">{inr(stats.periodDeliveredSales)}</p>
                    <p className="mt-1 text-xs text-blue-200/70">All time: {inr(stats.deliveredSales)}</p>
                  </div>
                  <div className="px-6 pb-5">
                    <BarChart
                      tone="dark"
                      ariaLabel={`Delivered sales for ${periodLabel}`}
                      formatMax={inr}
                      data={stats.dailySales.map((day) => ({
                        key: day.date,
                        label: day.label,
                        value: day.sales,
                        title: `${day.date}: ${inr(day.sales)} (${day.orders} orders)`,
                      }))}
                    />
                  </div>
                  <dl className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 bg-black/10 sm:grid-cols-4">
                    {[
                      ['All orders', stats.totalOrders],
                      ['New orders', stats.newOrders],
                      ['Delivered', stats.deliveredOrders],
                      ['Pending', stats.pendingOrders],
                    ].map(([label, value]) => (
                      <div key={label} className="px-5 py-3.5">
                        <dt className="text-xs text-blue-200">{label}</dt>
                        <dd className="mt-0.5 text-xl font-bold">{Number(value).toLocaleString('en-IN')}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : null}
            </section>

            {/* Order pipeline */}
            <Card className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
              <CardHeader className="border-b border-gray-100 pb-3">
                <CardTitle className="text-base font-semibold text-gray-900">Orders by status</CardTitle>
                <p className="mt-0.5 text-sm text-gray-500">Current count at each stage. Select a stage to open its orders.</p>
              </CardHeader>
              <CardContent className="space-y-4 px-5 py-4">
                {orderStats.isLoading || !stats ? (
                  <Skeleton className="h-20" />
                ) : (
                  <>
                    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                      {orderFlow.map((status, index) => (
                        <li key={status.key} className="relative">
                          <Link
                            href={`/admin/orders/${status.key}`}
                            className="block rounded-lg border border-[#e3e9f2] bg-[#f6f8fc] px-3 py-2.5 transition hover:border-[#0755b8] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0755b8]"
                          >
                            <span className="block truncate text-xs text-gray-500">{status.label}</span>
                            <span className="mt-0.5 block text-lg font-bold text-[#0b2346]">
                              {(stats.statusCounts[status.key] || 0).toLocaleString('en-IN')}
                            </span>
                          </Link>
                          {index < orderFlow.length - 1 && (
                            <ChevronRight
                              aria-hidden="true"
                              size={14}
                              className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 text-gray-300 lg:block"
                            />
                          )}
                        </li>
                      ))}
                    </ol>
                    <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                      <span className="mr-1 text-xs font-medium text-gray-500">Left the flow</span>
                      {orderExceptions.map((status) => (
                        <Link
                          key={status.key}
                          href={`/admin/orders/${status.key}`}
                          className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs text-red-800 transition hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        >
                          {status.label}
                          <span className="font-bold">{(stats.statusCounts[status.key] || 0).toLocaleString('en-IN')}</span>
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ----------------------- Side column ----------------------- */}
        <aside className="min-w-0 space-y-6">
          {canViewOrders && stats && (
            <Card className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
              <CardHeader className="border-b border-gray-100 pb-3">
                <CardTitle className="text-base font-semibold text-gray-900">Needs action</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-gray-100 p-0">
                {[
                  ['Unassigned delivery orders', stats.unassignedOrders],
                  ['Refund requests', stats.refundRequests],
                  ['Canceled or failed', stats.canceledOrders],
                  ['Approved refunds', stats.approvedRefunds],
                ].map(([label, value], index) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="text-sm text-gray-600">{label}</span>
                    <Badge
                      variant="outline"
                      className={
                        index < 2 && Number(value) > 0
                          ? 'border-amber-300 bg-amber-50 font-bold text-amber-800'
                          : 'border-gray-200 font-semibold text-[#0b2346]'
                      }
                    >
                      {Number(value).toLocaleString('en-IN')}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {access.item && (
            <Card className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
              <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-gray-100 pb-3">
                <div>
                  <CardTitle className="text-base font-semibold text-gray-900">Low stock</CardTitle>
                  <p className="mt-0.5 text-sm text-gray-500">Active items with 10 or fewer units.</p>
                </div>
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="space-y-2 p-4" aria-label="Loading low-stock items">
                    {[0, 1, 2].map((row) => <Skeleton key={row} className="h-10" />)}
                  </div>
                ) : data?.lowStockItems.length ? (
                  <ul className="divide-y divide-gray-100">
                    {data.lowStockItems.map((item) => (
                      <li key={item._id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">{item.name}</p>
                          <p className="truncate text-xs text-gray-500">{getCategoryName(item.categoryId)}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 border-amber-300 bg-amber-50 font-bold text-amber-800">
                          {item.stock ?? 0} left
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-5 py-8 text-center">
                    <Package className="mx-auto mb-2 text-gray-300" size={26} aria-hidden="true" />
                    <p className="text-sm font-medium text-gray-700">Stock levels are healthy</p>
                    <p className="mt-1 text-xs text-gray-500">No item is at or below 10 units.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {visibleQuickLinks.length > 0 && (
            <nav aria-label="Quick links" className="overflow-hidden rounded-xl border border-[#dce4ef] bg-white shadow-sm">
              {visibleQuickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-[#f6f8fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0755b8]"
                >
                  <link.icon size={18} className="shrink-0 text-[#0755b8]" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#0b2346]">{link.label}</span>
                    <span className="block truncate text-xs text-gray-500">{link.detail}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-gray-300 transition group-hover:text-[#0755b8]" aria-hidden="true" />
                </Link>
              ))}
            </nav>
          )}
        </aside>
      </div>

      {/* Catalog summary: one connected strip instead of five separate cards */}
      {visibleCatalogStats.length > 0 && (
        <section aria-label="Business summary">
          <ul className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#dce4ef] bg-white shadow-sm sm:grid-cols-3 xl:grid-cols-5 [&>li]:border-b [&>li]:border-r [&>li]:border-gray-100">
            {visibleCatalogStats.map((stat) => (
              <li key={stat.key}>
                <Link
                  href={stat.href}
                  aria-label={`View ${stat.label}`}
                  className="flex items-center gap-3 px-4 py-4 transition hover:bg-[#f6f8fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0755b8]"
                >
                  <stat.icon size={20} className="shrink-0 text-[#0755b8]" aria-hidden="true" />
                  <span>
                    {isLoading ? (
                      <Skeleton className="h-6 w-12" />
                    ) : (
                      <span className="block text-xl font-bold leading-tight text-[#0b2346]">
                        {data?.[stat.key]?.toLocaleString('en-IN') ?? '—'}
                      </span>
                    )}
                    <span className="block text-xs text-gray-500">{stat.label}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Customers */}
      {canViewCustomers && (
        <section aria-label="Customer overview">
          {customerStats.isLoading ? (
            <Skeleton className="h-56 rounded-2xl" />
          ) : customerStats.isError ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Customer overview could not be loaded. Refresh the dashboard to retry.
            </div>
          ) : customerStats.data ? (
            <Card className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
              <CardHeader className="border-b border-gray-100 pb-3">
                <CardTitle className="text-base font-semibold text-gray-900">Customers</CardTitle>
                <p className="mt-0.5 text-sm text-gray-500">
                  New signups per month in {customerStats.data.year}
                  {activeOrderFilters.zoneId === 'all' ? ', all zones.' : ', selected zone.'}
                </p>
              </CardHeader>
              <CardContent className="grid gap-6 px-5 py-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-1 lg:gap-y-3">
                  {[
                    ['Total customers', customerStats.data.totalCustomers],
                    ['Active', customerStats.data.activeCustomers],
                    ['Blocked', customerStats.data.blockedCustomers],
                    ['Joined in last 30 days', customerStats.data.newCustomers],
                  ].map(([label, count]) => (
                    <div key={label} className="lg:flex lg:items-baseline lg:justify-between lg:border-b lg:border-gray-100 lg:pb-2 lg:last:border-b-0">
                      <dt className="text-xs text-gray-500 lg:text-sm">{label}</dt>
                      <dd className="text-xl font-bold text-[#0b2346]">{Number(count).toLocaleString('en-IN')}</dd>
                    </div>
                  ))}
                </dl>
                <BarChart
                  tone="light"
                  ariaLabel="Monthly customer signups"
                  formatMax={(max) => `${max.toLocaleString('en-IN')}`}
                  data={customerStats.data.monthlyCustomers.map(({ month, label, count }) => ({
                    key: month,
                    label,
                    value: count,
                    title: `${label}: ${count} customers`,
                  }))}
                />
              </CardContent>
            </Card>
          ) : null}
        </section>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AdminLayout>
      <DashboardContent />
    </AdminLayout>
  );
}

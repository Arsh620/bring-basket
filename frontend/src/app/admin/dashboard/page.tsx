'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  AlertTriangle,
  BarChart3,
  Boxes,
  Building2,
  ChevronRight,
  LayoutDashboard,
  Package,
  RefreshCw,
  Tags,
  Warehouse,
} from 'lucide-react';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/api/client';

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

interface DashboardData {
  itemCount: number;
  categoryCount: number;
  brandCount: number;
  storeCount: number;
  warehouseCount: number;
  lowStockItems: DashboardItem[];
}

async function fetchDashboardData(): Promise<DashboardData> {
  const [items, categories, brands, stores, warehouses, lowStock] = await Promise.all([
    api.get<PaginatedResponse<DashboardItem[]>>('/admin/items', { params: { page: 1, limit: 1 } }),
    api.get<ApiResponse<unknown[]>>('/admin/categories'),
    api.get<ApiResponse<unknown[]>>('/admin/brands'),
    api.get<PaginatedResponse<unknown[]>>('/admin/stores', { params: { page: 1, limit: 1 } }),
    api.get<ApiResponse<unknown[]>>('/admin/warehouses'),
    api.get<ApiResponse<DashboardItem[]>>('/admin/items/low-stock', { params: { threshold: 10 } }),
  ]);

  return {
    itemCount: items.data.pagination.total,
    categoryCount: categories.data.data.length,
    brandCount: brands.data.data.length,
    storeCount: stores.data.pagination.total,
    warehouseCount: warehouses.data.data.length,
    lowStockItems: lowStock.data.data.slice(0, 6),
  };
}

const statCards = [
  { key: 'itemCount', label: 'Total items', icon: Package, href: '/admin/catalog/items' },
  { key: 'categoryCount', label: 'Categories', icon: Tags, href: '/admin/catalog/categories' },
  { key: 'brandCount', label: 'Brands', icon: Boxes, href: '/admin/catalog/brands' },
  { key: 'storeCount', label: 'Grocery stores', icon: Building2, href: '/admin/stores' },
  { key: 'warehouseCount', label: 'Warehouses', icon: Warehouse, href: '/admin/warehouse' },
] as const;

const quickLinks = [
  { label: 'Products', detail: 'Manage your catalog', href: '/admin/catalog/items', icon: Package },
  { label: 'Stores', detail: 'Manage store details', href: '/admin/stores', icon: Building2 },
  { label: 'Warehouse stock', detail: 'Review stock levels', href: '/admin/inventory/warehouse-stock', icon: Warehouse },
] as const;

function getCategoryName(category: DashboardItem['categoryId']) {
  if (!category) return '—';
  return typeof category === 'string' ? category : category.name || '—';
}

function DashboardContent() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchDashboardData,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0755b8]">
            <LayoutDashboard size={16} />
            OPERATIONS OVERVIEW
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#0b2346]">Your business at a glance</h2>
          <p className="mt-1 text-sm text-gray-500">
            Keep your catalog, stores, and inventory moving smoothly.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Refresh dashboard data"
          className="border-[#d7e1ef] bg-white text-[#12396b] hover:bg-[#f1f5fb]"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      <section className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a2b59] via-[#0b438d] to-[#0755b8] px-5 py-6 text-white shadow-lg shadow-[#082b5a]/10 sm:px-7 sm:py-7">
        <div aria-hidden="true" className="admin-orbit absolute -right-10 -top-24 -z-10 h-64 w-64 rounded-full border-[34px] border-white/[0.06]" />
        <div aria-hidden="true" className="admin-drift absolute -bottom-28 right-36 -z-10 h-48 w-48 rounded-full bg-[#ffe500]/[0.08] blur-2xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-100">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ffe500]" />
              Bring Basket admin
            </span>
            <h3 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">Everything fresh, all in one place.</h3>
            <p className="mt-1.5 max-w-lg text-sm leading-6 text-blue-100/80">
              Check your live business snapshot and jump straight into the work that keeps things running.
            </p>
          </div>
          <Link
            href="/admin/catalog/items"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#ffe500] px-4 text-sm font-bold text-[#08234b] shadow-sm transition hover:bg-[#fff04a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b438d]"
          >
            Open product catalog
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>

      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>Dashboard data could not be loaded. Check the API connection and try again.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      <section aria-label="Business summary" className="admin-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((stat) => (
          <Link key={stat.key} href={stat.href} aria-label={`View ${stat.label}`}>
            <Card className="h-full border-0 shadow-sm ring-1 ring-[#dce4ef] transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-[#9db7d9]">
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{stat.label}</CardTitle>
                <span className="rounded-xl bg-[#fff9c9] p-2 text-[#0b55ad]">
                  <stat.icon size={19} aria-hidden="true" />
                </span>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-8 w-20 animate-pulse rounded bg-gray-100" />
                ) : (
                  <p className="text-3xl font-bold tracking-tight text-[#0b2346]">
                    {data?.[stat.key].toLocaleString() ?? '—'}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-400">Current total</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section aria-label="Quick links" className="admin-stagger grid gap-3 sm:grid-cols-3">
        {quickLinks.map((quickLink) => (
          <Link
            key={quickLink.href}
            href={quickLink.href}
            className="group flex items-center gap-3 rounded-xl border border-[#dce4ef] bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#9db7d9] hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0f5fc] text-[#0b55ad] transition group-hover:bg-[#fff5a8]">
              <quickLink.icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#0b2346]">{quickLink.label}</span>
              <span className="mt-0.5 block truncate text-xs text-gray-500">{quickLink.detail}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-[#0b55ad]" />
          </Link>
        ))}
      </section>

      <section className="admin-stagger grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
        <Card className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-gray-100">
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">Low-stock items</CardTitle>
              <p className="mt-1 text-sm text-gray-500">Active items with 10 or fewer units.</p>
            </div>
            <Badge variant="secondary" className="gap-1 bg-amber-50 text-amber-700">
              <AlertTriangle size={13} />
              Needs attention
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-5" aria-label="Loading low-stock items">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="h-10 animate-pulse rounded bg-gray-100" />
                ))}
              </div>
            ) : data?.lowStockItems.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lowStockItems.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium text-gray-800">{item.name}</TableCell>
                      <TableCell className="text-gray-500">{getCategoryName(item.categoryId)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="border-amber-200 text-amber-700">
                          {item.stock ?? 0}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-5 py-10 text-center">
                <Package className="mx-auto mb-2 text-gray-300" size={28} aria-hidden="true" />
                <p className="text-sm font-medium text-gray-700">No low-stock items</p>
                <p className="mt-1 text-sm text-gray-500">Inventory is above the alert threshold.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <BarChart3 size={18} className="text-[#0755b8]" />
              Sales &amp; orders
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 rounded-full bg-gray-100 p-3">
              <BarChart3 size={22} className="text-gray-500" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-gray-800">Analytics are not connected yet</p>
            <p className="mt-1 max-w-xs text-sm leading-6 text-gray-500">
              Sales and order summaries will appear here when those endpoints are available in the API.
            </p>
          </CardContent>
        </Card>
      </section>
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

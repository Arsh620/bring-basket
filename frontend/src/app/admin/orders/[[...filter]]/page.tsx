'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ClipboardList, Search } from 'lucide-react';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/api/client';

const statuses = [
  ['all', 'All orders'],
  ['stock_pending', 'Stock pending'],
  ['pending', 'Pending'],
  ['confirmed', 'Confirmed'],
  ['processing', 'Processing'],
  ['handover', 'Handover'],
  ['picked_up', 'Picked up'],
  ['delivered', 'Delivered'],
  ['canceling', 'Canceling'],
  ['canceled', 'Canceled'],
  ['failed', 'Failed'],
] as const;

type OrderStatus = (typeof statuses)[number][0];

interface OrderLine {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface AdminOrder {
  _id: string;
  orderNumber: string;
  ownerId: string;
  storeName: string;
  orderType: string;
  orderStatus: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
  orderAmount: number;
  items: OrderLine[];
  deliveryAddress?: {
    contact_person_name: string;
    contact_person_number: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null;
  orderNote?: string;
  createdAt: string;
};

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

interface OrderList {
  total_size: number;
  limit: number;
  offset: number;
  orders: AdminOrder[];
}

const currency = (amount: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(amount) || 0);

function OrdersContent() {
  const params = useParams();
  const routeFilter = params.filter;
  const requestedStatus = Array.isArray(routeFilter) ? routeFilter[0] : routeFilter;
  const status = statuses.some(([value]) => value === requestedStatus)
    ? requestedStatus as OrderStatus
    : 'all';
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');

  useEffect(() => {
    setPage(1);
    setSelectedOrderId('');
  }, [status]);

  const ordersQuery = useQuery({
    queryKey: ['admin-orders', status, page, search],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<OrderList>>('/admin/orders', {
        params: { status, page, limit: 20, ...(search ? { search } : {}) },
      });
      return response.data.data;
    },
  });

  const detailQuery = useQuery({
    queryKey: ['admin-order', selectedOrderId],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<AdminOrder>>(`/admin/orders/${encodeURIComponent(selectedOrderId)}`);
      return response.data.data;
    },
    enabled: Boolean(selectedOrderId),
  });

  const orderList = ordersQuery.data;
  const pageCount = Math.max(1, Math.ceil((orderList?.total_size || 0) / 20));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0755b8]">
            <ClipboardList size={16} />
            ORDER MANAGEMENT
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0b2346]">
            {statuses.find(([value]) => value === status)?.[1] || 'Orders'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Review customer orders and their current fulfillment state.</p>
        </div>
        <form
          className="flex w-full max-w-sm gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
        >
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search order number or store"
            aria-label="Search order number or store"
            maxLength={100}
          />
          <Button type="submit" variant="outline" aria-label="Search orders">
            <Search size={16} />
            Search
          </Button>
        </form>
      </div>

      <nav aria-label="Order status filters" className="flex flex-wrap gap-2">
        {statuses.map(([value, label]) => (
          <Link
            key={value}
            href={value === 'all' ? '/admin/orders' : `/admin/orders/${value}`}
            aria-current={status === value ? 'page' : undefined}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              status === value
                ? 'border-[#0b438d] bg-[#0b438d] text-white'
                : 'border-[#dce4ef] bg-white text-[#34506f] hover:border-[#9db7d9] hover:text-[#0b438d]'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {ordersQuery.isError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load orders. Check your admin access and retry.
          <Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => void ordersQuery.refetch()}>
            Retry
          </Button>
        </div>
      )}

      <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-[#dce4ef]">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100">
          <CardTitle className="text-base font-semibold text-gray-900">Orders</CardTitle>
          <Badge variant="outline">{ordersQuery.isLoading ? 'Loading…' : `${orderList?.total_size ?? 0} total`}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {ordersQuery.isLoading ? (
            <div className="space-y-3 p-5" aria-label="Loading orders">
              {[0, 1, 2, 3].map((row) => <div key={row} className="h-10 animate-pulse rounded bg-gray-100" />)}
            </div>
          ) : orderList?.orders.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type / payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderList.orders.map((order) => (
                  <TableRow key={order._id}>
                    <TableCell>
                      <p className="font-semibold text-[#0b2346]">{order.orderNumber}</p>
                      <p className="mt-1 text-xs text-gray-500">{new Date(order.createdAt).toLocaleString('en-IN')}</p>
                    </TableCell>
                    <TableCell className="font-medium">{order.storeName}</TableCell>
                    <TableCell><Badge variant="secondary">{order.orderStatus.replaceAll('_', ' ')}</Badge></TableCell>
                    <TableCell className="capitalize text-gray-600">
                      {order.orderType.replaceAll('_', ' ')} · {order.paymentMethod.replaceAll('_', ' ')}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{currency(order.orderAmount)}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => setSelectedOrderId(order._id)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="px-5 py-12 text-center">
              <ClipboardList className="mx-auto mb-2 text-gray-300" size={30} aria-hidden="true" />
              <p className="text-sm font-semibold text-gray-700">No orders in this view</p>
              <p className="mt-1 text-sm text-gray-500">Orders will appear here as customers place them.</p>
            </div>
          )}
        </CardContent>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
          <span>Page {page} of {pageCount}</span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              <ArrowLeft size={15} />
              Previous
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>
              Next
              <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      </Card>

      {selectedOrderId && (
        <Card className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100">
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">
                {detailQuery.data?.orderNumber || 'Order details'}
              </CardTitle>
              <p className="mt-1 text-xs text-gray-500">Customer reference: {detailQuery.data?.ownerId || 'Loading…'}</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setSelectedOrderId('')}>Close</Button>
          </CardHeader>
          <CardContent className="grid gap-6 p-5 lg:grid-cols-2">
            {detailQuery.isLoading ? (
              <p className="text-sm text-gray-500">Loading order details…</p>
            ) : detailQuery.isError ? (
              <p role="alert" className="text-sm text-red-700">Could not load this order.</p>
            ) : detailQuery.data ? (
              <>
                <div>
                  <h2 className="text-sm font-semibold text-[#0b2346]">Items</h2>
                  <div className="mt-3 divide-y divide-gray-100">
                    {detailQuery.data.items.map((item) => (
                      <div key={item.itemId} className="flex justify-between gap-4 py-2 text-sm">
                        <span className="text-gray-700">{item.itemName} × {item.quantity}</span>
                        <span className="font-medium">{currency(item.lineTotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-[#0b2346]">Fulfillment</h2>
                    <p className="mt-2 text-sm text-gray-600">{detailQuery.data.storeName} · {detailQuery.data.orderType.replaceAll('_', ' ')}</p>
                    <p className="mt-1 text-sm capitalize text-gray-600">
                      {detailQuery.data.orderStatus.replaceAll('_', ' ')} · {detailQuery.data.paymentStatus}
                    </p>
                  </div>
                  {detailQuery.data.deliveryAddress && (
                    <div>
                      <h2 className="text-sm font-semibold text-[#0b2346]">Delivery address</h2>
                      <p className="mt-2 text-sm text-gray-600">{detailQuery.data.deliveryAddress.contact_person_name} · {detailQuery.data.deliveryAddress.contact_person_number}</p>
                      <p className="mt-1 text-sm text-gray-600">{detailQuery.data.deliveryAddress.address}</p>
                    </div>
                  )}
                  {detailQuery.data.orderNote && (
                    <div>
                      <h2 className="text-sm font-semibold text-[#0b2346]">Customer note</h2>
                      <p className="mt-2 text-sm text-gray-600">{detailQuery.data.orderNote}</p>
                    </div>
                  )}
                  <p className="border-t border-gray-100 pt-3 text-right text-base font-bold text-[#0b2346]">
                    Total {currency(detailQuery.data.orderAmount)}
                  </p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <AdminLayout>
      <OrdersContent />
    </AdminLayout>
  );
}

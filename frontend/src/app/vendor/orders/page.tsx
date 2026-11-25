'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import vendorApi from '@/lib/api/vendor';
import { useVendorStore } from '@/store/vendor.store';

interface Order {
  _id: string;
  orderNumber: string;
  orderStatus: string;
  orderAmount: number;
  paymentMethod: string;
  createdAt: string;
  canVendorConfirm?: boolean;
  canVendorCancel?: boolean;
  customer?: { fName?: string; phone?: string };
  items?: { itemName: string; quantity: number; lineTotal: number }[];
}

const currency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const date = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  handover: 'bg-orange-100 text-orange-700',
  picked_up: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  canceled: 'bg-red-100 text-red-600',
};

const NEXT_STATUS: Record<string, string> = {
  pending: 'confirmed',
  accepted: 'processing',
  confirmed: 'processing',
  processing: 'handover',
};

export default function VendorOrdersPage() {
  const vendorId = useVendorStore((state) => state.vendor?._id);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['vendor-orders', vendorId, page, filter],
    enabled: Boolean(vendorId),
    queryFn: async ({ signal }) => {
      const res = await vendorApi.get<{ data: Order[] | { orders: Order[] }; pagination?: { total: number } }>('/vendor/orders', {
        params: { page, limit: 15, status: filter || undefined },
        signal,
      });
      const payload = res.data.data;
      return { orders: Array.isArray(payload) ? payload : payload?.orders ?? [], total: res.data.pagination?.total ?? 0 };
    },
  });
  const { orders = [], total = 0 } = query.data ?? {};

  const updateStatus = async (orderId: string, status: string, reason?: string) => {
    setBusy(orderId);
    try {
      await vendorApi.put('/vendor/orders/update-status', { order_id: orderId, status, ...(reason ? { reason } : {}) });
      toast.success(`Order marked as ${status}`);
      await query.refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Status update failed');
    } finally { setBusy(null); }
  };

  return (
    <div className="p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
          <p className="text-sm text-slate-500">{total} total orders</p>
        </div>
        <div className="flex gap-2">
          <select aria-label="Order status" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}
            className="rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500">
            <option value="">All statuses</option>
            {['pending', 'accepted', 'confirmed', 'processing', 'handover', 'picked_up', 'delivered', 'canceled'].map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <button aria-label="Refresh orders" disabled={query.isFetching} onClick={() => void query.refetch()} className="rounded-xl border p-2 text-slate-500 hover:text-emerald-600">
            <RefreshCw size={16} className={query.isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {query.isPending ? (
          [...Array(5)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)
        ) : query.isError ? (
          <p role="alert" className="rounded-2xl border bg-white p-6 text-center">Could not load orders. Use Refresh orders to try again.</p>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border bg-white py-16 text-center">
            <p className="font-medium text-slate-600">No orders found</p>
          </div>
        ) : orders.map((order) => (
          <div key={order._id} className="rounded-2xl border bg-white shadow-sm">
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{order.orderNumber}</p>
                  <p className="text-sm text-slate-500">
                    {order.customer?.fName || 'Customer'} · {date(order.createdAt)}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_COLOR[order.orderStatus] || 'bg-slate-100 text-slate-600'}`}>
                  {order.orderStatus.replace('_', ' ')}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="font-bold text-slate-800">{currency(order.orderAmount)}</p>
                <div className="flex gap-2">
                  <button onClick={() => setExpanded(expanded === order._id ? null : order._id)}
                    className="flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-medium text-slate-600">
                    Details <ChevronDown size={12} className={expanded === order._id ? 'rotate-180' : ''} />
                  </button>
                  {NEXT_STATUS[order.orderStatus] && (order.orderStatus !== 'pending' || order.canVendorConfirm) && (
                    <button disabled={busy === order._id} onClick={() => updateStatus(order._id, NEXT_STATUS[order.orderStatus])}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 capitalize">
                      Mark {NEXT_STATUS[order.orderStatus]}
                    </button>
                  )}
                  {order.canVendorCancel && (
                    <button disabled={busy === order._id} onClick={() => {
                      const reason = window.prompt('Why is this order being canceled?');
                      if (reason === null) return;
                      if (!reason.trim()) { toast.error('Cancellation reason is required'); return; }
                      void updateStatus(order._id, 'canceled', reason.trim());
                    }} className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50">
                      Cancel order
                    </button>
                  )}
                </div>
              </div>
            </div>
            {expanded === order._id && order.items && (
              <div className="border-t px-4 py-3">
                <div className="space-y-1.5">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-700">{item.itemName} × {item.quantity}</span>
                      <span className="font-medium">{currency(item.lineTotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between border-t pt-2 text-sm font-semibold">
                  <span>Total</span><span>{currency(order.orderAmount)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400 capitalize">{order.paymentMethod?.replace('_', ' ')}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {total > 15 && (
        <div className="mt-4 flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Previous</button>
          <button disabled={page * 15 >= total} onClick={() => setPage((p) => p + 1)}
            className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

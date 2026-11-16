'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomerStore } from '@/store/customer.store';
import customerApi from '@/lib/api/customer';

interface OrderLine { itemName: string; quantity: number; lineTotal: number; }
interface Order {
  _id: string;
  orderNumber: string;
  orderStatus: string;
  orderAmount: number;
  storeName: string;
  orderType: string;
  paymentMethod: string;
  items: OrderLine[];
  createdAt: string;
}

const currency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const date = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  handover: 'bg-orange-100 text-orange-700',
  picked_up: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  canceled: 'bg-red-100 text-red-600',
  failed: 'bg-slate-100 text-slate-600',
};

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, hydrate, hasHydrated } = useCustomerStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated()) { router.push('/login'); return; }
    load();
  }, [hasHydrated, isAuthenticated, router, page]);

  const load = async () => {
    try {
      const res = await customerApi.get(`/customer/order/list?limit=10&offset=${page}`);
      setOrders(res.data.data.orders || []);
      setTotal(res.data.data.total_size || 0);
    } catch { toast.error('Could not load orders'); }
  };

  const cancelOrder = async (orderId: string) => {
    setBusy(true);
    try {
      await customerApi.put('/customer/order/cancel', { order_id: orderId, reason: 'Cancelled by customer' });
      toast.success('Order cancelled');
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Cancel failed');
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 border-b bg-white px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-800">My Orders ({total})</h1>
          <button onClick={load} className="rounded-xl border p-2 text-slate-500 hover:text-emerald-600">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        {orders.length === 0 ? (
          <div className="mt-16 text-center">
            <Package className="mx-auto mb-3 text-slate-300" size={40} />
            <p className="font-medium text-slate-600">No orders yet</p>
            <p className="mt-1 text-sm text-slate-400">Your orders will appear here</p>
            <a href="/home" className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">
              Start Shopping
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order._id} className="rounded-2xl border bg-white shadow-sm">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{order.orderNumber}</p>
                      <p className="text-sm text-slate-500">{order.storeName} · {date(order.createdAt)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_COLOR[order.orderStatus] || 'bg-slate-100 text-slate-600'}`}>
                      {order.orderStatus.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="font-bold text-slate-800">{currency(order.orderAmount)}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setExpanded(expanded === order._id ? null : order._id)}
                        className="rounded-xl border px-3 py-1.5 text-xs font-medium text-slate-600">
                        {expanded === order._id ? 'Hide' : 'Details'}
                      </button>
                      {order.orderStatus === 'pending' && (
                        <button disabled={busy} onClick={() => cancelOrder(order._id)}
                          className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-50">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {expanded === order._id && (
                  <div className="border-t px-4 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
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
                    <p className="mt-1 text-xs text-slate-400 capitalize">{order.orderType.replace('_', ' ')} · {order.paymentMethod.replace('_', ' ')}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {total > 10 && (
          <div className="mt-4 flex justify-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Previous</button>
            <button disabled={page * 10 >= total} onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </main>
  );
}

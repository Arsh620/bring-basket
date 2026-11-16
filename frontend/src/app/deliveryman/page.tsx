'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

type Order = {
  _id: string;
  orderNumber: string;
  orderStatus: string;
  orderAmount: number;
  storeName: string;
  orderType: string;
  deliveryAddress?: { address: string; contact_person_name: string; contact_person_number: string };
  items: { itemName: string; quantity: number; lineTotal: number }[];
  createdAt: string;
};

type Profile = { fName: string; lName: string; phone: string; active: boolean; orderCount: number };

async function dmFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('dm_token');
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Request failed');
  return data.data as T;
}

const currency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  handover: 'bg-orange-100 text-orange-800',
  picked_up: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  canceled: 'bg-red-100 text-red-800',
};

const NEXT_STATUS: Record<string, string> = {
  confirmed: 'processing',
  processing: 'handover',
  handover: 'picked_up',
  picked_up: 'delivered',
};

export default function DeliverymanPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentOrders, setCurrentOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<'current' | 'history'>('current');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [prof, curr, all] = await Promise.all([
        dmFetch<Profile>('/deliveryman/profile'),
        dmFetch<Order[]>('/deliveryman/current-orders'),
        dmFetch<{ data: Order[] }>('/deliveryman/all-orders?limit=20'),
      ]);
      setProfile(prof);
      setCurrentOrders(curr);
      setAllOrders((all as unknown as { data: Order[] }).data ?? (all as unknown as Order[]));
    } catch (err) {
      if (err instanceof Error && err.message.includes('401')) {
        router.push('/deliveryman/login');
      }
    }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('dm_token');
    if (!token) { router.push('/deliveryman/login'); return; }
    void load();
  }, [load, router]);

  const updateStatus = async (order: Order, status: string) => {
    setBusy(true);
    setMsg('');
    try {
      await dmFetch('/deliveryman/update-order-status', {
        method: 'PUT',
        body: JSON.stringify({ order_id: order._id, status }),
      });
      setMsg(`Order ${order.orderNumber} updated to ${status}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      await dmFetch('/deliveryman/update-active-status', { method: 'POST', body: JSON.stringify({ active: !profile.active }) });
      setProfile((p) => p ? { ...p, active: !p.active } : p);
    } finally {
      setBusy(false);
    }
  };

  const logout = () => { localStorage.removeItem('dm_token'); router.push('/deliveryman/login'); };

  const orders = tab === 'current' ? currentOrders : allOrders;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Bring Basket</p>
            <h1 className="text-xl font-bold text-slate-800">
              {profile ? `${profile.fName} ${profile.lName}` : 'Deliveryman Portal'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <button onClick={toggleActive} disabled={busy} className={`rounded-full px-3 py-1 text-xs font-semibold ${profile.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {profile.active ? 'Online' : 'Offline'}
              </button>
            )}
            <button onClick={logout} className="text-sm text-slate-500 underline">Logout</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-6 space-y-5">
        {profile && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-white p-4">
              <p className="text-xs text-slate-500">Total Deliveries</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{profile.orderCount}</p>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <p className="text-xs text-slate-500">Active Orders</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{currentOrders.length}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {(['current', 'history'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${tab === t ? 'bg-emerald-600 text-white' : 'bg-white border text-slate-600'}`}>
              {t === 'current' ? 'Current Orders' : 'All Orders'}
            </button>
          ))}
          <button onClick={() => void load()} className="ml-auto rounded-xl border bg-white px-4 py-2 text-sm text-slate-600">Refresh</button>
        </div>

        {msg && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</p>}

        {orders.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">No orders found.</div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order._id} className="rounded-2xl border bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-800">{order.orderNumber}</p>
                    <p className="text-sm text-slate-500">{order.storeName} · {currency(order.orderAmount)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[order.orderStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                    {order.orderStatus.replace('_', ' ')}
                  </span>
                </div>

                {order.deliveryAddress && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="font-medium text-slate-700">{order.deliveryAddress.contact_person_name} · {order.deliveryAddress.contact_person_number}</p>
                    <p className="text-slate-500">{order.deliveryAddress.address}</p>
                  </div>
                )}

                <ul className="mt-3 space-y-1">
                  {order.items.map((item, i) => (
                    <li key={i} className="flex justify-between text-sm text-slate-600">
                      <span>{item.itemName} × {item.quantity}</span>
                      <span>{currency(item.lineTotal)}</span>
                    </li>
                  ))}
                </ul>

                {NEXT_STATUS[order.orderStatus] && (
                  <button
                    disabled={busy}
                    onClick={() => void updateStatus(order, NEXT_STATUS[order.orderStatus])}
                    className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Mark as {NEXT_STATUS[order.orderStatus].replace('_', ' ')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

'use client';

import { useContext, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { WarehouseContext } from '@/components/portal/warehouse-context';
import warehouseApi from '@/lib/api/warehouse';

type PO = { _id: string; vendorId?: { name?: string }; status: string; totalAmount: number; createdAt: string };
type Bill = { _id: string; vendorId?: { name?: string }; status: string; billAmount: number; createdAt: string };
type Payment = { _id: string; vendorId?: { name?: string }; amount: number; mode: string; paymentDate: string };

export default function WarehousePurchasesPage() {
  const [tab, setTab] = useState<'orders' | 'bills' | 'payments'>('orders');
  const warehouseId = useContext(WarehouseContext)?._id;
  const ordersQuery = useQuery({
    queryKey: ['warehouse-purchases', warehouseId, 'orders'],
    enabled: Boolean(warehouseId) && tab === 'orders',
    queryFn: async () => (await warehouseApi.get<{ data: PO[] }>('/warehouse/purchases/orders')).data.data,
  });
  const billsQuery = useQuery({
    queryKey: ['warehouse-purchases', warehouseId, 'bills'],
    enabled: Boolean(warehouseId) && tab === 'bills',
    queryFn: async () => (await warehouseApi.get<{ data: Bill[] }>('/warehouse/purchases/bills')).data.data,
  });
  const paymentsQuery = useQuery({
    queryKey: ['warehouse-purchases', warehouseId, 'payments'],
    enabled: Boolean(warehouseId) && tab === 'payments',
    queryFn: async () => (await warehouseApi.get<{ data: Payment[] }>('/warehouse/purchases/payments')).data.data,
  });
  const currentQuery = { orders: ordersQuery, bills: billsQuery, payments: paymentsQuery }[tab];
  const orders = ordersQuery.data ?? [];
  const bills = billsQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShoppingCart size={22} />
        <h1 className="text-xl font-bold">Purchases</h1>
      </div>

      <div className="flex gap-2">
        {(['orders', 'bills', 'payments'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${tab === t ? 'bg-[#08234b] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        {currentQuery.isPending && <p role="status" className="px-4 py-8 text-center text-sm text-slate-600">Loading {tab}…</p>}
        {currentQuery.isError && <p role="alert" className="px-4 py-8 text-center text-sm text-red-700">
          Could not load {tab}. <button type="button" className="underline" onClick={() => void currentQuery.refetch()}>Try again</button>
        </p>}

        {currentQuery.isSuccess && tab === 'orders' && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-4 py-3 text-left">Vendor</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Date</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No purchase orders.</td></tr>}
              {orders.map((o) => (
                <tr key={o._id}>
                  <td className="px-4 py-3 font-medium">{o.vendorId?.name || '—'}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">{o.status}</span></td>
                  <td className="px-4 py-3 text-right">₹{o.totalAmount}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {currentQuery.isSuccess && tab === 'bills' && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-4 py-3 text-left">Vendor</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Date</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bills.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No bills.</td></tr>}
              {bills.map((b) => (
                <tr key={b._id}>
                  <td className="px-4 py-3 font-medium">{b.vendorId?.name || '—'}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{b.status}</span></td>
                  <td className="px-4 py-3 text-right">₹{b.billAmount}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(b.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {currentQuery.isSuccess && tab === 'payments' && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-4 py-3 text-left">Vendor</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Mode</th><th className="px-4 py-3 text-left">Date</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No payments.</td></tr>}
              {payments.map((p) => (
                <tr key={p._id}>
                  <td className="px-4 py-3 font-medium">{p.vendorId?.name || '—'}</td>
                  <td className="px-4 py-3 text-right">₹{p.amount}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{p.mode}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(p.paymentDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

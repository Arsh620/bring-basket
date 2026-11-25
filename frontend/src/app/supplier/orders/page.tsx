'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { LoaderCircle } from 'lucide-react';
import supplierApi from '@/lib/api/supplier';
import { formatSupplierDate, formatSupplierMoney } from '@/lib/supplier-format';
import { SupplierPortalShell } from '@/components/supplier/SupplierPortalShell';

type Order = {
  _id: string;
  poNumber: string;
  poDate: string;
  expectedDeliveryDate?: string;
  status: string;
  total: number;
};

export default function SupplierOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    supplierApi.get<{ data: Order[] }>('/supplier/orders', { params: { limit: 100 } })
      .then(({ data }) => { if (active) setOrders(data.data); })
      .catch((error: unknown) => {
        if (active) setErrorMessage(axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || 'Orders could not be loaded.' : 'Orders could not be loaded.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <SupplierPortalShell>
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <header className="border-b p-5"><h1 className="text-xl font-bold text-slate-900">Purchase orders</h1><p className="mt-1 text-sm text-slate-500">Orders issued to your supplier account.</p></header>
        {loading ? <div className="flex items-center justify-center p-12 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18} /> Loading orders…</div>
          : errorMessage ? <p role="alert" className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{errorMessage}</p>
            : orders.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No purchase orders available.</p>
              : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">PO number</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Expected delivery</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Total</th></tr></thead><tbody className="divide-y">
                {orders.map((order) => <tr key={order._id} className="hover:bg-slate-50"><td className="px-5 py-4"><Link href={`/supplier/orders/${order._id}`} className="font-semibold text-emerald-700 hover:underline">{order.poNumber}</Link></td><td className="px-5 py-4">{formatSupplierDate(order.poDate)}</td><td className="px-5 py-4">{formatSupplierDate(order.expectedDeliveryDate)}</td><td className="px-5 py-4 capitalize">{order.status.replaceAll('_', ' ')}</td><td className="px-5 py-4 text-right font-medium">{formatSupplierMoney(order.total)}</td></tr>)}
              </tbody></table></div>}
      </section>
    </SupplierPortalShell>
  );
}

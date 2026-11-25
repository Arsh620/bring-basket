'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { LoaderCircle } from 'lucide-react';
import supplierApi from '@/lib/api/supplier';
import { formatSupplierDate, formatSupplierMoney } from '@/lib/supplier-format';
import { SupplierPortalShell } from '@/components/supplier/SupplierPortalShell';

type DashboardData = {
  openPoCount: number;
  openBillsBalance: number;
  lastPayment: { amount: number; paymentDate: string; mode: string } | null;
  pendingOrders: Array<{ _id: string; poNumber: string; poDate: string; total: number; status: string }>;
  recentBills: Array<{ _id: string; billNumber: number; billDate: string; total: number; balanceDue: number; status: string }>;
};

export default function SupplierDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supplierApi.get<{ data: DashboardData }>('/supplier/dashboard')
      .then((response) => { if (active) setData(response.data.data); })
      .catch((error: unknown) => {
        if (active) setErrorMessage(
          axios.isAxiosError<{ message?: string }>(error)
            ? error.response?.data?.message || 'Dashboard could not be loaded.'
            : 'Dashboard could not be loaded.',
        );
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <SupplierPortalShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Supplier dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Orders, outstanding invoices, and recent payments.</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border bg-white p-12 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18} /> Loading dashboard…</div>
        ) : errorMessage ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errorMessage}</p>
        ) : data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Open purchase orders</p><p className="mt-2 text-3xl font-bold text-slate-900">{data.openPoCount}</p></article>
              <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Outstanding bills</p><p className="mt-2 text-2xl font-bold text-slate-900">{formatSupplierMoney(data.openBillsBalance)}</p></article>
              <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Last payment</p><p className="mt-2 text-2xl font-bold text-slate-900">{data.lastPayment ? formatSupplierMoney(data.lastPayment.amount) : '—'}</p><p className="mt-1 text-xs text-slate-500">{data.lastPayment ? `${formatSupplierDate(data.lastPayment.paymentDate)} · ${data.lastPayment.mode}` : 'No payments recorded'}</p></article>
            </div>
            <section className="rounded-2xl border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b p-5"><h2 className="font-semibold text-slate-900">Recent purchase orders</h2><Link href="/supplier/orders" className="text-sm font-semibold text-emerald-700 hover:underline">View all</Link></div>
              {data.pendingOrders.length ? (
                <div className="divide-y">
                  {data.pendingOrders.map((order) => <Link key={order._id} href={`/supplier/orders/${order._id}`} className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-slate-50"><span><span className="block font-medium text-slate-900">{order.poNumber}</span><span className="text-xs text-slate-500">{formatSupplierDate(order.poDate)} · {order.status}</span></span><span className="font-semibold text-slate-800">{formatSupplierMoney(order.total)}</span></Link>)}
                </div>
              ) : <p className="p-5 text-sm text-slate-500">No open purchase orders.</p>}
            </section>
            <section className="rounded-2xl border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b p-5"><h2 className="font-semibold text-slate-900">Recent invoices</h2><Link href="/supplier/invoices" className="text-sm font-semibold text-emerald-700 hover:underline">View all</Link></div>
              {data.recentBills.length ? (
                <div className="divide-y">
                  {data.recentBills.map((bill) => <Link key={bill._id} href={`/supplier/invoices/${bill._id}`} className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-slate-50"><span><span className="block font-medium text-slate-900">Invoice #{bill.billNumber}</span><span className="text-xs text-slate-500">{formatSupplierDate(bill.billDate)} · {bill.status}</span></span><span className="text-right"><span className="block font-semibold text-slate-800">{formatSupplierMoney(bill.total)}</span><span className="text-xs text-slate-500">Due {formatSupplierMoney(bill.balanceDue)}</span></span></Link>)}
                </div>
              ) : <p className="p-5 text-sm text-slate-500">No invoices yet.</p>}
            </section>
          </>
        ) : null}
      </div>
    </SupplierPortalShell>
  );
}

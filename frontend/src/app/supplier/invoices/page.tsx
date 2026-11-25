'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { LoaderCircle } from 'lucide-react';
import supplierApi from '@/lib/api/supplier';
import { formatSupplierDate, formatSupplierMoney } from '@/lib/supplier-format';
import { SupplierPortalShell } from '@/components/supplier/SupplierPortalShell';

type Invoice = {
  _id: string;
  billNumber: number;
  billDate: string;
  dueDate?: string;
  poNumber?: string;
  status: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
};

export default function SupplierInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    supplierApi.get<{ data: Invoice[] }>('/supplier/invoices', { params: { limit: 100 } })
      .then(({ data }) => { if (active) setInvoices(data.data); })
      .catch((error: unknown) => { if (active) setErrorMessage(axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || 'Invoices could not be loaded.' : 'Invoices could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <SupplierPortalShell>
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <header className="border-b p-5"><h1 className="text-xl font-bold text-slate-900">Invoices</h1><p className="mt-1 text-sm text-slate-500">Purchase bills and their payment balances.</p></header>
        {loading ? <div className="flex items-center justify-center p-12 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18} /> Loading invoices…</div>
          : errorMessage ? <p role="alert" className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{errorMessage}</p>
            : invoices.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No invoices available.</p>
              : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Bill date</th><th className="px-5 py-3">Due date</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3 text-right">Balance</th></tr></thead><tbody className="divide-y">
                {invoices.map((invoice) => <tr key={invoice._id} className="hover:bg-slate-50"><td className="px-5 py-4"><Link href={`/supplier/invoices/${invoice._id}`} className="font-semibold text-emerald-700 hover:underline">#{invoice.billNumber}</Link>{invoice.poNumber && <span className="mt-1 block text-xs text-slate-500">PO {invoice.poNumber}</span>}</td><td className="px-5 py-4">{formatSupplierDate(invoice.billDate)}</td><td className="px-5 py-4">{formatSupplierDate(invoice.dueDate)}</td><td className="px-5 py-4 capitalize">{invoice.status.replaceAll('_', ' ')}</td><td className="px-5 py-4 text-right">{formatSupplierMoney(invoice.total)}</td><td className="px-5 py-4 text-right font-medium">{formatSupplierMoney(invoice.balanceDue)}</td></tr>)}
              </tbody></table></div>}
      </section>
    </SupplierPortalShell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { LoaderCircle } from 'lucide-react';
import supplierApi from '@/lib/api/supplier';
import { formatSupplierDate, formatSupplierMoney } from '@/lib/supplier-format';
import { SupplierPortalShell } from '@/components/supplier/SupplierPortalShell';

type Payment = {
  _id: string;
  paymentDate: string;
  amount: number;
  mode: string;
  reference?: string;
  notes?: string;
  purchaseBillId?: string;
};

export default function SupplierPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    supplierApi.get<{ data: Payment[] }>('/supplier/payments', { params: { limit: 100 } })
      .then(({ data }) => { if (active) setPayments(data.data); })
      .catch((error: unknown) => { if (active) setErrorMessage(axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || 'Payments could not be loaded.' : 'Payments could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <SupplierPortalShell>
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <header className="border-b p-5"><h1 className="text-xl font-bold text-slate-900">Payments</h1><p className="mt-1 text-sm text-slate-500">Payments recorded against your supplier account.</p></header>
        {loading ? <div className="flex items-center justify-center p-12 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18} /> Loading payments…</div>
          : errorMessage ? <p role="alert" className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{errorMessage}</p>
            : payments.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No payments available.</p>
              : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Payment date</th><th className="px-5 py-3">Method</th><th className="px-5 py-3">Reference</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3 text-right">Invoice</th></tr></thead><tbody className="divide-y">
                {payments.map((payment) => <tr key={payment._id}><td className="px-5 py-4">{formatSupplierDate(payment.paymentDate)}</td><td className="px-5 py-4 capitalize">{payment.mode.replaceAll('_', ' ')}</td><td className="px-5 py-4">{payment.reference || '—'}</td><td className="px-5 py-4 text-right font-semibold">{formatSupplierMoney(payment.amount)}</td><td className="px-5 py-4 text-right">{payment.purchaseBillId ? <Link href={`/supplier/invoices/${payment.purchaseBillId}`} className="font-medium text-emerald-700 hover:underline">View invoice</Link> : '—'}</td></tr>)}
              </tbody></table></div>}
      </section>
    </SupplierPortalShell>
  );
}

'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { LoaderCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';
import supplierApi from '@/lib/api/supplier';
import { formatSupplierDate, formatSupplierMoney } from '@/lib/supplier-format';
import { SupplierPortalShell } from '@/components/supplier/SupplierPortalShell';

type InvoiceDetails = {
  billNumber: number;
  billDate: string;
  dueDate?: string;
  poNumber?: string;
  status: string;
  subTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  vendorInvoiceOriginalName?: string;
  vendorInvoiceUploadedAt?: string;
  grnInvoiceOriginalName?: string;
  notes?: string;
  items: Array<{ _id: string; itemName: string; qty: number; unit: string; rate: number; amount: number }>;
};

export default function SupplierInvoiceDetailsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading invoice…</div>}>
      <SupplierInvoiceDetailsContent />
    </Suspense>
  );
}

function SupplierInvoiceDetailsContent() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');

  const uploadInvoice = async (file?: File) => {
    if (!file || !invoice) return;
    setAttachmentError('');
    setUploading(true);
    const formData = new FormData();
    formData.append('invoice', file);
    try {
      const { data } = await supplierApi.post<{ data: { originalName: string; uploadedAt: string } }>(
        `/supplier/invoices/${encodeURIComponent(params.id)}/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setInvoice((current) => current ? {
        ...current,
        vendorInvoiceOriginalName: data.data.originalName,
        vendorInvoiceUploadedAt: data.data.uploadedAt,
      } : current);
      toast.success('Invoice uploaded');
    } catch (error: unknown) {
      setAttachmentError(axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || 'Invoice upload failed.' : 'Invoice upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const downloadInvoice = async () => {
    try {
      const response = await supplierApi.get<Blob>(
        `/supplier/invoices/${encodeURIComponent(params.id)}/attachment`,
        { responseType: 'blob' },
      );
      const objectUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = invoice?.vendorInvoiceOriginalName || 'supplier-invoice';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      toast.error('Invoice attachment could not be downloaded.');
    }
  };

  useEffect(() => {
    let active = true;
    supplierApi.get<{ data: InvoiceDetails }>(`/supplier/invoices/${encodeURIComponent(params.id)}`)
      .then(({ data }) => { if (active) setInvoice(data.data); })
      .catch((error: unknown) => { if (active) setErrorMessage(axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || 'Invoice could not be loaded.' : 'Invoice could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.id]);

  return (
    <SupplierPortalShell>
      <div className="space-y-5">
        <Link href="/supplier/invoices" className="text-sm font-semibold text-emerald-700 hover:underline">← All invoices</Link>
        {loading ? <div className="flex items-center justify-center rounded-2xl border bg-white p-12 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18} /> Loading invoice…</div>
          : errorMessage ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{errorMessage}</p>
            : invoice ? <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <header className="flex flex-wrap items-start justify-between gap-4 border-b p-5"><div><h1 className="text-xl font-bold text-slate-900">Invoice #{invoice.billNumber}</h1><p className="mt-1 text-sm text-slate-500">Bill date {formatSupplierDate(invoice.billDate)} · Due {formatSupplierDate(invoice.dueDate)}</p>{invoice.poNumber && <p className="mt-1 text-sm text-slate-500">Purchase order {invoice.poNumber}</p>}</div><span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium capitalize text-emerald-800">{invoice.status.replaceAll('_', ' ')}</span></header>
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Item</th><th className="px-5 py-3 text-right">Quantity</th><th className="px-5 py-3 text-right">Rate</th><th className="px-5 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y">{invoice.items.map((item) => <tr key={item._id}><td className="px-5 py-4 font-medium">{item.itemName}</td><td className="px-5 py-4 text-right">{item.qty} {item.unit}</td><td className="px-5 py-4 text-right">{formatSupplierMoney(item.rate)}</td><td className="px-5 py-4 text-right">{formatSupplierMoney(item.amount)}</td></tr>)}</tbody></table></div>
              <dl className="ml-auto grid max-w-sm grid-cols-2 gap-x-8 gap-y-2 border-t p-5 text-sm"><dt className="text-slate-500">Subtotal</dt><dd className="text-right">{formatSupplierMoney(invoice.subTotal)}</dd><dt className="text-slate-500">Tax</dt><dd className="text-right">{formatSupplierMoney(invoice.taxTotal)}</dd><dt className="font-semibold">Total</dt><dd className="text-right font-semibold">{formatSupplierMoney(invoice.total)}</dd><dt className="text-slate-500">Paid</dt><dd className="text-right">{formatSupplierMoney(invoice.amountPaid)}</dd><dt className="font-semibold">Balance due</dt><dd className="text-right font-semibold">{formatSupplierMoney(invoice.balanceDue)}</dd></dl>
              {(invoice.vendorInvoiceOriginalName || invoice.grnInvoiceOriginalName) && <div className="border-t p-5"><h2 className="font-semibold text-slate-900">Attachments</h2><ul className="mt-2 space-y-1 text-sm text-slate-600">{invoice.vendorInvoiceOriginalName && <li>Supplier invoice: {invoice.vendorInvoiceOriginalName}</li>}{invoice.grnInvoiceOriginalName && <li>Goods received note: {invoice.grnInvoiceOriginalName}</li>}</ul></div>}
              <div className="border-t p-5">
                <h2 className="font-semibold text-slate-900">Supplier invoice attachment</h2>
                <p className="mt-1 text-sm text-slate-500">Upload a PDF or image invoice (maximum 10 MB). Only your supplier account can access it.</p>
                {invoice.vendorInvoiceOriginalName && <button type="button" onClick={() => void downloadInvoice()} className="mt-3 text-sm font-semibold text-emerald-700 hover:underline">Download {invoice.vendorInvoiceOriginalName}</button>}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <span className="inline-flex items-center gap-2"><Upload size={15} />{invoice.vendorInvoiceOriginalName ? 'Replace invoice' : 'Choose invoice'}</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={uploading} onChange={(event) => { void uploadInvoice(event.target.files?.[0]); event.currentTarget.value = ''; }} className="sr-only" />
                  </label>
                  {uploading && <span className="inline-flex items-center gap-2 text-sm text-slate-500"><LoaderCircle size={15} className="animate-spin" /> Uploading…</span>}
                </div>
                {attachmentError && <p role="alert" className="mt-3 text-sm text-red-700">{attachmentError}</p>}
              </div>
              {invoice.notes && <p className="border-t px-5 py-4 text-sm text-slate-600">Notes: {invoice.notes}</p>}
            </section> : null}
      </div>
    </SupplierPortalShell>
  );
}

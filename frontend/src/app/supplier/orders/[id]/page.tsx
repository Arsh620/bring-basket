'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { Download, LoaderCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';
import supplierApi from '@/lib/api/supplier';
import { formatSupplierDate, formatSupplierMoney } from '@/lib/supplier-format';
import { SupplierPortalShell } from '@/components/supplier/SupplierPortalShell';

type OrderLine = {
  _id: string;
  itemName: string;
  qty: number;
  qtyBilled: number;
  unit: string;
  rate: number;
  amount: number;
};

type OrderDetails = {
  poNumber: string;
  poDate: string;
  expectedDeliveryDate?: string;
  status: string;
  reference?: string;
  notes?: string;
  total: number;
  items: OrderLine[];
};

const initialQuantities = (order: OrderDetails) => Object.fromEntries(
  order.items.map((item) => [item._id, '0']),
);

const errorMessage = (error: unknown, fallback: string) => (
  axios.isAxiosError<{ message?: string }>(error)
    ? error.response?.data?.message || fallback
    : fallback
);

export default function SupplierOrderDetailsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading purchase order…</div>}>
      <SupplierOrderDetailsContent />
    </Suspense>
  );
}

function SupplierOrderDetailsContent() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadOrder = async () => {
    const { data } = await supplierApi.get<{ data: OrderDetails }>(
      `/supplier/orders/${encodeURIComponent(params.id)}`,
    );
    setOrder(data.data);
    setQuantities(initialQuantities(data.data));
  };

  useEffect(() => {
    let active = true;
    supplierApi.get<{ data: OrderDetails }>(`/supplier/orders/${encodeURIComponent(params.id)}`)
      .then(({ data }) => {
        if (!active) return;
        setOrder(data.data);
        setQuantities(initialQuantities(data.data));
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause, 'Order could not be loaded.'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.id]);

  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await supplierApi.get<Blob>(url, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (cause: unknown) {
      setActionError(errorMessage(cause, 'The requested file could not be downloaded.'));
    }
  };

  const uploadProcessingFile = async (file?: File) => {
    if (!file) return;
    setActionError('');
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await supplierApi.post<{ data: { quantities: Record<string, number> } }>(
        `/supplier/orders/${encodeURIComponent(params.id)}/process-upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setQuantities(Object.fromEntries(
        Object.entries(data.data.quantities).map(([itemId, quantity]) => [itemId, String(quantity)]),
      ));
      toast.success('Quantities loaded. Review them before processing.');
    } catch (cause: unknown) {
      setActionError(errorMessage(cause, 'The processing file could not be loaded.'));
    } finally {
      setUploading(false);
    }
  };

  const processOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError('');
    setProcessing(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(quantities).map(([itemId, quantity]) => [itemId, quantity === '' ? 0 : Number(quantity)]),
      );
      const { data } = await supplierApi.post<{ data: { billNumber: number } }>(
        `/supplier/orders/${encodeURIComponent(params.id)}/process`,
        { quantities: payload },
      );
      toast.success(`Purchase order processed. Bill #${data.data.billNumber} created.`);
      try {
        await loadOrder();
      } catch {
        setActionError('Processing succeeded, but the order could not be refreshed. Reload the page to see the latest quantities.');
      }
    } catch (cause: unknown) {
      setActionError(errorMessage(cause, 'The purchase order could not be processed.'));
    } finally {
      setProcessing(false);
    }
  };

  const canProcess = order && ['open', 'partially_billed'].includes(order.status);
  const filenameBase = order?.poNumber.replace(/[^\w.-]/g, '-') || 'purchase-order';

  return (
    <SupplierPortalShell>
      <div className="space-y-5">
        <Link href="/supplier/orders" className="text-sm font-semibold text-emerald-700 hover:underline">← All purchase orders</Link>
        {loading ? <div className="flex items-center justify-center rounded-2xl border bg-white p-12 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18} /> Loading order…</div>
          : error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>
            : order ? <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <header className="flex flex-wrap items-start justify-between gap-4 border-b p-5">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Purchase order {order.poNumber}</h1>
                  <p className="mt-1 text-sm text-slate-500">Issued {formatSupplierDate(order.poDate)} · Expected {formatSupplierDate(order.expectedDeliveryDate)}</p>
                  {order.reference && <p className="mt-1 text-sm text-slate-500">Reference: {order.reference}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium capitalize text-emerald-800">{order.status.replaceAll('_', ' ')}</span>
                  <button type="button" onClick={() => void downloadFile(`/supplier/orders/${encodeURIComponent(params.id)}/challan`, `challan-${filenameBase}.pdf`)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                    <Download size={15} /> Delivery challan
                  </button>
                </div>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Item</th>
                      <th className="px-5 py-3 text-right">Ordered</th>
                      <th className="px-5 py-3 text-right">Billed</th>
                      <th className="px-5 py-3 text-right">Remaining</th>
                      <th className="px-5 py-3 text-right">Rate</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      {canProcess && <th className="px-5 py-3 text-right">Process now</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {order.items.map((item) => {
                      const remaining = Math.max(0, item.qty - item.qtyBilled);
                      return (
                        <tr key={item._id}>
                          <td className="px-5 py-4 font-medium">{item.itemName}</td>
                          <td className="px-5 py-4 text-right">{item.qty} {item.unit}</td>
                          <td className="px-5 py-4 text-right">{item.qtyBilled} {item.unit}</td>
                          <td className="px-5 py-4 text-right">{remaining} {item.unit}</td>
                          <td className="px-5 py-4 text-right">{formatSupplierMoney(item.rate)}</td>
                          <td className="px-5 py-4 text-right">{formatSupplierMoney(item.amount)}</td>
                          {canProcess && <td className="px-5 py-3 text-right">
                            <input
                              aria-label={`Processing quantity for ${item.itemName}`}
                              type="number"
                              min="0"
                              max={remaining}
                              step="any"
                              value={quantities[item._id] ?? '0'}
                              onChange={(event) => setQuantities((current) => ({ ...current, [item._id]: event.target.value }))}
                              className="w-28 rounded-lg border px-3 py-2 text-right"
                            />
                          </td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end border-t p-5 text-lg font-bold text-slate-900">Total: {formatSupplierMoney(order.total)}</div>
              {order.notes && <p className="border-t px-5 py-4 text-sm text-slate-600">Notes: {order.notes}</p>}
              {canProcess && <form onSubmit={processOrder} className="space-y-4 border-t bg-slate-50 p-5">
                <div>
                  <h2 className="font-semibold text-slate-900">Report processed quantities</h2>
                  <p className="mt-1 text-sm text-slate-600">Processing creates a supplier bill for the selected quantities. Stock is received separately by the warehouse.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void downloadFile(`/supplier/orders/${encodeURIComponent(params.id)}/process-template?format=csv`, `${filenameBase}-process-template.csv`)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                    <Download size={15} /> CSV template
                  </button>
                  <button type="button" onClick={() => void downloadFile(`/supplier/orders/${encodeURIComponent(params.id)}/process-template?format=xlsx`, `${filenameBase}-process-template.xlsx`)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                    <Download size={15} /> XLSX template
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                    <Upload size={15} /> {uploading ? 'Loading file…' : 'Load CSV/XLS file'}
                    <input
                      type="file"
                      accept=".csv,.txt,.xls,.xlsx"
                      disabled={uploading}
                      onChange={(event) => { void uploadProcessingFile(event.target.files?.[0]); event.currentTarget.value = ''; }}
                      className="sr-only"
                    />
                  </label>
                  {uploading && <LoaderCircle size={18} className="animate-spin self-center text-slate-500" aria-label="Loading file" />}
                </div>
                {actionError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{actionError}</p>}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500" aria-live="polite">Review all quantities before submitting. Maximum upload size: 5 MB.</p>
                  <button type="submit" disabled={processing || uploading} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
                    {processing && <LoaderCircle size={16} className="animate-spin" />}
                    {processing ? 'Processing…' : 'Submit processing'}
                  </button>
                </div>
              </form>}
              {!canProcess && actionError && <p role="alert" className="border-t bg-red-50 px-5 py-4 text-sm text-red-800">{actionError}</p>}
            </section> : null}
      </div>
    </SupplierPortalShell>
  );
}

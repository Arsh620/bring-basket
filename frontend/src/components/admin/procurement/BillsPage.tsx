'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { ArrowLeft, LoaderCircle, PackageCheck, Search, X } from 'lucide-react';
import Link from 'next/link';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api/client';
import { PaymentDialog } from './PaymentDialog';

type Choice = { _id: string; name?: string; code?: string };

type Bill = {
  _id: string;
  billNumber: number;
  poNumber?: string;
  status: string;
  stockReceived: boolean;
  purchaseVendorId: { _id?: string; displayName?: string; legalName?: string; email?: string; mobile?: string } | null;
  purchaseOrderId: { poNumber?: string; status?: string } | null;
  warehouseId: Choice | null;
  storeId?: { name?: string } | null;
  billDate: string;
  dueDate?: string;
  terms?: string;
  notes?: string;
  taxType?: string;
  subTotal?: number;
  taxTotal?: number;
  total: number;
  amountPaid?: number;
  balanceDue: number;
  grnInvoicePath?: string;
  grnInvoiceOriginalName?: string;
  grnInvoiceUploadedAt?: string;
  items?: BillItem[];
};

type BillItem = {
  _id: string;
  itemName: string;
  qty: number;
  billedQty?: number;
  rate?: number;
  amount?: number;
  freeQty?: number;
  qtyReceived?: number;
  unit?: string;
  batchCode?: string;
  expiryDate?: string;
};

type BillDetails = Bill & { items: BillItem[] };
type ReceiptLine = { qtyReceived: string; batchCode: string; expiryDate: string };
type BillUpdate = {
  billDate: string;
  dueDate: string;
  terms: string;
  poNumber: string;
  notes: string;
};
type BillPayment = {
  _id: string;
  paymentDate: string;
  amount: number;
  mode: string;
  reference?: string;
};

function msg(error: unknown) {
  if (error instanceof AxiosError) return error.response?.data?.message || error.message;
  return error instanceof Error ? error.message : 'Request failed';
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    open: 'bg-blue-50 text-blue-700',
    partially_paid: 'bg-amber-50 text-amber-700',
    paid: 'bg-emerald-50 text-emerald-700',
    void: 'bg-red-50 text-red-700',
  };
  return <Badge className={`capitalize hover:bg-inherit ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>{status.replace('_', ' ')}</Badge>;
}

function ReceiveStockDialog({
  bill,
  saving,
  onClose,
  onSubmit,
}: {
  bill: BillDetails;
  saving: boolean;
  onClose: () => void;
  onSubmit: (
    warehouseId: string,
    invoice: File,
    items: { billItemId: string; qtyReceived: number; batchCode?: string; expiryDate?: string }[],
  ) => Promise<void>;
}) {
  const [warehouseId, setWarehouseId] = useState(bill.warehouseId?._id ?? '');
  const [invoice, setInvoice] = useState<File | null>(null);
  const [lines, setLines] = useState<Record<string, ReceiptLine>>(() => Object.fromEntries(
    bill.items.map(item => [item._id, {
      qtyReceived: String(Number(item.qty || 0) + Number(item.freeQty || 0)),
      batchCode: item.batchCode ?? '',
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : '',
    }]),
  ));
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const receiptItems = bill.items.map(item => ({
      billItemId: item._id,
      qtyReceived: Number(lines[item._id]?.qtyReceived),
      ...(lines[item._id]?.batchCode ? { batchCode: lines[item._id].batchCode } : {}),
      ...(lines[item._id]?.expiryDate ? { expiryDate: lines[item._id].expiryDate } : {}),
    }));
    if (!receiptItems.some(item => item.qtyReceived > 0)) {
      setError('Enter a received quantity greater than zero for at least one item.');
      return;
    }
    if (!warehouseId) {
      setError('Choose an active mother warehouse.');
      return;
    }
    if (!invoice) {
      setError('Upload the GRN invoice before confirming receipt.');
      return;
    }
    if (receiptItems.some(item => !Number.isFinite(item.qtyReceived) || item.qtyReceived < 0)) {
      setError('Received quantities must be zero or greater.');
      return;
    }
    setError('');
    try {
      await onSubmit(warehouseId, invoice, receiptItems);
    } catch (submitError) {
      setError(msg(submitError));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="receive-stock-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0b55ad]">Goods receipt</p>
            <h2 id="receive-stock-title" className="mt-1 text-xl font-bold text-[#0b2346]">
              Receive Bill #{String(bill.billNumber).padStart(5, '0')}
            </h2>
            <p className="mt-1 text-sm text-gray-500">Enter actual received quantities. Short receipts are supported.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label="Close goods receipt">
            <X size={18} />
          </Button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-5 py-5 sm:px-6">
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="grn-warehouse">Receiving warehouse</Label>
              <WarehouseSelect value={warehouseId} onChange={setWarehouseId} />
            </div>
            <div>
              <Label htmlFor="grn-invoice">GRN invoice</Label>
              <Input
                id="grn-invoice"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                required
                onChange={event => setInvoice(event.target.files?.[0] ?? null)}
                className="mt-1 h-10 rounded-lg file:mr-2 file:border-0 file:bg-transparent file:text-xs file:font-semibold"
              />
              <p className="mt-1 text-xs text-gray-500">PDF, JPEG, PNG or WebP; maximum 10 MB.</p>
            </div>
          </div>
          <div className="space-y-3">
            {bill.items.map(item => {
              const maxQty = Number(item.qty || 0) + Number(item.freeQty || 0);
              const line = lines[item._id];
              return (
                <div key={item._id} className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-[minmax(0,1fr)_130px_1fr_1fr] sm:items-end">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#0b2346]">{item.itemName}</p>
                    <p className="mt-1 text-xs text-gray-500">Billed: {maxQty} {item.unit || 'units'}</p>
                  </div>
                  <div>
                    <Label htmlFor={`received-${item._id}`}>Received qty</Label>
                    <Input
                      id={`received-${item._id}`}
                      type="number"
                      min="0"
                      max={maxQty}
                      step="any"
                      required
                      value={line?.qtyReceived ?? ''}
                      onChange={event => setLines(current => ({
                        ...current,
                        [item._id]: { ...current[item._id], qtyReceived: event.target.value },
                      }))}
                      className="mt-1 h-10 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`batch-${item._id}`}>Batch code</Label>
                    <Input
                      id={`batch-${item._id}`}
                      maxLength={64}
                      value={line?.batchCode ?? ''}
                      onChange={event => setLines(current => ({
                        ...current,
                        [item._id]: { ...current[item._id], batchCode: event.target.value },
                      }))}
                      className="mt-1 h-10 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`expiry-${item._id}`}>Expiry date</Label>
                    <Input
                      id={`expiry-${item._id}`}
                      type="date"
                      value={line?.expiryDate ?? ''}
                      onChange={event => setLines(current => ({
                        ...current,
                        [item._id]: { ...current[item._id], expiryDate: event.target.value },
                      }))}
                      className="mt-1 h-10 rounded-lg"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-[#0b438d] text-white hover:bg-[#082f68]">
              {saving ? <LoaderCircle size={15} className="animate-spin" /> : <PackageCheck size={15} />}
              Confirm receipt
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WarehouseSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const warehouses = useQuery({
    queryKey: ['active-mother-warehouses'],
    queryFn: async () => {
      const { data } = await api.get('/admin/warehouses', {
        params: { type: 'mother', status: 'active', limit: 100 },
      });
      return (data.data ?? []) as Choice[];
    },
  });

  return (
    <>
      <select
        id="grn-warehouse"
        required
        value={value}
        onChange={event => onChange(event.target.value)}
        disabled={warehouses.isLoading || warehouses.isError}
        className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-[#0b55ad] focus:outline-none"
      >
        <option value="">{warehouses.isLoading ? 'Loading warehouses…' : 'Select warehouse'}</option>
        {(warehouses.data ?? []).map(warehouse => (
          <option key={warehouse._id} value={warehouse._id}>
            {warehouse.name}{warehouse.code ? ` · ${warehouse.code}` : ''}
          </option>
        ))}
      </select>
      {warehouses.isError && <p role="alert" className="mt-1 text-xs text-red-700">{msg(warehouses.error)}</p>}
      {!warehouses.isLoading && !warehouses.isError && !warehouses.data?.length && (
        <p className="mt-1 text-xs text-amber-700">No active mother warehouses are available.</p>
      )}
    </>
  );
}

function BillDetailsDialog({
  bill,
  saving,
  onClose,
  onReceive,
  onUpdate,
  onVoid,
  onDownloadInvoice,
}: {
  bill: BillDetails;
  saving: boolean;
  onClose: () => void;
  onReceive: () => void;
  onUpdate: (update: BillUpdate) => Promise<void>;
  onVoid: () => Promise<void>;
  onDownloadInvoice: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [form, setForm] = useState<BillUpdate>(() => ({
    billDate: bill.billDate ? new Date(bill.billDate).toISOString().slice(0, 10) : '',
    dueDate: bill.dueDate ? new Date(bill.dueDate).toISOString().slice(0, 10) : '',
    terms: bill.terms ?? '',
    poNumber: bill.poNumber ?? '',
    notes: bill.notes ?? '',
  }));
  const [error, setError] = useState('');
  const billPayments = useQuery({
    queryKey: ['procurement-bill-payments', bill._id],
    queryFn: async () => {
      const { data } = await api.get('/admin/purchases/payments', {
        params: { purchaseBillId: bill._id, page: 1, limit: 100 },
      });
      return (data.data ?? []) as BillPayment[];
    },
  });
  const canEditOrVoid = !['void', 'paid', 'partially_paid'].includes(bill.status)
    && !bill.stockReceived
    && Number(bill.amountPaid || 0) === 0;

  const submitUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await onUpdate(form);
      setEditing(false);
    } catch (submitError) {
      setError(msg(submitError));
    }
  };

  const downloadInvoice = async () => {
    setError('');
    try {
      await onDownloadInvoice();
    } catch (downloadError) {
      setError(msg(downloadError));
    }
  };

  const confirmVoidBill = async () => {
    setError('');
    try {
      await onVoid();
    } catch (voidError) {
      setError(msg(voidError));
      setConfirmVoid(false);
    }
  };

  const removePayment = async (payment: BillPayment) => {
    if (!window.confirm(`Delete the ₹${Number(payment.amount).toFixed(2)} payment?`)) return;
    setError('');
    try {
      await api.delete(`/admin/purchases/payments/${payment._id}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['procurement-bill-payments', bill._id] }),
        queryClient.invalidateQueries({ queryKey: ['procurement-bill', bill._id] }),
        queryClient.invalidateQueries({ queryKey: ['procurement-bills'] }),
      ]);
    } catch (deleteError) {
      setError(msg(deleteError));
    }
  };

  const refreshAfterPayment = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['procurement-bill-payments', bill._id] }),
      queryClient.invalidateQueries({ queryKey: ['procurement-bill', bill._id] }),
      queryClient.invalidateQueries({ queryKey: ['procurement-bills'] }),
    ]);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="bill-details-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0b55ad]">Purchase bill</p>
            <h2 id="bill-details-title" className="mt-1 text-xl font-bold text-[#0b2346]">
              Bill #{String(bill.billNumber).padStart(5, '0')}
            </h2>
            <div className="mt-2">{statusBadge(bill.status)}</div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label="Close bill details">
            <X size={18} />
          </Button>
        </div>
        <div className="space-y-5 px-5 py-5 sm:px-6">
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="text-sm text-gray-600"><span className="font-semibold text-gray-800">Vendor:</span> {bill.purchaseVendorId?.displayName || bill.purchaseVendorId?.legalName || '—'}</p>
            <p className="text-sm text-gray-600"><span className="font-semibold text-gray-800">Purchase order:</span> {bill.poNumber || bill.purchaseOrderId?.poNumber || '—'}</p>
            <p className="text-sm text-gray-600"><span className="font-semibold text-gray-800">Warehouse:</span> {bill.warehouseId?.name || 'Not selected'}</p>
            <p className="text-sm text-gray-600"><span className="font-semibold text-gray-800">Bill date:</span> {bill.billDate ? new Date(bill.billDate).toLocaleDateString() : '—'}</p>
            <p className="text-sm text-gray-600"><span className="font-semibold text-gray-800">Total:</span> ₹{Number(bill.total).toLocaleString()}</p>
            <p className="text-sm text-gray-600"><span className="font-semibold text-gray-800">Paid:</span> ₹{Number(bill.amountPaid || 0).toLocaleString()}</p>
            <p className="text-sm text-gray-600"><span className="font-semibold text-gray-800">Balance due:</span> ₹{Number(bill.balanceDue).toLocaleString()}</p>
          </div>

          <section className="space-y-3 rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-[#0b2346]">Payment history</h3>
              {!['draft', 'void', 'paid'].includes(bill.status) && Number(bill.balanceDue) > 0 && bill.purchaseVendorId?._id && (
                <Button type="button" size="sm" disabled={saving} onClick={() => setRecordingPayment(true)} className="bg-[#0b438d] text-white hover:bg-[#082f68]">
                  Record payment
                </Button>
              )}
            </div>
            {billPayments.isLoading ? (
              <p className="text-sm text-gray-500">Loading payments…</p>
            ) : billPayments.isError ? (
              <p role="alert" className="text-sm text-red-700">{msg(billPayments.error)}</p>
            ) : billPayments.data?.length ? (
              <div className="divide-y divide-gray-100">
                {billPayments.data.map(payment => (
                  <div key={payment._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <p className="font-medium text-gray-800">₹{Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} · {payment.mode.replace('_', ' ')}</p>
                      <p className="text-xs text-gray-500">{new Date(payment.paymentDate).toLocaleDateString()}{payment.reference ? ` · Ref: ${payment.reference}` : ''}</p>
                    </div>
                    <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => void removePayment(payment)} className="text-red-600 hover:bg-red-50">Delete</Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No payments recorded for this bill.</p>
            )}
          </section>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <Table>
              <TableHeader><TableRow className="bg-[#f5f8fc]">
                {['Item', 'Billed qty', 'Received qty', 'Rate', 'Amount'].map(label => <TableHead key={label} className="text-xs uppercase tracking-wide">{label}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {bill.items.map(item => (
                  <TableRow key={item._id}>
                    <TableCell className="font-medium text-[#0b2346]">{item.itemName}</TableCell>
                    <TableCell>{item.billedQty ?? Number(item.qty) + Number(item.freeQty || 0)} {item.unit || ''}</TableCell>
                    <TableCell>{item.qtyReceived ?? '—'}</TableCell>
                    <TableCell>₹{Number(item.rate || 0).toLocaleString()}</TableCell>
                    <TableCell>₹{Number(item.amount || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {bill.grnInvoicePath && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
              <div>
                <p className="text-sm font-semibold text-[#0b2346]">GRN invoice</p>
                <p className="text-xs text-gray-500">{bill.grnInvoiceOriginalName || 'Uploaded invoice'}</p>
              </div>
              <Button type="button" variant="outline" disabled={saving} onClick={() => void downloadInvoice()}>
                Download invoice
              </Button>
            </div>
          )}

          {editing ? (
            <form onSubmit={submitUpdate} className="space-y-3 rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-[#0b2346]">Edit bill details</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="bill-date">Bill date</Label><Input id="bill-date" type="date" required value={form.billDate} onChange={event => setForm(current => ({ ...current, billDate: event.target.value }))} /></div>
                <div><Label htmlFor="bill-due-date">Due date</Label><Input id="bill-due-date" type="date" value={form.dueDate} onChange={event => setForm(current => ({ ...current, dueDate: event.target.value }))} /></div>
                <div><Label htmlFor="bill-terms">Terms</Label><Input id="bill-terms" value={form.terms} onChange={event => setForm(current => ({ ...current, terms: event.target.value }))} /></div>
                <div><Label htmlFor="bill-po-number">PO number</Label><Input id="bill-po-number" value={form.poNumber} onChange={event => setForm(current => ({ ...current, poNumber: event.target.value }))} /></div>
                <div className="sm:col-span-2"><Label htmlFor="bill-notes">Notes</Label><Input id="bill-notes" value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} /></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
                <Button type="submit" disabled={saving} className="bg-[#0b438d] text-white hover:bg-[#082f68]">Save details</Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
              {canEditOrVoid && <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(true)}>Edit details</Button>}
              {!bill.stockReceived && !['draft', 'void'].includes(bill.status) && (
                <Button type="button" disabled={saving} onClick={onReceive} className="bg-[#0b438d] text-white hover:bg-[#082f68]">
                  <PackageCheck size={15} /> Receive stock
                </Button>
              )}
              {canEditOrVoid && <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirmVoid(true)} className="border-red-200 text-red-700 hover:bg-red-50">Void bill</Button>}
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Close</Button>
            </div>
          )}
          {bill.stockReceived && <p className="text-xs text-amber-700">Received stock must be reversed before this bill can be voided or edited.</p>}
          {confirmVoid && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-950/50 p-4">
              <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                <h3 className="font-semibold text-[#0b2346]">Void this bill?</h3>
                <p className="mt-2 text-sm text-gray-600">This action cannot be undone. Bills with payments, completed returns, or received stock cannot be voided.</p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirmVoid(false)}>Cancel</Button>
                  <Button type="button" disabled={saving} onClick={() => void confirmVoidBill()} className="bg-red-600 text-white hover:bg-red-700">Confirm void</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {recordingPayment && bill.purchaseVendorId?._id && (
        <PaymentDialog
          fixedBill={{
            _id: bill._id,
            billNumber: bill.billNumber,
            balanceDue: bill.balanceDue,
            purchaseVendorId: {
              _id: bill.purchaseVendorId._id,
              displayName: bill.purchaseVendorId.displayName,
            },
          }}
          onClose={() => setRecordingPayment(false)}
          onSaved={refreshAfterPayment}
        />
      )}
    </div>
  );
}

export function ProcurementBillsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeBillId, setActiveBillId] = useState<string | null>(null);
  const [receiving, setReceiving] = useState(false);

  const query = useQuery({
    queryKey: ['procurement-bills', page, search],
    queryFn: async () => {
      const { data } = await api.get('/admin/purchases/bills', { params: { page, limit: 20, search: search || undefined } });
      return { rows: data.data as Bill[], total: data.pagination?.total ?? 0 };
    },
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const billDetails = useQuery({
    queryKey: ['procurement-bill', activeBillId],
    enabled: Boolean(activeBillId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/purchases/bills/${activeBillId}`);
      return data.data as BillDetails;
    },
  });

  const receiveStock = async (
    bill: BillDetails,
    warehouseId: string,
    invoice: File,
    items: { billItemId: string; qtyReceived: number; batchCode?: string; expiryDate?: string }[],
  ) => {
    setBusy(bill._id);
    try {
      const formData = new FormData();
      formData.append('warehouseId', warehouseId);
      formData.append('invoice', invoice);
      formData.append('items', JSON.stringify(items));
      await api.post(`/admin/purchases/bills/${bill._id}/mark-stock-received`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await queryClient.invalidateQueries({ queryKey: ['procurement-bills'] });
      await queryClient.invalidateQueries({ queryKey: ['procurement-orders'] });
      setReceiving(false);
      setActiveBillId(null);
      toast.success('Stock marked as received');
    } catch (error) {
      throw new Error(msg(error));
    }
    finally { setBusy(null); }
  };

  const updateBill = async (bill: BillDetails, update: BillUpdate) => {
    setBusy(bill._id);
    try {
      await api.put(`/admin/purchases/bills/${bill._id}`, {
        ...update,
        dueDate: update.dueDate || null,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['procurement-bills'] }),
        queryClient.invalidateQueries({ queryKey: ['procurement-bill', bill._id] }),
      ]);
      toast.success('Bill details updated');
    } catch (error) {
      throw new Error(msg(error));
    } finally {
      setBusy(null);
    }
  };

  const voidBill = async (bill: BillDetails) => {
    setBusy(bill._id);
    try {
      await api.post(`/admin/purchases/bills/${bill._id}/void`);
      await queryClient.invalidateQueries({ queryKey: ['procurement-bills'] });
      await queryClient.invalidateQueries({ queryKey: ['procurement-orders'] });
      setActiveBillId(null);
      toast.success('Bill voided');
    } catch (error) {
      throw new Error(msg(error));
    } finally {
      setBusy(null);
    }
  };

  const downloadInvoice = async (bill: BillDetails) => {
    try {
      const { data } = await api.get(
        `/admin/purchases/bills/${bill._id}/grn-invoice`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = bill.grnInvoiceOriginalName || `grn-invoice-${bill.billNumber}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      throw new Error(msg(error));
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#0b55ad]"><ArrowLeft size={15} /> Dashboard</Link>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0b55ad]">Procurement</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0b2346]">Purchase Bills</h1>
            <p className="mt-1 text-sm text-gray-500">Review bills generated from purchase orders and confirm stock receipt.</p>
          </div>
          <Link href="/admin/procurement/orders">
            <Button variant="outline" className="h-11 rounded-xl">View Orders</Button>
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: 'Total bills', value: total },
            { label: 'Open', value: rows.filter(r => r.status === 'open').length },
            { label: 'Stock pending', value: rows.filter(r => !r.stockReceived).length },
            { label: 'Paid', value: rows.filter(r => r.status === 'paid').length },
          ].map(stat => (
            <Card key={stat.label} className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-[#0b2346]">{query.isLoading ? '—' : stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf5] bg-white px-5 py-4">
            <h2 className="font-semibold text-[#0b2346]">All purchase bills</h2>
            <div className="relative w-full sm:max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by bill or PO number…" className="h-10 rounded-xl border-gray-200 bg-[#f7f9fc] pl-9" />
            </div>
          </div>

          {query.isLoading ? (
            <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin text-[#0b55ad]" /> Loading bills…</div>
          ) : query.isError ? (
            <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              <p>{msg(query.error)}</p>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void query.refetch()}>Try again</Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <PackageCheck className="mx-auto mb-2 text-gray-300" size={28} />
              <p className="font-medium text-gray-700">No bills yet</p>
              <p className="mt-1 text-sm text-gray-500">Bills are created by converting an issued purchase order.</p>
              <Link href="/admin/procurement/orders"><Button className="mt-4 bg-[#0b438d] text-white hover:bg-[#082f68]">Go to Orders</Button></Link>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f5f8fc]">
                    {['Bill #', 'PO Number', 'Vendor', 'Warehouse', 'Date', 'Total', 'Balance Due', 'Status', 'Stock', 'Actions'].map(h => (
                      <TableHead key={h} className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#526783] ${h === 'Actions' ? 'text-right' : ''}`}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(bill => (
                    <TableRow key={bill._id} className="hover:bg-[#f8faff]">
                      <TableCell className="px-5 font-semibold text-[#0b2346]">#{String(bill.billNumber).padStart(5, '0')}</TableCell>
                      <TableCell className="text-sm text-gray-600">{bill.poNumber ?? bill.purchaseOrderId?.poNumber ?? '—'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{bill.purchaseVendorId?.displayName ?? '—'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{bill.warehouseId?.name ?? '—'}</TableCell>
                      <TableCell className="text-sm text-gray-500">{bill.billDate ? new Date(bill.billDate).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="font-semibold text-[#0b2346]">₹{Number(bill.total).toLocaleString()}</TableCell>
                      <TableCell className="font-semibold text-amber-700">₹{Number(bill.balanceDue).toLocaleString()}</TableCell>
                      <TableCell>{statusBadge(bill.status)}</TableCell>
                      <TableCell>
                        {bill.stockReceived
                          ? <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Received</Badge>
                          : <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">Pending</Badge>}
                      </TableCell>
                      <TableCell className="px-5 py-3.5 text-right">
                        <Button size="sm" variant="outline" disabled={busy === bill._id} onClick={() => {
                          setReceiving(false);
                          setActiveBillId(bill._id);
                        }}>
                          View details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                  <p className="text-xs text-gray-500">Page {page} of {totalPages} · {total} bills</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
      {activeBillId && billDetails.isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4">
          <div role="status" className="flex items-center gap-2 rounded-xl bg-white px-5 py-4 text-sm text-gray-600 shadow-xl">
            <LoaderCircle size={18} className="animate-spin text-[#0b55ad]" /> Loading bill details…
          </div>
        </div>
      )}
      {activeBillId && billDetails.isError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4">
          <div role="alert" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-sm text-red-700">{msg(billDetails.error)}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setReceiving(false); setActiveBillId(null); }}>Close</Button>
              <Button type="button" onClick={() => void billDetails.refetch()}>Try again</Button>
            </div>
          </div>
        </div>
      )}
      {activeBillId && billDetails.data && (
        <BillDetailsDialog
          key={`details-${activeBillId}`}
          bill={billDetails.data}
          saving={busy === activeBillId}
          onClose={() => { setReceiving(false); setActiveBillId(null); }}
          onReceive={() => setReceiving(true)}
          onUpdate={update => updateBill(billDetails.data!, update)}
          onVoid={() => voidBill(billDetails.data!)}
          onDownloadInvoice={() => downloadInvoice(billDetails.data!)}
        />
      )}
      {activeBillId && receiving && billDetails.data && (
        <ReceiveStockDialog
          key={`receive-${activeBillId}`}
          bill={billDetails.data}
          saving={busy === activeBillId}
          onClose={() => setReceiving(false)}
          onSubmit={(warehouseId, invoice, items) => receiveStock(billDetails.data!, warehouseId, invoice, items)}
        />
      )}
    </AdminLayout>
  );
}

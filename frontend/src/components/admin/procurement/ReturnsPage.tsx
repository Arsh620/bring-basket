'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { ArrowLeft, Download, FileUp, LoaderCircle, Plus, Printer, Search, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api/client';

type Vendor = { _id: string; displayName: string };
type Bill = {
  _id: string;
  billNumber: number | string;
  billDate?: string;
  status: string;
  purchaseVendorId: Vendor | null;
};
type BillItem = {
  _id: string;
  itemId: string | null;
  itemName: string;
  unitName: string;
  maxQty: number;
  billedQty: number;
  rate: number;
  taxPercent: number;
};
type CustomLine = {
  key: string;
  itemName: string;
  unitName: string;
  returnedQty: string;
  rate: string;
  taxRate: string;
};
type ReturnLine = {
  purchaseBillItemId?: string;
  itemId?: string | null;
  itemName: string;
  unitName: string;
  returnedQty: number;
  billedQty?: number | null;
  rate: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount?: number;
};
type PurchaseReturn = {
  _id: string;
  returnNumber: string;
  returnDate: string;
  reason: string;
  status: string;
  totalAmount: number;
  stockDeducted: boolean;
  stockDeductedFrom?: string | null;
  notes?: string;
  purchaseVendorId: Vendor | null;
  purchaseBillId: { _id: string; billNumber: number | string } | null;
  storeId: { name: string } | null;
  warehouseId: { name: string } | null;
  items?: ReturnLine[];
};

function message(error: unknown) {
  if (error instanceof AxiosError) return error.response?.data?.message || error.message;
  return error instanceof Error ? error.message : 'Request failed';
}

function today() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: 'bg-amber-50 text-amber-700',
    completed: 'bg-emerald-50 text-emerald-700',
    void: 'bg-red-50 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
  };
  return <Badge className={`capitalize hover:bg-inherit ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</Badge>;
}

function ReturnDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [vendorId, setVendorId] = useState('');
  const [billId, setBillId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [returnDate, setReturnDate] = useState(today);
  const [reason, setReason] = useState('damaged');
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [customLines, setCustomLines] = useState<CustomLine[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const vendors = useQuery({
    queryKey: ['return-vendors'],
    queryFn: async () => {
      const { data } = await api.get('/admin/purchases/vendors', {
        params: { page: 1, limit: 100, approval: 'approved', status: 'true' },
      });
      return (data.data ?? []) as Vendor[];
    },
  });
  const bills = useQuery({
    queryKey: ['return-bills', vendorId],
    enabled: Boolean(vendorId),
    queryFn: async () => {
      const { data } = await api.get('/admin/purchases/returns/bills', {
        params: { purchaseVendorId: vendorId },
      });
      return (data.data ?? []) as Bill[];
    },
  });
  const billItems = useQuery({
    queryKey: ['return-bill-items', billId],
    enabled: Boolean(billId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/purchases/returns/bills/${billId}/items`);
      return data.data as { items: BillItem[]; bill: { billNumber: string | number } };
    },
  });
  const stores = useQuery({
    queryKey: ['return-stores'],
    enabled: !billId,
    queryFn: async () => {
      const { data } = await api.get('/admin/stores', { params: { page: 1, limit: 100, status: 'true' } });
      return (data.data ?? []) as { _id: string; name: string }[];
    },
  });
  const items = billItems.data?.items ?? [];
  const addCustomLine = () => setCustomLines(current => [...current, {
    key: `${Date.now()}-${Math.random()}`,
    itemName: '',
    unitName: 'pcs',
    returnedQty: '1',
    rate: '0',
    taxRate: '0',
  }]);

  const downloadTemplate = async () => {
    if (!billId) return;
    try {
      const response = await api.get(`/admin/purchases/returns/bills/${billId}/template.csv`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bill_${billItems.data?.bill.billNumber || billId}_return_template.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(message(downloadError));
    }
  };

  const importTemplate = async (file: File | null) => {
    if (!file || !billId) return;
    setCsvFile(file);
    setError('');
    try {
      const csv = await file.text();
      const { data } = await api.post('/admin/purchases/returns/import', {
        purchaseBillId: billId,
        csv,
      });
      const imported = (data.data.items as ReturnLine[]).reduce<Record<string, string>>((result, line) => {
        if (line.purchaseBillItemId) result[line.purchaseBillItemId] = String(line.returnedQty);
        return result;
      }, {});
      setQuantities(imported);
      toast.success(`${data.data.count} return line${data.data.count === 1 ? '' : 's'} imported`);
    } catch (importError) {
      setError(message(importError));
    } finally {
      setCsvFile(null);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const selected: {
      purchaseBillItemId?: string;
      itemId?: string | null;
      itemName: string;
      unitName: string;
      returnedQty: number;
      rate: number;
      taxRate: number;
    }[] = billId
      ? items.map(item => ({
        purchaseBillItemId: item._id,
        itemId: item.itemId,
        itemName: item.itemName,
        unitName: item.unitName,
        returnedQty: Number(quantities[item._id] || 0),
        rate: item.rate,
        taxRate: item.taxPercent,
      }))
      .filter(item => item.returnedQty > 0)
      : customLines.map(line => ({
        itemName: line.itemName.trim(),
        unitName: line.unitName.trim() || 'pcs',
        returnedQty: Number(line.returnedQty),
        rate: Number(line.rate),
        taxRate: Number(line.taxRate),
      })).filter(line => line.returnedQty > 0);
    if (!vendorId) {
      setError('Select a vendor.');
      return;
    }
    if (!billId && !storeId) {
      setError('Select a store for a standalone return.');
      return;
    }
    if (!selected.length) {
      setError('Enter a return quantity for at least one item.');
      return;
    }
    if (selected.some(item => !item.itemName || !Number.isFinite(item.returnedQty)
      || item.returnedQty <= 0 || !Number.isFinite(item.rate) || item.rate < 0
      || !Number.isFinite(item.taxRate) || item.taxRate < 0 || item.taxRate > 100)) {
      setError('Check that each item has a name, positive quantity, non-negative rate, and tax from 0 to 100.');
      return;
    }
    if (billId && selected.some(item => (
      item.returnedQty > (items.find(row => row._id === item.purchaseBillItemId)?.maxQty ?? 0)
    ))) {
      setError('A return quantity exceeds the remaining bill quantity.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/admin/purchases/returns', {
        purchaseVendorId: vendorId,
        ...(billId ? { purchaseBillId: billId } : {}),
        ...(!billId ? { storeId } : {}),
        returnDate,
        reason,
        notes: notes.trim(),
        items: selected,
      });
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(message(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="create-return-title" className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0b55ad]">Procurement</p>
            <h2 id="create-return-title" className="mt-1 text-xl font-bold text-[#0b2346]">Create purchase return</h2>
            <p className="mt-1 text-sm text-gray-500">Saved returns reserve billed quantities until approved or voided.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close return form" onClick={onClose} disabled={saving}><X size={18} /></Button>
        </div>
        <form onSubmit={submit} className="space-y-5 px-5 py-5 sm:px-6">
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="return-vendor">Vendor *</Label>
              <select id="return-vendor" required value={vendorId} onChange={event => {
                setVendorId(event.target.value);
                setBillId('');
                setQuantities({});
                setCustomLines([]);
              }} disabled={vendors.isLoading || vendors.isError} className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm">
                <option value="">{vendors.isLoading ? 'Loading vendors…' : 'Select vendor'}</option>
                {(vendors.data ?? []).map(vendor => <option key={vendor._id} value={vendor._id}>{vendor.displayName}</option>)}
              </select>
              {vendors.isError && <p role="alert" className="mt-1 text-xs text-red-700">{message(vendors.error)}</p>}
            </div>
            <div>
              <Label htmlFor="return-bill">Original bill (optional)</Label>
              <select id="return-bill" value={billId} onChange={event => {
                setBillId(event.target.value);
                setQuantities({});
                setCustomLines([]);
              }} disabled={!vendorId || bills.isLoading || bills.isError} className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm">
                <option value="">{!vendorId ? 'Select a vendor first' : bills.isLoading ? 'Loading bills…' : 'Standalone return'}</option>
                {(bills.data ?? []).map(bill => <option key={bill._id} value={bill._id}>Bill #{bill.billNumber} · {bill.billDate?.slice(0, 10) || '—'}</option>)}
              </select>
              {bills.isError && <p role="alert" className="mt-1 text-xs text-red-700">{message(bills.error)}</p>}
            </div>
            <div>
              <Label htmlFor="return-date">Return date *</Label>
              <Input id="return-date" type="date" required value={returnDate} onChange={event => setReturnDate(event.target.value)} className="mt-1" />
            </div>
            {!billId && (
              <div>
                <Label htmlFor="return-store">Stock location *</Label>
                <select id="return-store" required value={storeId} onChange={event => setStoreId(event.target.value)} disabled={stores.isLoading || stores.isError} className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm">
                  <option value="">{stores.isLoading ? 'Loading stores…' : 'Select store'}</option>
                  {(stores.data ?? []).map(store => <option key={store._id} value={store._id}>{store.name}</option>)}
                </select>
                {stores.isError && <p role="alert" className="mt-1 text-xs text-red-700">{message(stores.error)}</p>}
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="return-reason">Reason *</Label>
              <select id="return-reason" value={reason} onChange={event => setReason(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm">
                {['damaged', 'expired', 'wrong_item', 'excess', 'defective', 'overstock', 'other'].map(value => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="return-notes">Notes</Label>
              <Input id="return-notes" maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} className="mt-1" placeholder="Optional notes" />
            </div>
          </div>
          {billId && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-[#0b2346]">Bill items</h3>
                  <p className="text-xs text-gray-500">Returned quantity cannot exceed the remaining billed quantity.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="rounded-lg" onClick={downloadTemplate} disabled={!billItems.data || billItems.isError}>
                    <Download size={15} /> Download CSV template
                  </Button>
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <FileUp size={15} /> {csvFile ? 'Importing…' : 'Import CSV'}
                    <input type="file" accept=".csv,text/csv" className="sr-only" disabled={!billItems.data || Boolean(csvFile)} onChange={event => {
                      void importTemplate(event.target.files?.[0] ?? null);
                      event.currentTarget.value = '';
                    }} />
                  </label>
                </div>
              </div>
              {billItems.isLoading ? (
                <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={17} className="animate-spin" /> Loading bill items…</div>
              ) : billItems.isError ? (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message(billItems.error)}</p>
              ) : items.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">All bill quantities have already been returned.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <Table>
                    <TableHeader><TableRow className="bg-[#f5f8fc]">
                      {['Item', 'Billed', 'Remaining', 'Rate', 'Return qty'].map(label => <TableHead key={label} className="text-xs uppercase tracking-wide text-[#526783]">{label}</TableHead>)}
                    </TableRow></TableHeader>
                    <TableBody>{items.map(item => (
                      <TableRow key={item._id}>
                        <TableCell className="min-w-52 font-medium text-[#0b2346]">{item.itemName}<span className="ml-1 text-xs text-gray-500">{item.unitName}</span></TableCell>
                        <TableCell>{item.billedQty}</TableCell>
                        <TableCell>{item.maxQty}</TableCell>
                        <TableCell>₹{Number(item.rate).toFixed(2)}</TableCell>
                        <TableCell><Input aria-label={`Return quantity for ${item.itemName}`} type="number" min="0" max={item.maxQty} step="0.001" value={quantities[item._id] ?? ''} onChange={event => setQuantities(current => ({ ...current, [item._id]: event.target.value }))} className="h-9 w-28" /></TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
          {!billId && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-[#0b2346]">Custom return items</h3>
                  <p className="text-xs text-gray-500">Standalone rows are not linked to billed quantities.</p>
                </div>
                <Button type="button" variant="outline" className="rounded-lg" onClick={addCustomLine}><Plus size={15} /> Add custom row</Button>
              </div>
              {customLines.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Add at least one item row.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <Table>
                    <TableHeader><TableRow className="bg-[#f5f8fc]">
                      {['Item name', 'Unit', 'Qty', 'Rate', 'Tax %', ''].map((label, index) => <TableHead key={`${label}-${index}`} className="text-xs uppercase tracking-wide text-[#526783]">{label}</TableHead>)}
                    </TableRow></TableHeader>
                    <TableBody>{customLines.map(line => (
                      <TableRow key={line.key}>
                        <TableCell><Input aria-label="Custom item name" required maxLength={500} value={line.itemName} onChange={event => setCustomLines(current => current.map(row => row.key === line.key ? { ...row, itemName: event.target.value } : row))} className="min-w-52" placeholder="Item name" /></TableCell>
                        <TableCell><Input aria-label="Item unit" maxLength={32} value={line.unitName} onChange={event => setCustomLines(current => current.map(row => row.key === line.key ? { ...row, unitName: event.target.value } : row))} className="w-20" /></TableCell>
                        <TableCell><Input aria-label="Returned quantity" type="number" min="0.001" step="0.001" required value={line.returnedQty} onChange={event => setCustomLines(current => current.map(row => row.key === line.key ? { ...row, returnedQty: event.target.value } : row))} className="w-24" /></TableCell>
                        <TableCell><Input aria-label="Item rate" type="number" min="0" step="0.01" required value={line.rate} onChange={event => setCustomLines(current => current.map(row => row.key === line.key ? { ...row, rate: event.target.value } : row))} className="w-28" /></TableCell>
                        <TableCell><Input aria-label="Tax rate" type="number" min="0" max="100" step="0.01" value={line.taxRate} onChange={event => setCustomLines(current => current.map(row => row.key === line.key ? { ...row, taxRate: event.target.value } : row))} className="w-24" /></TableCell>
                        <TableCell><Button type="button" variant="ghost" size="icon" aria-label="Remove item" onClick={() => setCustomLines(current => current.filter(row => row.key !== line.key))}><Trash2 size={15} /></Button></TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !vendorId || (billId && (billItems.isLoading || items.length === 0)) || (!billId && customLines.length === 0)} className="bg-[#0b438d] text-white hover:bg-[#082f68]">
              {saving && <LoaderCircle size={16} className="animate-spin" />} Save draft
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReturnDetails({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const details = useQuery({
    queryKey: ['procurement-return', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/purchases/returns/${id}`);
      return data.data as PurchaseReturn;
    },
  });
  const record = details.data;

  const action = async (type: 'approve' | 'void') => {
    if (!record) return;
    const prompt = type === 'approve'
      ? 'Approve this return and deduct stock from the bill location?'
      : 'Void this return? Any deducted stock will be restored.';
    if (!window.confirm(prompt)) return;
    setBusy(true);
    try {
      await api.post(`/admin/purchases/returns/${id}/${type}`);
      await onChanged();
      await details.refetch();
      toast.success(type === 'approve' ? 'Return approved and stock deducted' : 'Return voided');
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="return-detail-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl print:max-h-none print:overflow-visible print:rounded-none print:shadow-none">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-6 print:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0b55ad]">Debit note</p>
            <h2 id="return-detail-title" className="mt-1 text-xl font-bold text-[#0b2346]">{record?.returnNumber ?? 'Purchase return'}</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close return details" onClick={onClose}><X size={18} /></Button>
        </div>
        {details.isLoading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin" /> Loading return…</div>
        ) : details.isError ? (
          <p role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message(details.error)}</p>
        ) : record ? (
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">Vendor</p>
                <p className="font-semibold text-[#0b2346]">{record.purchaseVendorId?.displayName ?? '—'}</p>
                <p className="mt-2 text-sm text-gray-500">Original bill</p>
                <p className="font-medium">#{record.purchaseBillId?.billNumber ?? '—'}</p>
              </div>
              <div className="space-y-2 text-right">
                {statusBadge(record.status)}
                <p className="text-sm text-gray-500">{new Date(record.returnDate).toLocaleDateString()}</p>
                <p className="text-sm capitalize text-gray-600">{record.reason.replace('_', ' ')}</p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <Table>
                <TableHeader><TableRow className="bg-[#f5f8fc]">
                  {['Item', 'Billed qty', 'Returned qty', 'Rate', 'Tax', 'Total'].map(label => <TableHead key={label} className="text-xs uppercase tracking-wide text-[#526783]">{label}</TableHead>)}
                </TableRow></TableHeader>
                <TableBody>{(record.items ?? []).map((item, index) => (
                  <TableRow key={`${item.purchaseBillItemId ?? item.itemName}-${index}`}>
                    <TableCell className="font-medium text-[#0b2346]">{item.itemName}<span className="ml-1 text-xs text-gray-500">{item.unitName}</span></TableCell>
                    <TableCell>{item.billedQty ?? '—'}</TableCell>
                    <TableCell>{item.returnedQty}</TableCell>
                    <TableCell>₹{Number(item.rate).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(item.taxAmount ?? 0).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(item.totalAmount ?? 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="text-sm text-gray-600">
                <p>Stock deducted: <span className="font-medium">{record.stockDeducted ? `Yes (${record.stockDeductedFrom ?? 'inventory'})` : 'No'}</span></p>
                {record.notes && <p className="mt-2 max-w-xl whitespace-pre-wrap">Notes: {record.notes}</p>}
              </div>
              <p className="text-lg font-bold text-[#0b2346]">Total: ₹{Number(record.totalAmount).toFixed(2)}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4 print:hidden">
              <Button type="button" variant="outline" onClick={() => window.print()}><Printer size={15} /> Print / Save PDF</Button>
              {record.status === 'draft' && <Button type="button" disabled={busy} onClick={() => action('approve')} className="bg-emerald-700 text-white hover:bg-emerald-800">{busy && <LoaderCircle size={15} className="animate-spin" />} Approve & deduct stock</Button>}
              {record.status !== 'void' && <Button type="button" variant="destructive" disabled={busy} onClick={() => action('void')}>{busy && <LoaderCircle size={15} className="animate-spin" />} Void return</Button>}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProcurementReturnsPage() {
  const queryClient = useQueryClient();
  const [vendorId, setVendorId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const vendors = useQuery({
    queryKey: ['return-vendors'],
    queryFn: async () => {
      const { data } = await api.get('/admin/purchases/vendors', {
        params: { page: 1, limit: 100, approval: 'approved', status: 'true' },
      });
      return (data.data ?? []) as Vendor[];
    },
  });
  const results = useQuery({
    queryKey: ['procurement-returns', page, vendorId, status, search, from, to],
    queryFn: async () => {
      const { data } = await api.get('/admin/purchases/returns', {
        params: {
          page,
          limit: 20,
          purchaseVendorId: vendorId || undefined,
          status: status || undefined,
          search: search || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });
      return { rows: data.data as PurchaseReturn[], pagination: data.pagination };
    },
  });
  const rows = results.data?.rows ?? [];
  const pagination = results.data?.pagination;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['procurement-returns'] }),
      queryClient.invalidateQueries({ queryKey: ['procurement-return'] }),
      queryClient.invalidateQueries({ queryKey: ['procurement-bills'] }),
      queryClient.invalidateQueries({ queryKey: ['procurement-bill'] }),
      queryClient.invalidateQueries({ queryKey: ['procurement-payments'] }),
    ]);
  };

  const exportCsv = async () => {
    try {
      const response = await api.get('/admin/purchases/returns/export.csv', {
        params: {
          purchaseVendorId: vendorId || undefined,
          status: status || undefined,
          search: search || undefined,
          from: from || undefined,
          to: to || undefined,
        },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'purchase_returns.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(message(error));
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1440px] space-y-6 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#0b55ad]"><ArrowLeft size={15} /> Dashboard</Link>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0b55ad]">Procurement</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0b2346]">Purchase Returns</h1>
            <p className="mt-1 text-sm text-gray-500">Create debit notes, return stock, and adjust vendor bill balances.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><Download size={16} /> Export CSV</Button>
            <Button onClick={() => setCreating(true)} className="h-11 rounded-xl bg-[#0b438d] px-5 text-white hover:bg-[#082f68]"><Plus size={17} /> New return</Button>
          </div>
        </div>

        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#e7edf5] bg-white px-5 py-4">
            <h2 className="mr-auto font-semibold text-[#0b2346]">Debit notes</h2>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input aria-label="Search purchase returns" placeholder="Return, vendor, or bill" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="h-10 w-56 rounded-xl pl-9" />
            </div>
            <select aria-label="Filter by vendor" value={vendorId} onChange={event => { setVendorId(event.target.value); setPage(1); }} disabled={vendors.isLoading || vendors.isError} className="h-10 min-w-44 rounded-xl border border-gray-200 bg-[#f7f9fc] px-3 text-sm">
              <option value="">All vendors</option>
              {(vendors.data ?? []).map(vendor => <option key={vendor._id} value={vendor._id}>{vendor.displayName}</option>)}
            </select>
            <select aria-label="Filter by status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-gray-200 bg-[#f7f9fc] px-3 text-sm">
              <option value="">All statuses</option>
              {['draft', 'completed', 'void'].map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <Input aria-label="Returns from date" type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} className="h-10 w-36 rounded-xl" />
            <Input aria-label="Returns to date" type="date" value={to} onChange={event => { setTo(event.target.value); setPage(1); }} className="h-10 w-36 rounded-xl" />
          </div>
          {vendors.isError && <p role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message(vendors.error)}</p>}
          {results.isLoading ? (
            <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin text-[#0b55ad]" /> Loading purchase returns…</div>
          ) : results.isError ? (
            <p role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message(results.error)}</p>
          ) : rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Search className="mx-auto mb-2 text-gray-300" size={27} />
              <p className="font-medium text-gray-700">No purchase returns found</p>
              <p className="mt-1 text-sm text-gray-500">Create a debit note against a received purchase bill.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="bg-[#f5f8fc]">
                    {['Date', 'Return #', 'Vendor', 'Bill', 'Status', 'Total', ''].map((label, index) => <TableHead key={`${label}-${index}`} className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#526783] ${index === 6 ? 'text-right' : ''}`}>{label}</TableHead>)}
                  </TableRow></TableHeader>
                  <TableBody>{rows.map(record => (
                    <TableRow key={record._id} className="hover:bg-[#f8faff]">
                      <TableCell className="px-5 text-sm text-gray-600">{record.returnDate ? new Date(record.returnDate).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="font-semibold text-[#0b2346]">{record.returnNumber}</TableCell>
                      <TableCell>{record.purchaseVendorId?.displayName ?? '—'}</TableCell>
                      <TableCell>{record.purchaseBillId ? `#${record.purchaseBillId.billNumber}` : '—'}</TableCell>
                      <TableCell>{statusBadge(record.status)}</TableCell>
                      <TableCell className="font-medium">₹{Number(record.totalAmount).toFixed(2)}</TableCell>
                      <TableCell className="px-5 text-right"><Button variant="outline" size="sm" onClick={() => setSelectedId(record._id)}>View</Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm text-gray-500">
                  <span>{pagination.total} return notes · Page {pagination.page} of {pagination.pages}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={page >= pagination.pages} onClick={() => setPage(current => current + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
      {creating && <ReturnDialog onClose={() => setCreating(false)} onSaved={async () => {
        setPage(1);
        await refresh();
        toast.success('Purchase return saved as draft');
      }} />}
      {selectedId && <ReturnDetails id={selectedId} onClose={() => setSelectedId('')} onChanged={refresh} />}
    </AdminLayout>
  );
}

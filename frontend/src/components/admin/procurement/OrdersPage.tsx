'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { ArrowLeft, CheckCircle, LoaderCircle, Plus, Search, X, XCircle } from 'lucide-react';
import Link from 'next/link';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api/client';

type Choice = { _id: string; name?: string; displayName?: string; code?: string };
type CatalogItem = {
  _id: string;
  name: string;
  stockUnit?: string;
  unitId?: { name?: string } | string | null;
  unitGroupId?: string | null;
  purchasePrice?: number;
  price?: number;
  mrp?: number;
  tax?: number;
  taxType?: string;
};
type LineItem = {
  itemId: string;
  itemName: string;
  qty: string;
  rate: string;
  unit: string;
  taxPercent: string;
  unitGroupId?: string;
  mrp?: number;
  sellingPrice?: number;
};
type Order = {
  _id: string; poNumber: string; status: string;
  purchaseVendorId: Choice | null; warehouseId: Choice | null;
  poDate: string; total: number; subTotal: number; taxTotal: number;
  items: { itemName: string; qty: number; rate: number; amount: number }[];
};

function msg(error: unknown) {
  if (error instanceof AxiosError) return error.response?.data?.message || error.message;
  return error instanceof Error ? error.message : 'Request failed';
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    open: 'bg-blue-50 text-blue-700',
    partially_billed: 'bg-amber-50 text-amber-700',
    billed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-red-50 text-red-700',
  };
  return <Badge className={`capitalize hover:bg-inherit ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>{status.replace('_', ' ')}</Badge>;
}

function useChoices(endpoint: string, params: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['po-choices', endpoint, params],
    queryFn: async () => {
      const { data } = await api.get(endpoint, { params: { limit: 100, ...params } });
      return (data.data ?? []) as Choice[];
    },
  });
}

function CreateOrderDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const vendors = useChoices('/admin/purchases/vendors', { approval: 'approved', status: 'true' });
  const warehouses = useChoices('/admin/warehouses', { type: 'mother', status: 'active' });
  const [itemSearch, setItemSearch] = useState('');
  const items = useQuery({
    queryKey: ['purchase-order-items', itemSearch],
    queryFn: async () => {
      const { data } = await api.get('/admin/items', {
        params: { page: 1, limit: 100, status: 'true', search: itemSearch || undefined },
      });
      return (data.data ?? []) as CatalogItem[];
    },
  });
  const [vendorId, setVendorId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([{ itemId: '', itemName: '', qty: '1', rate: '0', unit: 'pcs', taxPercent: '0' }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const updateLine = (i: number, patch: Partial<LineItem>) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      await api.post('/admin/purchases/orders', {
        purchaseVendorId: vendorId,
        warehouseId,
        poDate,
        notes,
        items: lines.map(l => ({
          itemId: l.itemId,
          itemName: l.itemName,
          qty: Number(l.qty),
          rate: Number(l.rate),
          unit: l.unit,
          taxPercent: Number(l.taxPercent),
          ...(l.unitGroupId ? { unitGroupId: l.unitGroupId } : {}),
          ...(l.mrp !== undefined ? { mrp: l.mrp } : {}),
          ...(l.sellingPrice !== undefined ? { sellingPrice: l.sellingPrice } : {}),
        })),
      });
      await queryClient.invalidateQueries({ queryKey: ['procurement-orders'] });
      toast.success('Purchase order created');
      onClose();
    } catch (error) { setErr(msg(error)); }
    finally { setSaving(false); }
  };

  const selectClass = 'mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#0b55ad] focus:ring-4 focus:ring-[#0b55ad]/10';

  const addLine = () => setLines(ls => [...ls, {
    itemId: '', itemName: '', qty: '1', rate: '0', unit: 'pcs', taxPercent: '0',
  }]);

  const selectItem = (index: number, itemId: string) => {
    const item = items.data?.find(candidate => candidate._id === itemId);
    if (!item) {
      updateLine(index, { itemId: '', itemName: '' });
      return;
    }
    updateLine(index, {
      itemId: item._id,
      itemName: item.name,
      unit: item.stockUnit || (typeof item.unitId === 'object' ? item.unitId?.name : undefined) || 'pcs',
      rate: String(item.purchasePrice ?? 0),
      taxPercent: String(item.taxType === 'percent' ? item.tax ?? 0 : 0),
      unitGroupId: item.unitGroupId || undefined,
      mrp: item.mrp,
      sellingPrice: item.price,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0b55ad]">Procurement</p>
            <h2 className="mt-1 text-xl font-bold text-[#0b2346]">Create Purchase Order</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving}><X size={18} /></Button>
        </div>
        <form onSubmit={submit} className="space-y-5 px-6 py-5">
          {err && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Vendor <span className="text-red-500">*</span></Label>
              <select required value={vendorId} onChange={e => setVendorId(e.target.value)} disabled={vendors.isLoading || vendors.isError} className={selectClass}>
                <option value="">Select vendor</option>
                {(vendors.data ?? []).map(v => <option key={v._id} value={v._id}>{v.displayName}</option>)}
              </select>
              {vendors.isError && <p role="alert" className="mt-1 text-xs text-red-600">Could not load approved vendors.</p>}
              {!vendors.isLoading && vendors.data?.length === 0 && <p className="mt-1 text-xs text-amber-700">Approve an active vendor before creating a PO.</p>}
            </div>
            <div>
              <Label>Warehouse <span className="text-red-500">*</span></Label>
              <select required value={warehouseId} onChange={e => setWarehouseId(e.target.value)} disabled={warehouses.isLoading || warehouses.isError} className={selectClass}>
                <option value="">Select warehouse</option>
                {(warehouses.data ?? []).map(w => <option key={w._id} value={w._id}>{w.name} {w.code ? `· ${w.code}` : ''}</option>)}
              </select>
              {warehouses.isError && <p role="alert" className="mt-1 text-xs text-red-600">Could not load active mother warehouses.</p>}
              {!warehouses.isLoading && warehouses.data?.length === 0 && <p className="mt-1 text-xs text-amber-700">Create an active mother warehouse before creating a PO.</p>}
            </div>
            <div>
              <Label>PO Date</Label>
              <Input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} className="mt-1.5 h-11 rounded-xl border-gray-200" />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Line Items <span className="text-red-500">*</span></Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus size={14} /> Add line
              </Button>
            </div>
            <Input
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              placeholder="Search active catalog items…"
              aria-label="Search catalog items"
              className="mb-3 h-10 rounded-xl border-gray-200"
            />
            {items.isError && <p role="alert" className="mb-3 text-sm text-red-600">Could not load catalog items.</p>}
            {!items.isLoading && !items.isError && items.data?.length === 0 && (
              <p className="mb-3 text-sm text-amber-700">No active catalog items found. Add an item before creating a stock-receiving PO.</p>
            )}
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(160px,1fr)_80px_90px_80px_80px_32px]">
                  <div>
                    {i === 0 && <p className="mb-1 text-xs font-medium text-gray-500">Catalog item</p>}
                    <select
                      required
                      value={line.itemId}
                      disabled={items.isLoading || items.isError || !items.data?.length}
                      onChange={e => selectItem(i, e.target.value)}
                      aria-label={`Catalog item for line ${i + 1}`}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"
                    >
                      <option value="">{items.isLoading ? 'Loading items…' : 'Select item'}</option>
                      {(items.data ?? []).map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
                    </select>
                  </div>
                  <div>
                    {i === 0 && <p className="mb-1 text-xs font-medium text-gray-500">Qty</p>}
                    <Input type="number" min="0.01" step="any" required value={line.qty} onChange={e => updateLine(i, { qty: e.target.value })} className="h-10 rounded-lg border-gray-200" />
                  </div>
                  <div>
                    {i === 0 && <p className="mb-1 text-xs font-medium text-gray-500">Rate (₹)</p>}
                    <Input type="number" min="0" step="any" required value={line.rate} onChange={e => updateLine(i, { rate: e.target.value })} className="h-10 rounded-lg border-gray-200" />
                  </div>
                  <div>
                    {i === 0 && <p className="mb-1 text-xs font-medium text-gray-500">Unit</p>}
                    <Input value={line.unit} onChange={e => updateLine(i, { unit: e.target.value })} className="h-10 rounded-lg border-gray-200" />
                  </div>
                  <div>
                    {i === 0 && <p className="mb-1 text-xs font-medium text-gray-500">Tax %</p>}
                    <Input type="number" min="0" max="100" step="any" value={line.taxPercent} onChange={e => updateLine(i, { taxPercent: e.target.value })} className="h-10 rounded-lg border-gray-200" />
                  </div>
                  <Button type="button" variant="ghost" size="icon" disabled={lines.length === 1} onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))} className="h-10 w-8 text-gray-400 hover:text-red-600">
                    <X size={15} />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#0b55ad]" placeholder="Optional notes" />
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-[#0b438d] text-white hover:bg-[#082f68]">
              {saving && <LoaderCircle size={15} className="animate-spin" />} Create PO
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ProcurementOrdersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['procurement-orders', page, search],
    queryFn: async () => {
      const { data } = await api.get('/admin/purchases/orders', { params: { page, limit: 20, search: search || undefined } });
      return { rows: data.data as Order[], total: data.pagination?.total ?? 0 };
    },
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const action = async (order: Order, type: 'issue' | 'cancel' | 'convert-to-bill') => {
    if (type === 'cancel' && !window.confirm(`Cancel PO "${order.poNumber}"?`)) return;
    setBusy(order._id);
    try {
      await api.post(`/admin/purchases/orders/${order._id}/${type}`);
      await queryClient.invalidateQueries({ queryKey: ['procurement-orders'] });
      toast.success(type === 'issue' ? 'PO issued' : type === 'cancel' ? 'PO cancelled' : 'Converted to bill');
    } catch (error) { toast.error(msg(error)); }
    finally { setBusy(null); }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#0b55ad]"><ArrowLeft size={15} /> Dashboard</Link>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0b55ad]">Procurement</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0b2346]">Purchase Orders</h1>
            <p className="mt-1 text-sm text-gray-500">Create and manage purchase orders for warehouse stock replenishment.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/procurement/bills">
              <Button variant="outline" className="h-11 rounded-xl">View Bills</Button>
            </Link>
            <Button onClick={() => setCreateOpen(true)} className="h-11 rounded-xl bg-[#0b438d] px-5 text-white hover:bg-[#082f68]">
              <Plus size={17} /> New PO
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-5">
          {[
            { label: 'Total', value: total },
            { label: 'Draft', value: rows.filter(r => r.status === 'draft').length },
            { label: 'Open', value: rows.filter(r => r.status === 'open').length },
            { label: 'Partially billed', value: rows.filter(r => r.status === 'partially_billed').length },
            { label: 'Billed', value: rows.filter(r => r.status === 'billed').length },
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
            <h2 className="font-semibold text-[#0b2346]">All purchase orders</h2>
            <div className="relative w-full sm:max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by PO number…" className="h-10 rounded-xl border-gray-200 bg-[#f7f9fc] pl-9" />
            </div>
          </div>

          {query.isLoading ? (
            <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin text-[#0b55ad]" /> Loading orders…</div>
          ) : query.isError ? (
            <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              <p>{msg(query.error)}</p>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void query.refetch()}>Try again</Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-gray-500">No purchase orders yet.</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f5f8fc]">
                    {['PO Number', 'Vendor', 'Warehouse', 'Date', 'Total', 'Status', 'Actions'].map(h => (
                      <TableHead key={h} className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#526783] ${h === 'Actions' ? 'text-right' : ''}`}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(order => (
                    <TableRow key={order._id} className="hover:bg-[#f8faff]">
                      <TableCell className="px-5 font-semibold text-[#0b2346]">{order.poNumber}</TableCell>
                      <TableCell className="text-sm text-gray-600">{order.purchaseVendorId?.displayName ?? '—'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{order.warehouseId?.name ?? '—'}</TableCell>
                      <TableCell className="text-sm text-gray-500">{order.poDate ? new Date(order.poDate).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="font-semibold text-[#0b2346]">₹{Number(order.total).toLocaleString()}</TableCell>
                      <TableCell>{statusBadge(order.status)}</TableCell>
                      <TableCell className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {order.status === 'draft' && (
                            <Button size="sm" className="rounded-lg bg-[#0b438d] text-white hover:bg-[#082f68]" disabled={busy === order._id} onClick={() => action(order, 'issue')}>
                              <CheckCircle size={13} /> Issue
                            </Button>
                          )}
                          {['open', 'partially_billed'].includes(order.status) && (
                            <Button size="sm" className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" disabled={busy === order._id} onClick={() => action(order, 'convert-to-bill')}>
                              Convert to Bill
                            </Button>
                          )}
                          {['draft', 'open'].includes(order.status) && (
                            <Button size="sm" variant="ghost" className="rounded-lg text-red-600 hover:bg-red-50" disabled={busy === order._id} onClick={() => action(order, 'cancel')}>
                              <XCircle size={13} /> Cancel
                            </Button>
                          )}
                          {busy === order._id && <LoaderCircle size={15} className="animate-spin text-[#0b55ad]" />}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                  <p className="text-xs text-gray-500">Page {page} of {totalPages} · {total} orders</p>
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
      {createOpen && <CreateOrderDialog onClose={() => setCreateOpen(false)} />}
    </AdminLayout>
  );
}

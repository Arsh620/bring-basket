'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, ArrowLeftRight, LoaderCircle, PackagePlus, Warehouse } from 'lucide-react';
import Link from 'next/link';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api/client';

type Choice = { _id: string; name: string; code?: string };
type StockRecord = { _id: string; itemId: Choice | string; qty: number; status?: string; variant?: string };

function messageFrom(error: unknown) {
  if (error instanceof AxiosError) return error.response?.data?.message || error.message;
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

function useOptions(endpoint: string) {
  return useQuery({
    queryKey: ['warehouse-stock-options', endpoint],
    queryFn: async () => {
      const { data } = await api.get(endpoint, { params: endpoint.endsWith('/items') ? { limit: 100 } : undefined });
      return (data.data ?? []) as Choice[];
    },
  });
}

export function WarehouseStockPage() {
  const queryClient = useQueryClient();
  const warehouses = useOptions('/admin/warehouses');
  const items = useOptions('/admin/items');
  const [warehouseId, setWarehouseId] = useState('');
  const [openingItemId, setOpeningItemId] = useState('');
  const [adjustItemId, setAdjustItemId] = useState('');
  const [openingQty, setOpeningQty] = useState('');
  const [adjustQty, setAdjustQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'set' | 'adjust' | null>(null);
  const [actionError, setActionError] = useState('');

  const stock = useQuery({
    queryKey: ['warehouse-stock', warehouseId],
    enabled: Boolean(warehouseId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/warehouses/${warehouseId}/stock`, { params: { page: 1, limit: 100 } });
      return { rows: (data.data ?? []) as StockRecord[], total: Number(data.pagination?.total ?? 0) };
    },
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseId] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
    ]);
  };

  const saveOpening = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy('set');
    setActionError('');
    try {
      await api.put(`/admin/warehouses/${warehouseId}/stock/${openingItemId}`, { qty: Number(openingQty) });
      await refresh();
      toast.success('Opening stock saved');
      setOpeningQty('');
    } catch (error) {
      setActionError(messageFrom(error));
    } finally {
      setBusy(null);
    }
  };

  const saveAdjustment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (Number(adjustQty) === 0) {
      setActionError('Enter an adjustment other than zero.');
      return;
    }
    setBusy('adjust');
    setActionError('');
    try {
      await api.patch(`/admin/warehouses/${warehouseId}/stock/${adjustItemId}/adjust`, { qtyChange: Number(adjustQty), note });
      await refresh();
      toast.success('Warehouse stock adjusted');
      setAdjustQty('');
      setNote('');
    } catch (error) {
      setActionError(messageFrom(error));
    } finally {
      setBusy(null);
    }
  };

  const selectClass = 'mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#0b55ad] focus:ring-4 focus:ring-[#0b55ad]/10';
  const chosenWarehouse = warehouses.data?.find((warehouse) => warehouse._id === warehouseId);
  const optionsError = warehouses.error ?? items.error;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <div>
          <Link href="/admin/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-[#0b55ad]"><ArrowLeft size={15} /> Dashboard</Link>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0b55ad]">Inventory operations</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0b2346]">Warehouse stock</h1>
          <p className="mt-1 text-sm text-gray-500">Set opening balances, make controlled adjustments and review item-level stock.</p>
        </div>

        <Card className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <Label htmlFor="stock-warehouse">Choose warehouse</Label>
              <select id="stock-warehouse" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className={selectClass}>
                <option value="">Select a warehouse to continue</option>
                {(warehouses.data ?? []).map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name} {warehouse.code ? `· ${warehouse.code}` : ''}</option>)}
              </select>
            </div>
            <div className="flex items-end rounded-xl border border-[#e4ebf5] bg-[#f4f7fc] px-4 py-3">
              <div className="flex items-center gap-3"><span className="rounded-lg bg-[#fff7b2] p-2 text-[#0b55ad]"><Warehouse size={18} /></span><div><p className="text-xs font-medium text-[#526783]">Selected location</p><p className="text-sm font-bold text-[#0b2346]">{chosenWarehouse?.name ?? 'No warehouse selected'}</p></div></div>
            </div>
          </CardContent>
        </Card>

        {actionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>}
        {optionsError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Could not load warehouse or product options: {messageFrom(optionsError)}</p>}

        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base text-[#0b2346]"><span className="rounded-lg bg-[#fff7b2] p-2 text-[#0b55ad]"><PackagePlus size={17} /></span> Set opening stock</CardTitle><p className="text-sm text-gray-500">Create or replace the current on-hand balance for an item.</p></CardHeader>
            <CardContent>
              <form onSubmit={saveOpening} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_130px_auto] sm:items-end">
                <div><Label htmlFor="opening-item">Product</Label><select id="opening-item" required value={openingItemId} onChange={(event) => setOpeningItemId(event.target.value)} className={selectClass}><option value="">Select product</option>{(items.data ?? []).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></div>
                <div><Label htmlFor="opening-qty">Quantity</Label><Input id="opening-qty" type="number" min="0" step="any" required value={openingQty} onChange={(event) => setOpeningQty(event.target.value)} className="mt-1.5 h-11 rounded-xl" /></div>
                <Button type="submit" disabled={!warehouseId || busy !== null || items.isLoading || Boolean(optionsError)} className="h-11 bg-[#0b438d] text-white hover:bg-[#082f68]">{busy === 'set' && <LoaderCircle size={15} className="animate-spin" />} Save balance</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base text-[#0b2346]"><span className="rounded-lg bg-[#eef4fc] p-2 text-[#0b55ad]"><ArrowLeftRight size={17} /></span> Adjust stock</CardTitle><p className="text-sm text-gray-500">Add stock with a positive amount or deduct using a negative amount.</p></CardHeader>
            <CardContent>
              <form onSubmit={saveAdjustment} className="grid gap-4 sm:grid-cols-2">
                <div><Label htmlFor="adjust-item">Product</Label><select id="adjust-item" required value={adjustItemId} onChange={(event) => setAdjustItemId(event.target.value)} className={selectClass}><option value="">Select product</option>{(items.data ?? []).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></div>
                <div><Label htmlFor="adjust-qty">Change in quantity</Label><Input id="adjust-qty" type="number" step="any" required value={adjustQty} onChange={(event) => setAdjustQty(event.target.value)} className="mt-1.5 h-11 rounded-xl" placeholder="+10 or -2" /></div>
                <div className="sm:col-span-2"><Label htmlFor="adjust-note">Reason / note</Label><Input id="adjust-note" value={note} onChange={(event) => setNote(event.target.value)} className="mt-1.5 h-11 rounded-xl" placeholder="e.g. cycle count correction" /></div>
                <div className="sm:col-span-2"><Button type="submit" disabled={!warehouseId || busy !== null || items.isLoading || Boolean(optionsError)} className="h-11 bg-[#0b438d] text-white hover:bg-[#082f68]">{busy === 'adjust' && <LoaderCircle size={15} className="animate-spin" />} Apply adjustment</Button></div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <div className="border-b border-[#e7edf5] bg-white px-5 py-4"><h2 className="font-semibold text-[#0b2346]">Current stock</h2><p className="mt-0.5 text-xs text-gray-500">{chosenWarehouse ? `Inventory stored at ${chosenWarehouse.name}.` : 'Choose a warehouse to view its inventory.'}</p></div>
          {!warehouseId ? <div className="px-6 py-14 text-center text-sm text-gray-500">Select a warehouse above to load its stock records.</div>
            : stock.isLoading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin text-[#0b55ad]" /> Loading stock…</div>
              : stock.isError ? <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-5"><p className="font-semibold text-red-800">Could not load stock.</p><p className="mt-1 text-sm text-red-700">{messageFrom(stock.error)}</p><Button variant="outline" className="mt-3" onClick={() => void stock.refetch()}>Try again</Button></div>
                : stock.data?.rows.length ? <Table><TableHeader><TableRow className="bg-[#f5f8fc]"><TableHead className="px-5 text-[#526783]">Product</TableHead><TableHead className="text-[#526783]">Variant</TableHead><TableHead className="text-[#526783]">Availability</TableHead><TableHead className="pr-5 text-right text-[#526783]">On hand</TableHead></TableRow></TableHeader><TableBody>{stock.data.rows.map((record) => <TableRow key={record._id} className="transition-colors hover:bg-[#f8faff]"><TableCell className="px-5 font-semibold text-[#0b2346]">{typeof record.itemId === 'object' ? record.itemId.name : record.itemId}</TableCell><TableCell className="text-gray-500">{record.variant || 'Standard'}</TableCell><TableCell><Badge className={record.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}>{record.status || 'active'}</Badge></TableCell><TableCell className="pr-5 text-right font-bold text-[#0b2346]">{record.qty.toLocaleString()}</TableCell></TableRow>)}</TableBody></Table> : <div className="px-6 py-14 text-center"><PackagePlus className="mx-auto mb-2 text-gray-300" size={26} /><p className="font-medium text-gray-700">No stock records yet</p><p className="mt-1 text-sm text-gray-500">Set an opening balance to create the first record.</p></div>}
          {warehouseId && stock.data && stock.data.total > stock.data.rows.length && <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">Showing {stock.data.rows.length} of {stock.data.total} stock records.</div>}
        </Card>
      </div>
    </AdminLayout>
  );
}

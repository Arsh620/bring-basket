'use client';

import { useContext, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { WarehouseContext } from '@/components/portal/warehouse-context';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import warehouseApi from '@/lib/api/warehouse';

type Product = { _id: string; name?: string; sku?: string };
type Movement = {
  _id: string;
  itemId?: Product | null;
  storeId?: { name?: string } | null;
  type: string;
  qtyChange: number;
  balanceAfter?: number;
  referenceNo?: string;
  movedAt: string;
};
type HistoryResult = {
  data: Movement[];
  pagination: { total: number; pages: number };
};

const filters = [
  { value: '', label: 'All movements' },
  { value: 'store_dispatch', label: 'Store dispatch' },
  { value: 'transfer_out', label: 'Transfer out' },
  { value: 'transfer_in', label: 'Transfer in' },
  { value: 'order_placed', label: 'Order placed' },
  { value: 'order_canceled', label: 'Order canceled' },
  { value: 'write_off', label: 'Write-off' },
] as const;
const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

export default function WarehouseHistoryPage() {
  const warehouse = useContext(WarehouseContext);
  const [movementType, setMovementType] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const movementsQuery = useQuery({
    queryKey: ['warehouse-stock-history', warehouse?._id, movementType, product?._id, page],
    enabled: Boolean(warehouse?._id),
    queryFn: async () => (await warehouseApi.get<HistoryResult>('/warehouse/stock-movements', {
      params: { type: movementType || undefined, itemId: product?._id, page, limit: 25 },
    })).data,
  });

  const movements = movementsQuery.data?.data ?? [];
  const pages = Math.max(1, movementsQuery.data?.pagination.pages ?? 1);

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <header className="flex items-start gap-3">
        <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><History size={20} aria-hidden="true" /></span>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock history</h1>
          <p className="mt-1 text-sm text-slate-600">Follow quantity changes and open the history for an individual product.</p>
        </div>
      </header>
      <div className="rounded-xl border bg-white p-4 sm:flex sm:items-end sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="movement-type">Movement type</Label>
          <select id="movement-type" value={movementType} onChange={(event) => {
            setMovementType(event.target.value);
            setPage(1);
          }} className="block min-h-10 w-full rounded-lg border px-3 text-sm sm:w-56">
            {filters.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {product && <Button type="button" variant="outline" className="mt-3 sm:mt-0" onClick={() => {
          setProduct(null);
          setPage(1);
        }}>Clear product filter: {product.name || product.sku || 'Product'}</Button>}
      </div>
      <div className="rounded-xl border bg-white">
        {movementsQuery.isPending && <p role="status" className="p-5 text-sm text-slate-600">Loading stock history…</p>}
        {movementsQuery.isError && <div role="alert" className="flex flex-wrap items-center gap-3 p-5 text-sm text-red-700">
          Could not load stock history.
          <Button type="button" variant="outline" onClick={() => void movementsQuery.refetch()}>Try again</Button>
        </div>}
        {movementsQuery.isSuccess && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date (IST)</TableHead><TableHead>Product</TableHead><TableHead>Movement</TableHead>
                  <TableHead>Reference</TableHead><TableHead className="text-right">Change</TableHead><TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 && <TableRow><TableCell colSpan={6} className="p-5 text-center text-slate-600">No matching stock movements.</TableCell></TableRow>}
                {movements.map((movement) => {
                  const item = movement.itemId;
                  const date = new Date(movement.movedAt);
                  return (
                    <TableRow key={movement._id}>
                      <TableCell>{Number.isNaN(date.getTime()) ? '—' : dateTime.format(date)}</TableCell>
                      <TableCell>
                        {item ? <button type="button" className="font-medium text-[#0b438d] underline-offset-2 hover:underline" onClick={() => {
                          setProduct(item);
                          setPage(1);
                        }}>{item.name || item.sku || 'Product'}</button> : '—'}
                      </TableCell>
                      <TableCell className="capitalize">{movement.type.replaceAll('_', ' ')}</TableCell>
                      <TableCell>{[movement.referenceNo, movement.storeId?.name].filter(Boolean).join(' · ') || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{movement.qtyChange > 0 ? '+' : ''}{movement.qtyChange}</TableCell>
                      <TableCell className="text-right tabular-nums">{movement.balanceAfter ?? '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-slate-600">
              <p>Page {page} of {pages} · {movementsQuery.data.pagination.total} movements</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                <Button type="button" variant="outline" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</Button>
              </div>
            </footer>
          </>
        )}
      </div>
    </section>
  );
}

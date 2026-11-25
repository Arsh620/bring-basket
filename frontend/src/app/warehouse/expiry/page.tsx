'use client';

import { useContext, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { WarehouseContext } from '@/components/portal/warehouse-context';
import warehouseApi from '@/lib/api/warehouse';

type Batch = { _id: string; itemId?: { name?: string }; batchNumber?: string; expiryDate: string; quantity: number };

export default function WarehouseExpiryPage() {
  const [tab, setTab] = useState<'near' | 'expired'>('near');
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState(false);
  const profile = useContext(WarehouseContext);
  const queryClient = useQueryClient();
  const queryKey = ['warehouse-expiry', profile?._id];
  const canWriteOff = profile?.type === 'mother';
  const columnCount = canWriteOff ? 5 : 4;
  const batchesQuery = useQuery({
    queryKey: [...queryKey, tab, tab === 'near' ? days : null],
    enabled: Boolean(profile?._id),
    queryFn: async () => (await warehouseApi.get<{ data: Batch[] }>(`/warehouse/expiry/${tab}`, {
      params: tab === 'near' ? { days } : undefined,
    })).data.data,
  });
  const batches = batchesQuery.data ?? [];

  const writeOff = async (id: string) => {
    if (!confirm('Write off this batch?')) return;
    setBusy(id);
    setActionError(false);
    try {
      await warehouseApi.post(`/warehouse/expiry/write-off/${id}`, { note: 'Manual write-off' });
      await queryClient.invalidateQueries({ queryKey });
    } catch {
      setActionError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle size={22} className="text-orange-500" />
        <h1 className="text-xl font-bold">Expiry Management</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {(['near', 'expired'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${tab === t ? 'bg-[#08234b] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {t === 'near' ? 'Near Expiry' : 'Expired'}
            </button>
          ))}
        </div>
        {tab === 'near' && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Within</span>
            <input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} min={1} max={365}
              className="w-16 rounded-lg border px-2 py-1 text-sm outline-none" />
            <span>days</span>
          </div>
        )}
      </div>

      {actionError && <p role="alert" className="text-sm text-red-700">The batch could not be written off.</p>}
      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-left">Batch</th>
              <th className="px-4 py-3 text-left">Expiry Date</th>
              <th className="px-4 py-3 text-right">Qty</th>
              {canWriteOff && <th scope="col" className="px-4 py-3 text-left">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {batchesQuery.isPending && <tr><td colSpan={columnCount} className="px-4 py-8 text-center text-slate-600">Loading batches…</td></tr>}
            {batchesQuery.isError && <tr><td colSpan={columnCount} className="px-4 py-8 text-center text-red-700">
              Could not load batches. <button type="button" className="underline" onClick={() => void batchesQuery.refetch()}>Try again</button>
            </td></tr>}
            {batchesQuery.isSuccess && batches.length === 0 && <tr><td colSpan={columnCount} className="px-4 py-8 text-center text-slate-600">No batches found.</td></tr>}
            {batches.map((b) => (
              <tr key={b._id}>
                <td className="px-4 py-3 font-medium">{b.itemId?.name || '—'}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{b.batchNumber || '—'}</td>
                <td className="px-4 py-3 text-orange-600 font-medium">{new Date(b.expiryDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">{b.quantity}</td>
                {canWriteOff && <td className="px-4 py-3">
                  <button type="button" disabled={busy !== null} onClick={() => void writeOff(b._id)} className="text-xs text-red-700 hover:underline disabled:opacity-60">
                    {busy === b._id ? 'Saving…' : 'Write off'}
                  </button>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

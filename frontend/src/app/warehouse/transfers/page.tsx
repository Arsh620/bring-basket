'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import warehouseApi from '@/lib/api/warehouse';

type Transfer = { _id: string; fromWarehouseId?: { name?: string }; toWarehouseId?: { name?: string }; status: string; createdAt: string; items?: { quantity: number }[] };

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  dispatched: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  canceled: 'bg-slate-100 text-slate-500',
};

export default function WarehouseTransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    warehouseApi.get('/warehouse/stock-transfers')
      .then((r) => setTransfers(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const action = async (id: string, act: 'dispatch' | 'receive' | 'reject' | 'cancel') => {
    await warehouseApi.post(`/warehouse/stock-transfers/${id}/${act}`, {}).catch(() => {});
    load();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <ArrowLeftRight size={22} />
        <h1 className="text-xl font-bold">Stock Transfers</h1>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">From</th>
              <th className="px-4 py-3 text-left">To</th>
              <th className="px-4 py-3 text-right">Items</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>}
            {!loading && transfers.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No transfers yet.</td></tr>}
            {transfers.map((t) => (
              <tr key={t._id}>
                <td className="px-4 py-3 font-medium">{t.fromWarehouseId?.name || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{t.toWarehouseId?.name || '—'}</td>
                <td className="px-4 py-3 text-right">{t.items?.length ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status] ?? 'bg-slate-100 text-slate-500'}`}>{t.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {t.status === 'pending' && <button onClick={() => action(t._id, 'dispatch')} className="text-xs text-blue-600 hover:underline">Dispatch</button>}
                    {t.status === 'dispatched' && <button onClick={() => action(t._id, 'receive')} className="text-xs text-green-600 hover:underline">Receive</button>}
                    {t.status === 'dispatched' && <button onClick={() => action(t._id, 'reject')} className="text-xs text-red-500 hover:underline">Reject</button>}
                    {t.status === 'pending' && <button onClick={() => action(t._id, 'cancel')} className="text-xs text-slate-500 hover:underline">Cancel</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

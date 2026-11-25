'use client';

import { useEffect, useState } from 'react';
import { Inbox } from 'lucide-react';
import warehouseApi from '@/lib/api/warehouse';

type Request = { _id: string; storeId?: { name?: string }; itemId?: { name?: string }; requestedQty: number; status: string; createdAt: string };

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-700',
  dispatched: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  canceled: 'bg-slate-100 text-slate-500',
  rejected: 'bg-red-100 text-red-700',
};

export default function WarehouseRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    warehouseApi.get('/warehouse/store-stock-requests')
      .then((r) => setRequests(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const dispatch = async (id: string) => {
    await warehouseApi.post(`/warehouse/store-stock-requests/${id}/dispatch`, {}).catch(() => {});
    load();
  };

  const reject = async (id: string) => {
    await warehouseApi.post(`/warehouse/store-stock-requests/${id}/reject`, {}).catch(() => {});
    load();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Inbox size={22} />
        <h1 className="text-xl font-bold">Store Stock Requests</h1>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Store</th>
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>}
            {!loading && requests.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No requests yet.</td></tr>}
            {requests.map((r) => (
              <tr key={r._id}>
                <td className="px-4 py-3 font-medium">{r.storeId?.name || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{r.itemId?.name || '—'}</td>
                <td className="px-4 py-3 text-right">{r.requestedQty}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? 'bg-slate-100 text-slate-500'}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {r.status === 'requested' && <button onClick={() => dispatch(r._id)} className="text-xs text-blue-600 hover:underline">Dispatch</button>}
                    {r.status === 'requested' && <button onClick={() => reject(r._id)} className="text-xs text-red-500 hover:underline">Reject</button>}
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

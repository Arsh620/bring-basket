'use client';

import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import vendorApi from '@/lib/api/vendor';

type Request = { _id: string; itemId?: { name?: string }; requestedQty: number; status: string; createdAt: string; warehouseId?: { name?: string } };

export default function VendorStoreStockRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [form, setForm] = useState({ itemId: '', requestedQty: 1, note: '' });
  const [creating, setCreating] = useState(false);

  const load = () => {
    vendorApi.get('/vendor/store-stock-requests').then((r) => setRequests(r.data.data || [])).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setCreating(true);
    try {
      await vendorApi.post('/vendor/store-stock-requests', form);
      setForm({ itemId: '', requestedQty: 1, note: '' });
      load();
    } catch { /* ignore */ }
    finally { setCreating(false); }
  };

  const receive = async (id: string) => {
    await vendorApi.post(`/vendor/store-stock-requests/${id}/receive`, {});
    load();
  };

  const cancel = async (id: string) => {
    await vendorApi.post(`/vendor/store-stock-requests/${id}/cancel`, {});
    load();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Package size={22} />
        <h1 className="text-xl font-bold">Store Stock Requests</h1>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3 max-w-md">
        <h2 className="font-semibold text-slate-800">New Request</h2>
        <input value={form.itemId} onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))}
          placeholder="Item ID" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" />
        <input type="number" value={form.requestedQty} onChange={(e) => setForm((f) => ({ ...f, requestedQty: Number(e.target.value) }))}
          placeholder="Quantity" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" />
        <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          placeholder="Note (optional)" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" />
        <button onClick={create} disabled={creating || !form.itemId}
          className="rounded-xl bg-[#08234b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {creating ? 'Creating...' : 'Create Request'}
        </button>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr><th className="px-4 py-3 text-left">Item</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-left">Warehouse</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No requests yet.</td></tr>}
            {requests.map((r) => (
              <tr key={r._id}>
                <td className="px-4 py-3 font-medium">{r.itemId?.name || r._id.slice(-6)}</td>
                <td className="px-4 py-3 text-right">{r.requestedQty}</td>
                <td className="px-4 py-3 text-slate-600">{r.warehouseId?.name || '—'}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'dispatched' ? 'bg-green-100 text-green-700' : r.status === 'requested' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>{r.status}</span></td>
                <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {r.status === 'dispatched' && <button onClick={() => receive(r._id)} className="text-xs text-green-600 hover:underline">Receive</button>}
                    {r.status === 'requested' && <button onClick={() => cancel(r._id)} className="text-xs text-red-500 hover:underline">Cancel</button>}
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

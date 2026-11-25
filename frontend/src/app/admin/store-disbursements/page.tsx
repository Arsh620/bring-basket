'use client';

import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import api from '@/lib/api/client';

type Disbursement = { _id: string; totalAmount: number; status: string; createdAt: string; storeCount?: number };

export default function StoreDisbursementsPage() {
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = () => {
    api.get('/admin/store-disbursements').then((r) => setDisbursements(r.data.data || [])).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      await api.post('/admin/store-disbursements/generate', {});
      load();
    } catch { /* ignore */ }
    finally { setGenerating(false); }
  };

  return (
    <AdminLayout>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard size={22} className="text-[#08234b]" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Store Disbursements</h1>
            <p className="text-sm text-slate-500">Vendor payout batches</p>
          </div>
        </div>
        <button onClick={generate} disabled={generating}
          className="rounded-xl bg-[#08234b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a2d5e] disabled:opacity-50">
          {generating ? 'Generating...' : 'Generate Disbursement'}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-right">Total Amount</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {disbursements.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No disbursements yet.</td></tr>}
            {disbursements.map((d) => (
              <tr key={d._id}>
                <td className="px-4 py-3 text-slate-700">{new Date(d.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right font-medium">₹{d.totalAmount}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.status === 'completed' ? 'bg-green-100 text-green-700' : d.status === 'canceled' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>{d.status}</span></td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => api.get(`/admin/store-disbursements/${d._id}/details`).then((r) => alert(JSON.stringify(r.data.data, null, 2)))}
                    className="text-xs text-blue-600 hover:underline">View Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </AdminLayout>
  );
}

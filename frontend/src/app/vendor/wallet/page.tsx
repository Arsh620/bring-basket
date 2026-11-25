'use client';

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import vendorApi from '@/lib/api/vendor';

type WalletData = { totalEarning: number; pendingWithdraw: number; totalWithdrawn: number; collectedCash: number };
type WithdrawRequest = { _id: string; amount: number; method: string; status: string; createdAt: string };

export default function VendorWalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [methods, setMethods] = useState<{ _id: string; name: string }[]>([]);
  const [form, setForm] = useState({ amount: '', methodId: '', note: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    vendorApi.get('/vendor/wallet').then((r) => setWallet(r.data.data)).catch(() => {});
    vendorApi.get('/vendor/withdraw-requests').then((r) => setRequests(r.data.data || [])).catch(() => {});
    vendorApi.get('/vendor/withdrawal-methods').then((r) => setMethods(r.data.data || [])).catch(() => {});
  }, []);

  const submit = async () => {
    setSubmitting(true);
    try {
      await vendorApi.post('/vendor/withdraw-requests', form);
      setForm({ amount: '', methodId: '', note: '' });
      vendorApi.get('/vendor/withdraw-requests').then((r) => setRequests(r.data.data || []));
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Wallet size={22} />
        <h1 className="text-xl font-bold">Wallet & Withdrawals</h1>
      </div>

      {wallet && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Earning', value: wallet.totalEarning },
            { label: 'Pending Withdraw', value: wallet.pendingWithdraw },
            { label: 'Total Withdrawn', value: wallet.totalWithdrawn },
            { label: 'Collected Cash', value: wallet.collectedCash },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border bg-white p-5 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">₹{s.value}</p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3 max-w-md">
        <h2 className="font-semibold text-slate-800">Request Withdrawal</h2>
        <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          placeholder="Amount" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" />
        <select value={form.methodId} onChange={(e) => setForm((f) => ({ ...f, methodId: e.target.value }))}
          className="w-full rounded-lg border px-3 py-2 text-sm">
          <option value="">Select withdrawal method</option>
          {methods.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
        </select>
        <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          placeholder="Note (optional)" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" />
        <button onClick={submit} disabled={submitting || !form.amount || !form.methodId}
          className="rounded-xl bg-[#08234b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b px-4 py-3 text-sm font-semibold text-slate-700">Withdrawal History</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Method</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Date</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No requests yet.</td></tr>}
            {requests.map((r) => (
              <tr key={r._id}>
                <td className="px-4 py-3 text-right font-medium">₹{r.amount}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{r.method}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'approved' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>{r.status}</span></td>
                <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

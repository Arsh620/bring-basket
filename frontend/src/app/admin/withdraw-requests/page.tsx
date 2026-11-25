'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wallet, LoaderCircle } from 'lucide-react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import api from '@/lib/api/client';

type WithdrawRequest = {
  _id: string;
  vendorId?: { fName?: string; lName?: string };
  amount: number;
  withdrawalMethodId?: { methodName?: string } | null;
  approved: number;
  transactionNote?: string;
  createdAt: string;
};

const statusLabel = (approved: number) => {
  if (approved === 1) return { label: 'Approved', className: 'bg-green-100 text-green-700' };
  if (approved === 2) return { label: 'Rejected', className: 'bg-red-100 text-red-600' };
  return { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' };
};

function WithdrawRequestsContent() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'0' | '1' | '2'>('0');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-withdraw-requests', filter],
    queryFn: async () => {
      const res = await api.get('/admin/withdraw-requests', { params: { approved: filter } });
      return (res.data.data ?? []) as WithdrawRequest[];
    },
  });

  const handle = async (id: string, action: 'approved' | 'rejected') => {
    setBusyId(id);
    try {
      await api.patch(`/admin/withdraw-requests/${id}/approve`, { status: action });
      toast.success(`Request ${action}`);
      await queryClient.invalidateQueries({ queryKey: ['admin-withdraw-requests'] });
    } catch {
      toast.error('Could not update this request.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Wallet size={22} className="text-[#08234b]" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Withdraw Requests</h1>
            <p className="text-sm text-slate-500">Vendor wallet withdrawal requests</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as '0' | '1' | '2')}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="0">Pending</option>
            <option value="1">Approved</option>
            <option value="2">Rejected</option>
          </select>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isLoading}>
            {isLoading ? <LoaderCircle size={14} className="animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </div>

      {isError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load withdrawal requests.
          <Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => void refetch()}>Retry</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Vendor</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Method</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
            )}
            {!isLoading && (!data || data.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No requests found.</td></tr>
            )}
            {data?.map((r) => {
              const st = statusLabel(r.approved);
              const methodName = r.withdrawalMethodId && typeof r.withdrawalMethodId === 'object'
                ? r.withdrawalMethodId.methodName
                : String(r.withdrawalMethodId ?? '—');
              return (
                <tr key={r._id}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {r.vendorId?.fName ?? '—'} {r.vendorId?.lName ?? ''}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">₹{r.amount.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{methodName || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.className}`}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    {r.approved === 0 && (
                      <div className="flex gap-2">
                        <button
                          disabled={busyId === r._id}
                          onClick={() => void handle(r._id, 'approved')}
                          className="rounded-lg bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          disabled={busyId === r._id}
                          onClick={() => void handle(r._id, 'rejected')}
                          className="rounded-lg bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function WithdrawRequestsPage() {
  return (
    <AdminLayout>
      <WithdrawRequestsContent />
    </AdminLayout>
  );
}

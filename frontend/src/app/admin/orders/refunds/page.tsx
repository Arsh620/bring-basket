'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import api from '@/lib/api/client';

const reviewStatuses = ['pending', 'approved', 'rejected'] as const;
type Status = typeof reviewStatuses[number];
type Refund = {
  _id: string; orderNumber: string; storeName: string; paymentMethod: string;
  refundAmount?: number; refundReason: string; refundReviewNote?: string; refundMethod?: string;
};
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

export default function RefundRequestsPage() {
  return <AdminLayout><RefundRequests /></AdminLayout>;
}

function RefundRequests() {
  const [status, setStatus] = useState<Status>('pending');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin-refunds', status, page],
    queryFn: async () => (await api.get<{ data: Refund[]; pagination: { pages: number } }>('/admin/orders/refunds', {
      params: { status, page, limit: 20 },
    })).data,
  });
  const lastPage = Math.max(1, query.data?.pagination.pages ?? 1);

  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Refund requests</h1>
      <div className="flex flex-wrap gap-2" aria-label="Filter by refund status">
        {reviewStatuses.map((value) => <Button type="button" key={value} variant={value === status ? 'default' : 'outline'}
          aria-pressed={value === status} className="capitalize" onClick={() => { setStatus(value); setPage(1); }}>{value}</Button>)}
      </div>
      {query.isPending && <p role="status" className="text-sm text-slate-600">Loading refund requests…</p>}
      {query.isError && <p role="alert" className="text-sm text-red-700">
        Could not load refund requests. <button type="button" className="underline" onClick={() => void query.refetch()}>Try again</button>
      </p>}
      {query.isSuccess && (
        <>
          {query.data.data.length === 0 && <p className="rounded-xl border bg-white p-5 text-sm text-slate-600">No {status} refund requests.</p>}
          {query.data.data.map((refund) => <RefundCard key={refund._id} refund={refund} status={status} />)}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Page {page} of {lastPage}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button type="button" variant="outline" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function RefundCard({ refund, status }: { refund: Refund; status: Status }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canCredit = refund.paymentMethod === 'wallet' && (refund.refundAmount ?? 0) > 0;
  const submit = async (action: 'approved' | 'rejected') => {
    if (!window.confirm(action === 'approved' ? 'Return the displayed amount to the customer’s wallet?' : 'Reject this refund request?')) return;
    setBusy(true);
    setError('');
    try {
      await api.patch(`/admin/orders/${encodeURIComponent(refund._id)}/refund`, { action, note });
      await queryClient.invalidateQueries({ queryKey: ['admin-refunds'] });
    } catch (failure) {
      setError(isAxiosError<{ message?: string }>(failure)
        ? failure.response?.data?.message || 'Could not save the decision.'
        : 'Could not save the decision.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="space-y-3 rounded-xl border bg-white p-4 sm:p-5">
      <div className="flex flex-wrap justify-between gap-2">
        <div><h2 className="font-semibold">{refund.orderNumber}</h2><p className="text-sm text-slate-600">{refund.storeName}</p></div>
        <div className="text-sm">
          <p className="font-semibold">{refund.refundAmount == null ? 'Amount unverified' : currency.format(refund.refundAmount)}</p>
          <p className="capitalize text-slate-600">{refund.paymentMethod.replaceAll('_', ' ')}</p>
        </div>
      </div>
      <p className="text-sm text-slate-700">{refund.refundReason}</p>
      {refund.refundReviewNote && <p className="text-sm text-slate-600">{refund.refundReviewNote}</p>}
      {status === 'pending' && (
        <div className="space-y-2">
          {!canCredit && <p className="text-sm text-slate-600">Automatic settlement requires a verified wallet payment.</p>}
          <Label htmlFor={`refund-note-${refund._id}`}>Note to the customer (optional)</Label>
          <textarea id={`refund-note-${refund._id}`} value={note} onChange={(event) => setNote(event.target.value)}
            maxLength={500} className="block w-full rounded-lg border px-3 py-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy || !canCredit} onClick={() => void submit('approved')}>Approve wallet credit</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void submit('rejected')}>Reject request</Button>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>
      )}
    </article>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import api from '@/lib/api/client';

const nextStatus: Record<string, string> = {
  pending: 'confirmed', accepted: 'processing', confirmed: 'processing',
  processing: 'handover', handover: 'picked_up', picked_up: 'delivered',
};

export function OrderDispatchActions({ order }: {
  order: { _id: string; orderStatus: string; orderType: string; deliverymanId?: string | null };
}) {
  const queryClient = useQueryClient();
  const [driver, setDriver] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const delivery = order.orderType === 'delivery';
  const canAssign = delivery && ['pending', 'accepted', 'confirmed', 'processing', 'handover'].includes(order.orderStatus);
  const next = nextStatus[order.orderStatus];
  const endpoint = `/admin/orders/${encodeURIComponent(order._id)}`;
  const candidates = useQuery({
    queryKey: ['order-dispatch-drivers', order._id],
    queryFn: async () => (await api.get<{ data: { _id: string; name: string }[] }>(`${endpoint}/deliverymen`)).data.data,
    enabled: canAssign,
  });

  const change = async (action: 'assign-dm' | 'status', body: Record<string, string>) => {
    setBusy(true);
    setError('');
    try {
      await api.patch(`${endpoint}/${action}`, body);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-order', order._id] }),
        queryClient.invalidateQueries({ queryKey: ['order-dispatch-drivers', order._id] }),
      ]);
      setDriver('');
    } catch (failure) {
      setError(isAxiosError<{ message?: string }>(failure)
        ? failure.response?.data?.message || 'Could not update this order.'
        : 'Could not update this order.');
    } finally {
      setBusy(false);
    }
  };

  if (!canAssign && !next) return null;

  return (
    <section className="space-y-3 rounded-xl border bg-white p-4">
      <h3 className="font-semibold text-slate-900">{delivery ? 'Dispatch' : 'Fulfillment'}</h3>
      {order.deliverymanId && <p className="text-sm text-slate-600">
        Assigned: {candidates.data?.find(({ _id }) => _id === order.deliverymanId)?.name || 'Delivery person assigned'}
      </p>}
      {canAssign && (
        <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); if (driver) void change('assign-dm', { deliverymanId: driver }); }}>
          <Label htmlFor="order-driver">Delivery person</Label>
          <div className="flex flex-wrap gap-2">
            <select id="order-driver" required value={driver} onChange={(event) => setDriver(event.target.value)}
              disabled={!candidates.data?.length || busy} className="min-h-9 flex-1 rounded-lg border px-2 text-sm">
              <option value="">Choose an eligible delivery person</option>
              {(candidates.data ?? []).map(({ _id, name }) => <option key={_id} value={_id}>{name}</option>)}
            </select>
            <Button type="submit" disabled={!driver || busy}>Assign</Button>
          </div>
          {candidates.isPending && <p role="status" className="text-sm text-slate-600">Loading delivery people…</p>}
          {candidates.isError && <p role="alert" className="text-sm text-red-700">
            Could not load the list. <button type="button" className="underline" onClick={() => void candidates.refetch()}>Try again</button>
          </p>}
          {candidates.isSuccess && candidates.data.length === 0 && <p className="text-sm text-slate-600">No eligible delivery people for this order.</p>}
        </form>
      )}
      {next && <Button type="button" variant="outline" disabled={busy || (delivery && next === 'picked_up' && !order.deliverymanId)}
        onClick={() => void change('status', { status: next })} className="capitalize">Mark as {next.replaceAll('_', ' ')}</Button>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}

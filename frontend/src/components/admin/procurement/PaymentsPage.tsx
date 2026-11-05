'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { ArrowLeft, LoaderCircle, Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api/client';
import { PaymentDialog } from './PaymentDialog';

type Vendor = { _id: string; displayName: string };
type Payment = {
  _id: string;
  paymentDate: string;
  amount: number;
  mode: string;
  reference?: string;
  purchaseVendorId: Vendor | null;
  purchaseBillId: { _id: string; billNumber: number } | null;
};

function msg(error: unknown) {
  if (error instanceof AxiosError) return error.response?.data?.message || error.message;
  return error instanceof Error ? error.message : 'Request failed';
}

export function ProcurementPaymentsPage() {
  const queryClient = useQueryClient();
  const [vendorId, setVendorId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const vendors = useQuery({
    queryKey: ['payment-vendors'],
    queryFn: async () => {
      const { data } = await api.get('/admin/purchases/vendors', {
        params: { page: 1, limit: 100, approval: 'approved', status: 'true' },
      });
      return (data.data ?? []) as Vendor[];
    },
  });
  const payments = useQuery({
    queryKey: ['procurement-payments', page, vendorId, from, to],
    queryFn: async () => {
      const { data } = await api.get('/admin/purchases/payments', {
        params: {
          page,
          limit: 20,
          purchaseVendorId: vendorId || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });
      return { rows: data.data as Payment[], pagination: data.pagination };
    },
  });
  const rows = payments.data?.rows ?? [];
  const pagination = payments.data?.pagination;

  const remove = async (payment: Payment) => {
    if (!window.confirm(`Delete this ₹${Number(payment.amount).toFixed(2)} payment? The linked bill balance will be recalculated.`)) return;
    setBusy(payment._id);
    try {
      await api.delete(`/admin/purchases/payments/${payment._id}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['procurement-payments'] }),
        queryClient.invalidateQueries({ queryKey: ['procurement-bills'] }),
        queryClient.invalidateQueries({ queryKey: ['procurement-bill'] }),
      ]);
      toast.success('Payment deleted and bill balance recalculated');
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setBusy(null);
    }
  };

  const onSaved = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['procurement-payments'] }),
      queryClient.invalidateQueries({ queryKey: ['procurement-bills'] }),
      queryClient.invalidateQueries({ queryKey: ['procurement-bill'] }),
    ]);
    toast.success('Payment recorded');
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#0b55ad]"><ArrowLeft size={15} /> Dashboard</Link>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0b55ad]">Procurement</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0b2346]">Purchase Payments</h1>
            <p className="mt-1 text-sm text-gray-500">Record vendor payments and track bill settlement.</p>
          </div>
          <Button onClick={() => setRecording(true)} className="h-11 rounded-xl bg-[#0b438d] px-5 text-white hover:bg-[#082f68]">
            <Plus size={17} /> Record payment
          </Button>
        </div>

        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#e7edf5] bg-white px-5 py-4">
            <h2 className="mr-auto font-semibold text-[#0b2346]">Payment history</h2>
            <select
              aria-label="Filter by vendor"
              value={vendorId}
              onChange={event => { setVendorId(event.target.value); setPage(1); }}
              disabled={vendors.isLoading || vendors.isError}
              className="h-10 min-w-48 rounded-xl border border-gray-200 bg-[#f7f9fc] px-3 text-sm"
            >
              <option value="">All vendors</option>
              {(vendors.data ?? []).map(vendor => <option key={vendor._id} value={vendor._id}>{vendor.displayName}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <Input aria-label="Payment from date" type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} className="h-10 w-36 rounded-xl" />
              <Input aria-label="Payment to date" type="date" value={to} onChange={event => { setTo(event.target.value); setPage(1); }} className="h-10 w-36 rounded-xl" />
            </div>
          </div>
          {vendors.isError && <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{msg(vendors.error)}</div>}
          {payments.isLoading ? (
            <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin text-[#0b55ad]" /> Loading payments…</div>
          ) : payments.isError ? (
            <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{msg(payments.error)}</div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Search className="mx-auto mb-2 text-gray-300" size={27} />
              <p className="font-medium text-gray-700">No payments found</p>
              <p className="mt-1 text-sm text-gray-500">Record a vendor payment to see it here.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader><TableRow className="bg-[#f5f8fc]">
                  {['Date', 'Vendor', 'Bill', 'Mode', 'Reference', 'Amount', 'Action'].map(label => (
                    <TableHead key={label} className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#526783] ${label === 'Action' ? 'text-right' : ''}`}>{label}</TableHead>
                  ))}
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map(payment => (
                    <TableRow key={payment._id} className="hover:bg-[#f8faff]">
                      <TableCell className="px-5 text-sm text-gray-600">{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium text-[#0b2346]">{payment.purchaseVendorId?.displayName ?? '—'}</TableCell>
                      <TableCell>
                        {payment.purchaseBillId ? (
                          <Link href="/admin/procurement/bills" className="text-sm font-medium text-[#0b55ad] hover:underline">
                            #{String(payment.purchaseBillId.billNumber).padStart(5, '0')}
                          </Link>
                        ) : <Badge variant="outline">Unallocated</Badge>}
                      </TableCell>
                      <TableCell className="text-sm capitalize text-gray-600">{payment.mode.replace('_', ' ')}</TableCell>
                      <TableCell className="text-sm text-gray-600">{payment.reference || '—'}</TableCell>
                      <TableCell className="font-semibold text-[#0b2346]">₹{Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="px-5 text-right">
                        <Button type="button" size="icon" variant="ghost" aria-label="Delete payment" disabled={busy === payment._id} onClick={() => void remove(payment)} className="text-red-600 hover:bg-red-50">
                          {busy === payment._id ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pagination?.pages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                  <p className="text-xs text-gray-500">Page {pagination.page} of {pagination.pages} · {pagination.total} payments</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={page >= pagination.pages} onClick={() => setPage(current => current + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
      {recording && <PaymentDialog onClose={() => setRecording(false)} onSaved={onSaved} />}
    </AdminLayout>
  );
}

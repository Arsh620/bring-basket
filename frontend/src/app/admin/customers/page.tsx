'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, Search, ArrowLeft, ArrowRight, Wallet, Star, X, LoaderCircle } from 'lucide-react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api/client';

interface Customer {
  _id: string;
  fName: string;
  lName?: string;
  email: string;
  phone?: string;
  walletBalance?: number;
  loyaltyPoint?: number;
  status: boolean;
}

interface ActionModal {
  type: 'wallet' | 'loyalty';
  customer: Customer;
}

const INR = (v: unknown) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function ActionDialog({ modal, onClose }: { modal: ActionModal; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const isWallet = modal.type === 'wallet';
  const title = isWallet ? 'Add Wallet Fund' : 'Adjust Loyalty Points';
  const label = isWallet ? 'Amount (₹)' : 'Points';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      if (isWallet) {
        await api.post(`/admin/customers/${modal.customer._id}/wallet/add-fund`, { amount: Number(amount), note });
      } else {
        await api.post(`/admin/customers/${modal.customer._id}/loyalty/adjust`, { points: Number(amount), note });
      }
      await qc.invalidateQueries({ queryKey: ['admin-customers'] });
      toast.success(`${isWallet ? 'Wallet funded' : 'Loyalty points adjusted'} successfully`);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0b55ad]">{modal.customer.fName} {modal.customer.lName}</p>
            <h3 className="mt-1 text-xl font-bold text-[#0b2346]">{title}</h3>
          </div>
          <Button type="button" variant="ghost" size="icon" disabled={saving} onClick={onClose}><X size={18} /></Button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          <div>
            <Label htmlFor="action-amount">{label}</Label>
            <Input id="action-amount" type="number" min="1" step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5 h-11 rounded-xl" placeholder={isWallet ? '100' : '50'} />
          </div>
          <div>
            <Label htmlFor="action-note">Note (optional)</Label>
            <Input id="action-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5 h-11 rounded-xl" placeholder="Reason for adjustment" />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-[#0b438d] text-white hover:bg-[#082f68]">
              {saving && <LoaderCircle size={15} className="animate-spin" />}
              {isWallet ? 'Add Fund' : 'Adjust Points'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ActionModal | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-customers', page, search],
    queryFn: async () => {
      const res = await api.get('/admin/customers', { params: { page, limit: 20, ...(search ? { search } : {}) } });
      return res.data;
    },
  });

  const customers: Customer[] = data?.data ?? [];
  const total: number = data?.pagination?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));

  const toggleStatus = async (c: Customer) => {
    setBusyId(c._id);
    try {
      await api.patch(`/admin/customers/${c._id}/status`, { status: !c.status });
      await qc.invalidateQueries({ queryKey: ['admin-customers'] });
      toast.success('Customer status updated');
    } catch {
      toast.error('Could not update status');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0755b8]"><Users size={16} /> CUSTOMER MANAGEMENT</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0b2346]">Customers</h1>
            <p className="mt-1 text-sm text-gray-500">Manage customer accounts, wallet balances and loyalty points.</p>
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name, email, phone…" className="w-64 rounded-xl" />
            <Button type="submit" variant="outline"><Search size={15} /> Search</Button>
          </form>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card className="border-0 shadow-sm ring-1 ring-[#dce4ef]"><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Customers</p><p className="mt-1 text-2xl font-bold text-[#0b2346]">{isLoading ? '—' : total.toLocaleString()}</p></CardContent></Card>
          <Card className="border-0 shadow-sm ring-1 ring-[#dce4ef]"><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-gray-500">Showing</p><p className="mt-1 text-2xl font-bold text-[#0b2346]">{isLoading ? '—' : customers.length}</p></CardContent></Card>
          <Card className="col-span-2 border-0 shadow-sm ring-1 ring-[#dce4ef] sm:col-span-1"><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-gray-500">Page</p><p className="mt-1 text-2xl font-bold text-[#0b2346]">{page} / {pages}</p></CardContent></Card>
        </div>

        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-gray-900">All Customers</CardTitle>
              <Badge variant="outline">{total} total</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin text-[#0b55ad]" /> Loading customers…</div>
            ) : isError ? (
              <p className="py-10 text-center text-sm text-red-600">Could not load customers.</p>
            ) : customers.length === 0 ? (
              <div className="py-16 text-center"><Users className="mx-auto mb-2 text-gray-300" size={30} /><p className="text-sm font-semibold text-gray-700">{search ? 'No matching customers' : 'No customers yet'}</p></div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f5f8fc]">
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#526783]">Customer</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#526783]">Contact</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#526783]">Wallet</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#526783]">Points</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#526783]">Status</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-[#526783]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((c) => (
                      <TableRow key={c._id} className="hover:bg-[#f8faff]">
                        <TableCell>
                          <p className="font-semibold text-[#0b2346]">{c.fName} {c.lName}</p>
                          <p className="text-xs text-gray-500">{c.email}</p>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{c.phone || '—'}</TableCell>
                        <TableCell className="text-sm font-medium text-gray-800">{INR(c.walletBalance)}</TableCell>
                        <TableCell className="text-sm text-gray-700">{(c.loyaltyPoint || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={c.status ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50' : 'bg-gray-100 text-gray-600 hover:bg-gray-100'}>
                            {c.status ? 'Active' : 'Blocked'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button type="button" size="sm" variant="outline" className="gap-1 rounded-lg text-xs" onClick={() => setModal({ type: 'wallet', customer: c })}>
                              <Wallet size={12} /> Wallet
                            </Button>
                            <Button type="button" size="sm" variant="outline" className="gap-1 rounded-lg text-xs" onClick={() => setModal({ type: 'loyalty', customer: c })}>
                              <Star size={12} /> Points
                            </Button>
                            <Button type="button" size="sm" variant="outline" disabled={busyId === c._id} onClick={() => void toggleStatus(c)} className="rounded-lg text-xs">
                              {busyId === c._id ? <LoaderCircle size={12} className="animate-spin" /> : c.status ? 'Block' : 'Unblock'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
                  <span>Page {page} of {pages} · {total} customers</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ArrowLeft size={14} /> Prev</Button>
                    <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next <ArrowRight size={14} /></Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      {modal && <ActionDialog modal={modal} onClose={() => setModal(null)} />}
    </AdminLayout>
  );
}

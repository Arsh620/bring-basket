'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { ArrowLeft, Check, LoaderCircle, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import Link from 'next/link';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api/client';

type Vendor = {
  _id: string;
  displayName: string;
  legalName?: string;
  email?: string;
  mobile?: string;
  gstin?: string;
  state: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  status: boolean;
};

function msg(error: unknown) {
  if (error instanceof AxiosError) return error.response?.data?.message || error.message;
  return error instanceof Error ? error.message : 'Request failed';
}

function approvalBadge(status: string) {
  if (status === 'approved') return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Approved</Badge>;
  if (status === 'rejected') return <Badge className="bg-red-50 text-red-700 hover:bg-red-50">Rejected</Badge>;
  return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">Pending</Badge>;
}

function VendorForm({ vendor, onClose }: { vendor: Vendor | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const editing = vendor !== null;
  const [form, setForm] = useState({
    displayName: vendor?.displayName ?? '',
    legalName: vendor?.legalName ?? '',
    email: vendor?.email ?? '',
    mobile: vendor?.mobile ?? '',
    gstin: vendor?.gstin ?? '',
    state: vendor?.state ?? '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/purchases/vendors/${vendor._id}`, form);
        toast.success('Vendor updated');
      } else {
        await api.post('/admin/purchases/vendors', form);
        toast.success('Vendor created');
      }
      await queryClient.invalidateQueries({ queryKey: ['procurement-vendors'] });
      onClose();
    } catch (error) {
      setErr(msg(error));
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'mt-1.5 h-11 rounded-xl border-gray-200 bg-white shadow-sm focus-visible:border-[#0b55ad] focus-visible:ring-[#0b55ad]/15';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0b55ad]">Procurement</p>
            <h2 className="mt-1 text-xl font-bold text-[#0b2346]">{editing ? 'Edit Vendor' : 'Add Vendor'}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving}><X size={18} /></Button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          {err && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Display Name <span className="text-red-500">*</span></Label>
              <Input required value={form.displayName} onChange={e => set('displayName', e.target.value)} className={inputClass} placeholder="Vendor display name" />
            </div>
            <div>
              <Label>Legal Name</Label>
              <Input value={form.legalName} onChange={e => set('legalName', e.target.value)} className={inputClass} placeholder="Legal / company name" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputClass} placeholder="vendor@email.com" />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={form.mobile} onChange={e => set('mobile', e.target.value)} className={inputClass} placeholder="+91 XXXXX XXXXX" />
            </div>
            <div>
              <Label>GSTIN</Label>
              <Input value={form.gstin} onChange={e => set('gstin', e.target.value)} className={inputClass} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div>
              <Label>State <span className="text-red-500">*</span></Label>
              <Input required value={form.state} onChange={e => set('state', e.target.value)} className={inputClass} placeholder="e.g. Maharashtra" />
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-[#0b438d] text-white hover:bg-[#082f68]">
              {saving && <LoaderCircle size={15} className="animate-spin" />}
              {editing ? 'Save changes' : 'Create vendor'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ProcurementVendorsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Vendor | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['procurement-vendors', page, search],
    queryFn: async () => {
      const { data } = await api.get('/admin/purchases/vendors', { params: { page, limit: 20, search: search || undefined } });
      return { rows: data.data as Vendor[], total: data.pagination?.total ?? 0 };
    },
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const approve = async (vendor: Vendor, approvalStatus: 'approved' | 'rejected') => {
    setBusy(vendor._id);
    try {
      await api.patch(`/admin/purchases/vendors/${vendor._id}/approval`, { approvalStatus });
      await queryClient.invalidateQueries({ queryKey: ['procurement-vendors'] });
      toast.success(`Vendor ${approvalStatus}`);
    } catch (error) { toast.error(msg(error)); }
    finally { setBusy(null); }
  };

  const remove = async (vendor: Vendor) => {
    if (!window.confirm(`Delete "${vendor.displayName}"?`)) return;
    setBusy(vendor._id);
    try {
      await api.delete(`/admin/purchases/vendors/${vendor._id}`);
      await queryClient.invalidateQueries({ queryKey: ['procurement-vendors'] });
      toast.success('Vendor deleted');
    } catch (error) { toast.error(msg(error)); }
    finally { setBusy(null); }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#0b55ad]"><ArrowLeft size={15} /> Dashboard</Link>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0b55ad]">Procurement</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0b2346]">Purchase Vendors</h1>
            <p className="mt-1 text-sm text-gray-500">Manage suppliers and approve vendor accounts for purchase orders.</p>
          </div>
          <Button onClick={() => setEditor(null)} className="h-11 rounded-xl bg-[#0b438d] px-5 text-white hover:bg-[#082f68]">
            <Plus size={17} /> Add Vendor
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Total vendors', value: total },
            { label: 'Approved', value: rows.filter(r => r.approvalStatus === 'approved').length },
            { label: 'Pending approval', value: rows.filter(r => r.approvalStatus === 'pending').length },
          ].map(stat => (
            <Card key={stat.label} className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-[#0b2346]">{query.isLoading ? '—' : stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf5] bg-white px-5 py-4">
            <h2 className="font-semibold text-[#0b2346]">All vendors</h2>
            <div className="relative w-full sm:max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search vendors…" className="h-10 rounded-xl border-gray-200 bg-[#f7f9fc] pl-9 focus-visible:border-[#0b55ad]" />
            </div>
          </div>

          {query.isLoading ? (
            <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin text-[#0b55ad]" /> Loading vendors…</div>
          ) : query.isError ? (
            <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{msg(query.error)}</div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-gray-500">No vendors found. Add your first vendor to get started.</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f5f8fc]">
                    {['Vendor', 'GSTIN', 'State', 'Mobile', 'Approval', 'Actions'].map(h => (
                      <TableHead key={h} className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#526783] ${h === 'Actions' ? 'text-right' : ''}`}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(vendor => (
                    <TableRow key={vendor._id} className="hover:bg-[#f8faff]">
                      <TableCell className="px-5 py-3.5">
                        <p className="font-semibold text-[#0b2346]">{vendor.displayName}</p>
                        {vendor.legalName && <p className="text-xs text-gray-400">{vendor.legalName}</p>}
                        {vendor.email && <p className="text-xs text-gray-400">{vendor.email}</p>}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{vendor.gstin || '—'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{vendor.state}</TableCell>
                      <TableCell className="text-sm text-gray-600">{vendor.mobile || '—'}</TableCell>
                      <TableCell>{approvalBadge(vendor.approvalStatus)}</TableCell>
                      <TableCell className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {vendor.approvalStatus === 'pending' && (
                            <>
                              <Button size="sm" variant="outline" disabled={busy === vendor._id} onClick={() => approve(vendor, 'approved')} className="rounded-lg text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                                <Check size={13} /> Approve
                              </Button>
                              <Button size="sm" variant="outline" disabled={busy === vendor._id} onClick={() => approve(vendor, 'rejected')} className="rounded-lg text-red-600 border-red-200 hover:bg-red-50">
                                Reject
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="outline" disabled={busy === vendor._id} onClick={() => setEditor(vendor)} className="rounded-lg">
                            <Pencil size={13} /> Edit
                          </Button>
                          <Button size="sm" variant="ghost" disabled={busy === vendor._id} onClick={() => remove(vendor)} className="rounded-lg text-red-600 hover:bg-red-50">
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                  <p className="text-xs text-gray-500">Page {page} of {totalPages} · {total} vendors</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
      {editor !== undefined && <VendorForm vendor={editor} onClose={() => setEditor(undefined)} />}
    </AdminLayout>
  );
}

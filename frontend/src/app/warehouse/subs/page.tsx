'use client';

import { useContext, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import warehouseApi from '@/lib/api/warehouse';
import { WarehouseContext } from '@/components/portal/warehouse-context';

type Sub = { _id: string; name: string; state: string; status: string; phone?: string; username?: string };
const emptyForm = { name: '', state: '', phone: '', email: '', address: '' };
const fields = [
  { key: 'name', label: 'Name', required: true },
  { key: 'state', label: 'State', required: true },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'address', label: 'Address' },
] as const;

function errorMessage(error: unknown, fallback: string) {
  return isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || fallback : fallback;
}

export default function WarehouseSubsPage() {
  const queryClient = useQueryClient();
  const warehouseId = useContext(WarehouseContext)?._id;
  const queryKey = ['warehouse-sub-warehouses', warehouseId];
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selectedSub, setSelectedSub] = useState<Sub | null>(null);
  const subsQuery = useQuery({
    queryKey,
    enabled: Boolean(warehouseId),
    queryFn: async () => (await warehouseApi.get<{ data: Sub[] }>('/warehouse/subs')).data.data,
  });
  const subs = subsQuery.data ?? [];

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy('create');
    setError('');
    try {
      await warehouseApi.post('/warehouse/subs', form);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey });
    } catch (failure) {
      setError(errorMessage(failure, 'Could not create the sub-warehouse.'));
    } finally {
      setBusy(null);
    }
  };

  const toggleStatus = async (id: string, current: string) => {
    setBusy(id);
    setError('');
    try {
      await warehouseApi.patch(`/warehouse/subs/${id}/status`, { status: current === 'active' ? 'inactive' : 'active' });
      await queryClient.invalidateQueries({ queryKey });
    } catch (failure) {
      setError(errorMessage(failure, 'Could not update warehouse status.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 size={22} />
        <h1 className="text-xl font-bold">Sub-Warehouses</h1>
      </div>

      <form onSubmit={create} className="max-w-xl space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-800">Create Sub-Warehouse</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`sub-${field.key}`}>{field.label}</Label>
              <Input id={`sub-${field.key}`} type={'type' in field ? field.type : 'text'}
                value={form[field.key]} required={'required' in field && field.required}
                onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} />
            </div>
          ))}
        </div>
        <Button type="submit" disabled={busy !== null}>{busy === 'create' ? 'Creating…' : 'Create warehouse'}</Button>
      </form>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {subsQuery.isPending && <p role="status" className="text-sm text-slate-600">Loading sub-warehouses…</p>}
      {subsQuery.isError && (
        <p role="alert" className="text-sm text-red-700">
          Could not load sub-warehouses. <button type="button" className="underline" onClick={() => void subsQuery.refetch()}>Try again</button>
        </p>
      )}

      {subsQuery.isSuccess && <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">State</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No sub-warehouses yet.</td></tr>}
            {subs.map((s) => (
              <tr key={s._id}>
                <td className="px-4 py-3 font-medium">{s.name}<span className="block text-xs font-normal text-slate-600">{s.username || 'No portal username'}</span></td>
                <td className="px-4 py-3 text-slate-600">{s.state}</td>
                <td className="px-4 py-3 text-slate-500">{s.phone || '—'}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setSelectedSub(s)}>Set login</Button>
                    <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void toggleStatus(s._id, s.status)}>
                      {s.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
      {selectedSub && <CredentialsSheet key={selectedSub._id} sub={selectedSub} onClose={() => setSelectedSub(null)} />}
    </div>
  );
}

function CredentialsSheet({ sub, onClose }: { sub: Sub; onClose: () => void }) {
  const queryClient = useQueryClient();
  const warehouseId = useContext(WarehouseContext)?._id;
  const [username, setUsername] = useState(sub.username ?? '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await warehouseApi.post(`/warehouse/subs/${sub._id}/credentials`, { username, password });
      await queryClient.invalidateQueries({ queryKey: ['warehouse-sub-warehouses', warehouseId] });
      onClose();
    } catch (failure) {
      setError(errorMessage(failure, 'Could not save the login credentials.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Portal login</SheetTitle>
          <SheetDescription>Set the username and password for {sub.name}.</SheetDescription>
        </SheetHeader>
        <form onSubmit={save} className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="sub-login-username">Username</Label>
            <Input id="sub-login-username" value={username} onChange={(event) => setUsername(event.target.value)}
              autoComplete="off" pattern="[A-Za-z0-9_\\-]+" maxLength={100} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-login-password">New password</Label>
            <Input id="sub-login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password" minLength={6} maxLength={50} required />
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save login'}</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

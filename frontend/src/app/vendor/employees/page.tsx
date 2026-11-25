'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import vendorApi from '@/lib/api/vendor';
import { useVendorStore } from '@/store/vendor.store';

interface StoreOption {
  _id: string;
  name: string;
}

interface EmployeeRole {
  _id: string;
  name: string;
  modules?: string[];
}

interface Employee {
  _id: string;
  fName: string;
  lName?: string;
  email: string;
  phone?: string;
  status: boolean;
  employeeRoleId?: EmployeeRole | string | null;
}

const EMPTY_FORM = { fName: '', lName: '', email: '', phone: '', password: '', employeeRoleId: '' };

export default function VendorEmployeesPage() {
  const vendor = useVendorStore((state) => state.vendor);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storeId, setStoreId] = useState(vendor?.storeId || '');
  const [roles, setRoles] = useState<EmployeeRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (vendor?.isEmployee && vendor.storeId) {
      Promise.resolve().then(() => {
        if (!active) return;
        setStores([{ _id: vendor.storeId as string, name: 'Assigned store' }]);
        setStoreId(vendor.storeId as string);
        setLoading(false);
      });
      return () => { active = false; };
    }
    vendorApi.get('/vendor/stores')
      .then((response) => {
        if (!active) return;
        const storeData = response.data.data as StoreOption[];
        setStores(storeData);
        setStoreId((current) => current || storeData[0]?._id || '');
      })
      .catch(() => { if (active) toast.error('Could not load stores'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [vendor]);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    Promise.all([
      vendorApi.get('/vendor/employees', { params: { storeId } }),
      vendorApi.get('/vendor/roles/assignable', { params: { storeId } }),
    ]).then(([employeeResponse, roleResponse]) => {
      if (!active) return;
      setEmployees(employeeResponse.data.data as Employee[]);
      setRoles(roleResponse.data.data as EmployeeRole[]);
    }).catch((error: unknown) => {
      if (!active) return;
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not load employees');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const { password, employeeRoleId, ...details } = form;
        const currentRoleId = typeof editing.employeeRoleId === 'object' ? editing.employeeRoleId?._id : editing.employeeRoleId;
        await vendorApi.put(`/vendor/employees/${editing._id}`, {
          ...details,
          ...(password ? { password } : {}),
          ...(employeeRoleId !== currentRoleId ? { employeeRoleId } : {}),
        });
      } else {
        await vendorApi.post('/vendor/employees', { ...form, storeId });
      }
      toast.success(editing ? 'Employee updated' : 'Employee created');
      setEditing(null);
      setForm(EMPTY_FORM);
      const response = await vendorApi.get('/vendor/employees', { params: { storeId } });
      setEmployees(response.data.data as Employee[]);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not save employee');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (employee: Employee) => {
    try {
      await vendorApi.patch(`/vendor/employees/${employee._id}/status`, { status: !employee.status });
      setEmployees((current) => current.map((entry) => entry._id === employee._id ? { ...entry, status: !entry.status } : entry));
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not update employee');
    }
  };

  const roleName = (role: Employee['employeeRoleId']) => typeof role === 'object' && role ? role.name : '—';
  const canManageEmployee = (employee: Employee) => !vendor?.isEmployee || (
    employee._id !== vendor._id && typeof employee.employeeRoleId === 'object' && Boolean(employee.employeeRoleId?.modules
      ?.every((module) => vendor.modules?.includes(module)))
  );
  const editEmployee = (employee: Employee) => {
    setEditing(employee);
    setForm({
      fName: employee.fName,
      lName: employee.lName ?? '',
      email: employee.email,
      phone: employee.phone ?? '',
      password: '',
      employeeRoleId: typeof employee.employeeRoleId === 'object'
        ? employee.employeeRoleId?._id ?? ''
        : employee.employeeRoleId ?? '',
    });
  };
  const currentRole = editing && typeof editing.employeeRoleId === 'object' ? editing.employeeRoleId : null;

  return (
    <div className="p-5">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800">Employees</h1>
        <p className="text-sm text-slate-500">Manage employees and their store-scoped roles.</p>
      </div>

      {stores.length > 1 && (
        <label className="mb-5 block max-w-sm text-sm font-medium text-slate-700">
          Store
          <select value={storeId} disabled={saving} onChange={(event) => {
            setEditing(null);
            setForm(EMPTY_FORM);
            setEmployees([]);
            setRoles([]);
            setStoreId(event.target.value);
          }} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5">
            {stores.map((store) => <option key={store._id} value={store._id}>{store.name}</option>)}
          </select>
        </label>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold text-slate-800">Store employees</h2>
          </div>
          {loading ? (
            <p className="p-5 text-sm text-slate-500">Loading employees…</p>
          ) : employees.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No employees in this store yet.</p>
          ) : (
            <div className="divide-y">
              {employees.map((employee) => (
                <article key={employee._id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <h3 className="font-semibold text-slate-800">{employee.fName} {employee.lName}</h3>
                    <p className="text-sm text-slate-500">{employee.email}</p>
                    <p className="mt-1 text-xs text-slate-500">Role: {roleName(employee.employeeRoleId)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${employee.status ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {employee.status ? 'Active' : 'Disabled'}
                    </span>
                    {canManageEmployee(employee) && <>
                      <button type="button" onClick={() => editEmployee(employee)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Edit</button>
                      <button type="button" onClick={() => void toggleStatus(employee)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">
                        {employee.status ? 'Disable' : 'Enable'}
                      </button>
                    </>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-800">{editing ? 'Edit employee' : 'Add employee'}</h2>
            {editing && <button type="button" disabled={saving} className="text-sm underline" onClick={() => {
              setEditing(null);
              setForm(EMPTY_FORM);
            }}>Cancel</button>}
          </div>
          <label className="block text-sm font-medium text-slate-700">First name
            <input required value={form.fName} onChange={(event) => setForm({ ...form, fName: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Last name
            <input value={form.lName} onChange={(event) => setForm({ ...form, lName: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Email
            <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Phone
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">{editing ? 'New password (optional)' : 'Temporary password'}
            <input required={!editing} minLength={6} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Role
            <select required value={form.employeeRoleId} onChange={(event) => setForm({ ...form, employeeRoleId: event.target.value })} className="mt-1 w-full rounded-xl border bg-white px-3 py-2">
              <option value="">Select a role</option>
              {currentRole && !roles.some(({ _id }) => _id === currentRole._id) && <option value={currentRole._id}>{currentRole.name} (current)</option>}
              {roles.map((role) => <option key={role._id} value={role._id}>{role.name}</option>)}
            </select>
          </label>
          <button type="submit" disabled={saving || !storeId || (!editing && roles.length === 0)} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save employee' : 'Create employee'}
          </button>
        </form>
      </div>
    </div>
  );
}

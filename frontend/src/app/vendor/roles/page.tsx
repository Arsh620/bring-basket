'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import vendorApi from '@/lib/api/vendor';
import { useVendorStore } from '@/store/vendor.store';

interface StoreOption {
  _id: string;
  name: string;
}

interface PermissionModule {
  key: string;
  label: string;
}

interface EmployeeRole {
  _id: string;
  name: string;
  modules: string[];
  status: boolean;
}

export default function VendorRolesPage() {
  const vendor = useVendorStore((state) => state.vendor);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storeId, setStoreId] = useState('');
  const [permissions, setPermissions] = useState<PermissionModule[]>([]);
  const [roles, setRoles] = useState<EmployeeRole[]>([]);
  const [name, setName] = useState('');
  const [modules, setModules] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [editing, setEditing] = useState<EmployeeRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (vendor?.isEmployee && vendor.storeId) {
      const assignedStore = vendor.storeId;
      Promise.resolve().then(() => {
        if (!active) return;
        setStores([{ _id: assignedStore, name: 'Assigned store' }]);
        setStoreId(assignedStore);
        setLoading(false);
      });
      return () => { active = false; };
    }
    vendorApi.get('/vendor/stores').then((storeResponse) => {
      if (!active) return;
      const storeData = storeResponse.data.data as StoreOption[];
      setStores(storeData);
      setStoreId((current) => current || storeData[0]?._id || '');
    }).catch(() => {
      if (active) toast.error('Could not load role setup');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [vendor?.isEmployee, vendor?.storeId]);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    vendorApi.get('/vendor/roles/permissions', { params: { storeId } })
      .then((response) => {
        if (active) setPermissions(response.data.data as PermissionModule[]);
      })
      .catch(() => {
        if (active) toast.error('Could not load module permissions');
      });
    return () => { active = false; };
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    vendorApi.get('/vendor/roles', { params: { storeId } })
      .then((response) => {
        if (active) setRoles(response.data.data as EmployeeRole[]);
      })
      .catch(() => {
        if (active) toast.error('Could not load employee roles');
      });
    return () => { active = false; };
  }, [storeId]);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setModules([]);
    setActive(true);
  };

  const toggleModule = (key: string) => {
    setModules((current) => current.includes(key)
      ? current.filter((module) => module !== key)
      : [...current, key]);
  };

  const saveRole = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { name, modules, storeId, status: active };
      if (editing) {
        await vendorApi.put(`/vendor/roles/${editing._id}`, payload);
        toast.success('Role updated');
      } else {
        await vendorApi.post('/vendor/roles', payload);
        toast.success('Role created');
      }
      resetForm();
      const response = await vendorApi.get('/vendor/roles', { params: { storeId } });
      setRoles(response.data.data as EmployeeRole[]);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not save role');
    } finally {
      setSaving(false);
    }
  };

  const editRole = (role: EmployeeRole) => {
    setEditing(role);
    setName(role.name);
    setModules(role.modules);
    setActive(role.status);
  };

  const deleteRole = async (role: EmployeeRole) => {
    if (!window.confirm(`Delete "${role.name}"?`)) return;
    try {
      await vendorApi.delete(`/vendor/roles/${role._id}`);
      setRoles((current) => current.filter(({ _id }) => _id !== role._id));
      if (editing?._id === role._id) resetForm();
      toast.success('Role deleted');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not delete role');
    }
  };

  return (
    <div className="p-5">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800">Employee roles</h1>
        <p className="text-sm text-slate-500">Create store-scoped roles and choose their Laravel modules.</p>
      </div>

      <label className="mb-5 block max-w-sm text-sm font-medium text-slate-700">
        Store
        <select value={storeId} disabled={saving} onChange={(event) => {
          resetForm();
          setRoles([]);
          setPermissions([]);
          setStoreId(event.target.value);
        }} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5">
          {stores.map((store) => <option key={store._id} value={store._id}>{store.name}</option>)}
        </select>
      </label>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold text-slate-800">Roles for this store</h2>
          </div>
          {loading ? (
            <p className="p-5 text-sm text-slate-500">Loading roles…</p>
          ) : roles.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No employee roles have been created for this store.</p>
          ) : (
            <div className="divide-y">
              {roles.map((role) => (
                <article key={role._id} className="flex flex-wrap items-start justify-between gap-3 p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-800">{role.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${role.status ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {role.status ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{role.modules.join(', ')}</p>
                  </div>
                  {(!vendor?.isEmployee || role.modules.every((module) => vendor.modules?.includes(module))) && <div className="flex gap-2">
                    <button type="button" onClick={() => editRole(role)} aria-label={`Edit ${role.name}`} className="rounded-lg border p-2 text-slate-500 hover:text-emerald-700"><Pencil size={15} /></button>
                    <button type="button" onClick={() => deleteRole(role)} aria-label={`Delete ${role.name}`} className="rounded-lg border p-2 text-slate-500 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>}
                </article>
              ))}
            </div>
          )}
        </section>

        <form onSubmit={saveRole} className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">{editing ? 'Edit role' : 'Create role'}</h2>
            {editing && <button type="button" onClick={resetForm} className="text-xs font-medium text-slate-500 hover:text-slate-800">Cancel</button>}
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Role name
            <input required maxLength={191} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 outline-none focus:border-emerald-500" />
          </label>
          {editing && (
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="accent-emerald-600" />
              Active role
            </label>
          )}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">Module permissions</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {permissions.map((permission) => (
                <label key={permission.key} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={modules.includes(permission.key)} onChange={() => toggleModule(permission.key)} className="accent-emerald-600" />
                  {permission.label}
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" disabled={saving || !storeId} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {!editing && <Plus size={16} />}
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create role'}
          </button>
        </form>
      </div>
    </div>
  );
}

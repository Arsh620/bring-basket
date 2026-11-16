'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import vendorApi from '@/lib/api/vendor';

interface Item {
  _id: string;
  name: string;
  price: number;
  stock: number;
  status: boolean;
  sku?: string;
  image?: string;
}

const currency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const EMPTY_FORM = { name: '', price: '', stock: '', sku: '', description: '', image: '' };

export default function VendorItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await vendorApi.get('/vendor/items', { params: { page, limit: 20, search: search || undefined } });
      setItems(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch { toast.error('Could not load products'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, search]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (item: Item) => {
    setEditing(item);
    setForm({ name: item.name, price: String(item.price), stock: String(item.stock), sku: item.sku || '', description: '', image: item.image || '' });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, price: Number(form.price), stock: Number(form.stock) };
      if (editing) {
        await vendorApi.put(`/vendor/items/${editing._id}`, payload);
        toast.success('Product updated');
      } else {
        await vendorApi.post('/vendor/items', payload);
        toast.success('Product created');
      }
      setShowForm(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Save failed');
    } finally { setBusy(false); }
  };

  const toggleStatus = async (item: Item) => {
    try {
      await vendorApi.patch(`/vendor/items/${item._id}/status`, { status: !item.status });
      setItems((prev) => prev.map((i) => i._id === item._id ? { ...i, status: !i.status } : i));
    } catch { toast.error('Status update failed'); }
  };

  const deleteItem = async (item: Item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await vendorApi.delete(`/vendor/items/${item._id}`);
      toast.success('Product deleted');
      load();
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div className="p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products</h1>
          <p className="text-sm text-slate-500">{total} total products</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="mb-4 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search products…"
          className="w-full rounded-xl border bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-emerald-500 sm:max-w-xs" />
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-medium text-slate-600">No products yet</p>
            <button onClick={openCreate} className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
              Add your first product
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Product</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">SKU</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Price</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Stock</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                  <td className="px-4 py-3 text-slate-500">{item.sku || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{currency(item.price)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{item.stock}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleStatus(item)} className={item.status ? 'text-emerald-600' : 'text-slate-400'}>
                      {item.status ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(item)} className="rounded-lg border p-1.5 text-slate-500 hover:text-emerald-600">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteItem(item)} className="rounded-lg border p-1.5 text-slate-500 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > 20 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-slate-500">Page {page} · {total} total</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="rounded-xl border px-3 py-1.5 text-xs disabled:opacity-40">Previous</button>
              <button disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border px-3 py-1.5 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-5 text-lg font-bold text-slate-800">{editing ? 'Edit Product' : 'Add Product'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'name', label: 'Product name', required: true, colSpan: true },
                  { key: 'price', label: 'Price', type: 'number', required: true },
                  { key: 'stock', label: 'Stock', type: 'number' },
                  { key: 'sku', label: 'SKU' },
                  { key: 'image', label: 'Image URL' },
                ].map(({ key, label, type, required, colSpan }) => (
                  <div key={key} className={colSpan ? 'col-span-2' : ''}>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
                    <input type={type || 'text'} required={required} value={form[key as keyof typeof form]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-500" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3} className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={busy}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {busy ? 'Saving…' : editing ? 'Save changes' : 'Create product'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border py-2.5 text-sm font-semibold text-slate-600">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

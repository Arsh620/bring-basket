'use client';

import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import supplierApi from '@/lib/api/supplier';

type Product = { _id: string; name: string; sku?: string; price: number; stock?: number; status: boolean };

export default function SupplierProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: '', sku: '', price: '', description: '' });
  const [creating, setCreating] = useState(false);

  const load = () => {
    supplierApi.get('/supplier/products').then((r) => setProducts(r.data.data || [])).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setCreating(true);
    try {
      await supplierApi.post('/supplier/products', { ...form, price: Number(form.price) });
      setForm({ name: '', sku: '', price: '', description: '' });
      load();
    } catch { /* ignore */ }
    finally { setCreating(false); }
  };

  const toggle = async (id: string) => {
    await supplierApi.patch(`/supplier/products/${id}/toggle`, {});
    load();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Package size={22} />
        <h1 className="text-xl font-bold">My Products</h1>
        <p className="text-sm text-slate-500">Your supplier product catalog</p>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3 max-w-md">
        <h2 className="font-semibold text-slate-800">Add Product</h2>
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Product name *" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" />
        <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
          placeholder="SKU" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" />
        <input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          placeholder="Price *" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" />
        <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Description" rows={2} className="w-full rounded-lg border px-3 py-2 text-sm outline-none" />
        <button onClick={create} disabled={creating || !form.name || !form.price}
          className="rounded-xl bg-[#08234b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {creating ? 'Adding...' : 'Add Product'}
        </button>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">SKU</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No products yet.</td></tr>}
            {products.map((p) => (
              <tr key={p._id}>
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-slate-500">{p.sku || '—'}</td>
                <td className="px-4 py-3 text-right font-medium">₹{p.price}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{p.status ? 'Active' : 'Inactive'}</span></td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => toggle(p._id)} className="text-xs text-blue-600 hover:underline">
                    {p.status ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

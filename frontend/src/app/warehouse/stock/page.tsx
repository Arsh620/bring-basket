'use client';

import { useEffect, useState } from 'react';
import { Package, Search } from 'lucide-react';
import warehouseApi from '@/lib/api/warehouse';

type StockItem = { _id: string; itemId?: { name?: string; sku?: string }; quantity: number; reservedQty: number };

export default function WarehouseStockPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    warehouseApi.get('/warehouse/stock', { params: { search } })
      .then((r) => setStock(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Package size={22} />
        <h1 className="text-xl font-bold">Warehouse Stock</h1>
      </div>

      <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-sm max-w-sm">
        <Search size={15} className="text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..." className="flex-1 text-sm outline-none" />
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-left">SKU</th>
              <th className="px-4 py-3 text-right">Available</th>
              <th className="px-4 py-3 text-right">Reserved</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>}
            {!loading && stock.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No stock records.</td></tr>}
            {stock.map((s) => (
              <tr key={s._id}>
                <td className="px-4 py-3 font-medium text-slate-800">{s.itemId?.name || '—'}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{s.itemId?.sku || '—'}</td>
                <td className="px-4 py-3 text-right font-medium">{s.quantity}</td>
                <td className="px-4 py-3 text-right text-slate-500">{s.reservedQty ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

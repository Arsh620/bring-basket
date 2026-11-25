'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShoppingBag, Package, TrendingUp, Store, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import vendorApi from '@/lib/api/vendor';
import { useVendorStore } from '@/store/vendor.store';
import { canAccessVendorModule } from '@/lib/vendor-permissions';

interface DashboardData {
  totalOrders: number;
  pendingOrders: number;
  totalItems: number;
  totalStores: number;
  todayOrders: number;
  totalRevenue: number;
}

const currency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function VendorDashboardPage() {
  const { vendor } = useVendorStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    const response = await vendorApi.get('/vendor/dashboard');
    return response.data.data as DashboardData;
  }, []);

  useEffect(() => {
    let active = true;
    fetchDashboard()
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) toast.error('Could not load dashboard'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchDashboard]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await fetchDashboard());
    } catch {
      toast.error('Could not load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const stats = data ? [
    { label: 'Total Orders', value: data.totalOrders, icon: ShoppingBag, color: 'bg-blue-50 text-blue-600' },
    { label: 'Pending Orders', value: data.pendingOrders, icon: ShoppingBag, color: 'bg-yellow-50 text-yellow-600' },
    { label: "Today's Orders", value: data.todayOrders, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Total Revenue', value: currency(data.totalRevenue), icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
    { label: 'Products', value: data.totalItems, icon: Package, color: 'bg-orange-50 text-orange-600' },
    { label: 'Stores', value: data.totalStores, icon: Store, color: 'bg-slate-100 text-slate-600' },
  ] : [];

  return (
    <div className="p-5">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">Welcome back, {vendor?.fName}</p>
        </div>
        <button onClick={() => { setLoading(true); void load(); }} className="rounded-xl border p-2 text-slate-500 hover:text-emerald-600">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                <Icon size={18} />
              </div>
              <p className="text-2xl font-bold text-slate-800">{value}</p>
              <p className="mt-0.5 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { href: '/vendor/items', module: 'item', label: 'Manage Products', desc: 'Add, edit or update stock' },
              { href: '/vendor/orders', module: 'order', label: 'View Orders', desc: 'Process pending orders' },
              { href: '/vendor/stores', module: 'my_shop', label: 'Store Settings', desc: 'Update store profile' },
            ].filter(({ module: permissionKey }) => canAccessVendorModule(vendor, permissionKey)).map(({ href, label, desc }) => (
              <a key={href} href={href}
                className="flex items-center justify-between rounded-xl border p-3 hover:border-emerald-300 hover:bg-emerald-50">
                <div>
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
                <span className="text-slate-400">→</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

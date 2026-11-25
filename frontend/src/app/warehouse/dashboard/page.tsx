'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { LogOut, Warehouse as WarehouseIcon } from 'lucide-react';
import warehouseApi from '@/lib/api/warehouse';

interface WarehouseProfile {
  name?: string;
  code?: string;
  type?: string;
}

export default function WarehouseDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<WarehouseProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!localStorage.getItem('warehouse_token')) {
        router.replace('/warehouse/login');
        return;
      }

      try {
        const response = await warehouseApi.get<{ data: WarehouseProfile }>('/warehouse/auth/me');
        setProfile(response.data.data);
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          localStorage.removeItem('warehouse_token');
          router.replace('/warehouse/login');
        } else {
          setLoadError(true);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [router]);

  const logout = () => {
    localStorage.removeItem('warehouse_token');
    router.replace('/warehouse/login');
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading warehouse account…</main>;
  }

  if (loadError || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-800">Could not load warehouse account</h1>
          <p className="mt-2 text-sm text-slate-500">Please sign in again or try later.</p>
          <button onClick={logout} className="mt-6 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Return to sign in
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-3xl rounded-2xl border bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <WarehouseIcon size={24} />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-800">{profile?.name || 'Warehouse Portal'}</h1>
              <p className="text-sm text-slate-500">{profile?.code || 'Signed in'}{profile?.type ? ` · ${profile.type} warehouse` : ''}</p>
            </div>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            <LogOut size={16} />
            Sign out
          </button>
        </div>
        <p className="mt-8 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
          Your warehouse account is authenticated. Stock, transfers, and store stock requests are being connected to this portal.
        </p>
      </section>
    </main>
  );
}

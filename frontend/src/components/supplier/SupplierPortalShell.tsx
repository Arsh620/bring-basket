'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LoaderCircle, LogOut, Truck } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import supplierApi from '@/lib/api/supplier';

type SupplierProfile = {
  displayName?: string;
  email?: string;
};

const navigation = [
  { label: 'Dashboard', href: '/supplier/dashboard' },
  { label: 'Orders', href: '/supplier/orders' },
  { label: 'Invoices', href: '/supplier/invoices' },
  { label: 'Payments', href: '/supplier/payments' },
  { label: 'Profile', href: '/supplier/profile' },
];

export function SupplierPortalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      if (!localStorage.getItem('supplier_token')) {
        router.replace('/supplier/login');
        return;
      }
      try {
        const response = await supplierApi.get<{ data: SupplierProfile }>('/supplier/auth/me');
        if (active) setProfile(response.data.data);
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          localStorage.removeItem('supplier_token');
          router.replace('/supplier/login');
          return;
        }
        if (active) setLoadError(
          axios.isAxiosError<{ message?: string }>(error)
            ? error.response?.data?.message || 'Could not load supplier account.'
            : 'Could not load supplier account.',
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProfile();
    return () => { active = false; };
  }, [retry, router]);

  const logout = async () => {
    try {
      await supplierApi.post('/supplier/auth/logout');
    } catch {
      toast.error('Could not notify the server; signing out locally.');
    } finally {
      localStorage.removeItem('supplier_token');
      router.replace('/supplier/login');
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18} /> Loading supplier account…</main>;
  }
  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-800">Could not load supplier account</h1>
          <p role="alert" className="mt-2 text-sm text-slate-500">{loadError || 'Please sign in again or try later.'}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" onClick={() => { setLoading(true); setLoadError(''); setRetry((value) => value + 1); }} className="rounded-xl border px-4 py-2 text-sm font-semibold">Try again</button>
            <button type="button" onClick={() => void logout()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Sign out</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/supplier/dashboard" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Truck size={23} /></span>
            <span><span className="block font-bold text-slate-900">Supplier Portal</span><span className="block text-xs text-slate-500">{profile.displayName || profile.email}</span></span>
          </Link>
          <button type="button" onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            <LogOut size={16} /> Sign out
          </button>
        </div>
        <nav aria-label="Supplier portal" className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6">
          {navigation.map((item) => {
            const active = pathname === item.href || (item.href !== '/supplier/dashboard' && pathname.startsWith(`${item.href}/`));
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6">{children}</main>
    </div>
  );
}

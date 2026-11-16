'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useVendorStore } from '@/store/vendor.store';
import vendorApi from '@/lib/api/vendor';

export default function VendorLoginPage() {
  const router = useRouter();
  const setAuth = useVendorStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await vendorApi.post('/vendor/auth/login', { email, password });
      setAuth(res.data.data.token, res.data.data.vendor);
      toast.success('Welcome back!');
      router.push('/vendor/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Login failed');
    } finally { setBusy(false); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
            <Store size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Vendor Portal</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage your store</p>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@store.com"
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border px-3 py-2.5 pr-10 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={busy}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="text-center text-sm text-slate-500">
              New vendor?{' '}
              <Link href="/vendor/register" className="font-medium text-emerald-600 hover:underline">Register here</Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}

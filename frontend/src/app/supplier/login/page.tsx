'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Eye, EyeOff, Truck } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import supplierApi from '@/lib/api/supplier';

export default function SupplierLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    try {
      const response = await supplierApi.post('/supplier/auth/login', { email, password });
      localStorage.setItem('supplier_token', response.data.data.token);
      toast.success('Login successful');
      router.replace('/supplier/dashboard');
    } catch (error: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      toast.error(message || 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
            <Truck size={26} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Supplier Portal</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage your Bring Basket account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
          <div>
            <label htmlFor="supplier-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input
              id="supplier-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
            />
          </div>
          <div>
            <label htmlFor="supplier-password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <input
                id="supplier-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 pr-10 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((shown) => !shown)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-center text-xs text-slate-500">
            Supplier access is available after your registration is approved and enabled.
          </p>
          <p className="text-center text-sm text-slate-600">
            New supplier?{' '}
            <Link href="/supplier/register" className="font-semibold text-emerald-700 hover:underline">
              Register your business
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

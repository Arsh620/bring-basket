'use client';

import { FormEvent, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import supplierApi from '@/lib/api/supplier';

function subscribeToHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

function getSetupToken() {
  return window.location.hash.slice(1);
}

export default function SupplierSetPasswordPage() {
  const router = useRouter();
  const token = useSyncExternalStore(subscribeToHash, getSetupToken, () => null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    try {
      await supplierApi.post('/supplier/auth/set-password', { token, password, confirmPassword });
      toast.success('Password set. You can now sign in after your account is approved.');
      router.replace('/supplier/login');
    } catch (error: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      toast.error(message || 'Could not set the password. Request a new setup link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <KeyRound size={25} />
          </span>
          <h1 className="text-2xl font-bold text-slate-800">Set supplier password</h1>
          <p className="mt-1 text-sm text-slate-500">Choose a password with at least 8 characters.</p>
        </div>

        {token === null ? (
          <p className="text-center text-sm text-slate-500">Checking setup link…</p>
        ) : !token ? (
          <div className="text-center">
            <p role="alert" className="text-sm text-red-700">This setup link is missing. Open the full link shared by your administrator or request a new one.</p>
            <Link href="/supplier/login" className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline">
              Return to supplier sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="supplier-new-password" className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
              <input
                id="supplier-new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              />
            </div>
            <div>
              <label htmlFor="supplier-confirm-password" className="mb-1.5 block text-sm font-medium text-slate-700">Confirm password</label>
              <input
                id="supplier-confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !token}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? 'Saving password…' : 'Set password'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

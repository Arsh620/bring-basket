'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBasket } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomerStore } from '@/store/customer.store';
import customerApi from '@/lib/api/customer';

export default function CustomerRegisterPage() {
  const router = useRouter();
  const setAuth = useCustomerStore((s) => s.setAuth);
  const [form, setForm] = useState({ fName: '', lName: '', phone: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await customerApi.post('/customer/auth/register', form);
      setAuth(res.data.data.token, res.data.data.user);
      toast.success('Account created!');
      router.push('/home');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Registration failed');
    } finally { setBusy(false); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
            <ShoppingBasket size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Create Account</h1>
          <p className="mt-1 text-sm text-slate-500">Join Bring Basket today</p>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">First name</label>
                <input required value={form.fName} onChange={set('fName')} placeholder="Rahul"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Last name</label>
                <input value={form.lName} onChange={set('lName')} placeholder="Sharma"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
              <input required value={form.phone} onChange={set('phone')} placeholder="+91 9876543210"
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com"
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <input type="password" required value={form.password} onChange={set('password')} placeholder="Min 6 characters" minLength={6}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" />
            </div>
            <button type="submit" disabled={busy}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
              {busy ? 'Creating account…' : 'Create account'}
            </button>
            <p className="text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-emerald-600 hover:underline">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}

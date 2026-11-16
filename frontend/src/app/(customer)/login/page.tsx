'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ShoppingBasket } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomerStore } from '@/store/customer.store';
import customerApi from '@/lib/api/customer';

type Mode = 'login' | 'forgot' | 'verify' | 'reset';

export default function CustomerLoginPage() {
  const router = useRouter();
  const setAuth = useCustomerStore((s) => s.setAuth);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await customerApi.post('/customer/auth/login', { email, password });
      setAuth(res.data.data.token, res.data.data.user);
      toast.success('Welcome back!');
      router.push('/home');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Login failed');
    } finally { setBusy(false); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await customerApi.post('/customer/auth/forgot-password', { email });
      toast.success('OTP sent to your email');
      setMode('verify');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to send OTP');
    } finally { setBusy(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await customerApi.post('/customer/auth/verify-otp', { email, otp });
      setResetToken(res.data.data.reset_token);
      toast.success('OTP verified');
      setMode('reset');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Invalid OTP');
    } finally { setBusy(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await customerApi.put('/customer/auth/reset-password', { email, reset_token: resetToken, password: newPassword });
      toast.success('Password reset successful. Please login.');
      setMode('login');
      setOtp(''); setResetToken(''); setNewPassword('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Reset failed');
    } finally { setBusy(false); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
            <ShoppingBasket size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Bring Basket</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'verify' && 'Enter the OTP sent to your email'}
            {mode === 'reset' && 'Set a new password'}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
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
              <div className="text-right">
                <button type="button" onClick={() => setMode('forgot')} className="text-sm text-emerald-600 hover:underline">
                  Forgot password?
                </button>
              </div>
              <button type="submit" disabled={busy}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
              <p className="text-center text-sm text-slate-500">
                No account?{' '}
                <Link href="/register" className="font-medium text-emerald-600 hover:underline">Create one</Link>
              </p>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" />
              </div>
              <button type="submit" disabled={busy}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? 'Sending…' : 'Send OTP'}
              </button>
              <button type="button" onClick={() => setMode('login')} className="w-full text-center text-sm text-slate-500 hover:underline">
                Back to login
              </button>
            </form>
          )}

          {mode === 'verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">OTP</label>
                <input type="text" required value={otp} onChange={(e) => setOtp(e.target.value)}
                  placeholder="6-digit OTP" maxLength={6}
                  className="w-full rounded-xl border px-3 py-2.5 text-center text-lg font-bold tracking-widest outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" />
              </div>
              <button type="submit" disabled={busy}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? 'Verifying…' : 'Verify OTP'}
              </button>
              <button type="button" onClick={() => handleForgot({ preventDefault: () => {} } as React.FormEvent)} className="w-full text-center text-sm text-emerald-600 hover:underline">
                Resend OTP
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">New Password</label>
                <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters" minLength={6}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" />
              </div>
              <button type="submit" disabled={busy}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

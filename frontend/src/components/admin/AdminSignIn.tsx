'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api/client';
import { useAuthStore } from '@/store/auth.store';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export function AdminSignIn({ accountType }: { accountType: 'admin' | 'employee' }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [signInError, setSignInError] = useState('');
  const master = accountType === 'admin';
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const submit = async (credentials: z.infer<typeof schema>) => {
    setSignInError('');
    try {
      const { data } = await api.post<{ data: { token: string; admin: Parameters<typeof setAuth>[1] } }>(
        '/admin/auth/login', { ...credentials, accountType },
      );
      queryClient.clear();
      setAuth(data.data.token, data.data.admin);
      router.replace(master ? '/master/employees' : '/admin/employee-dashboard');
    } catch (error) {
      setSignInError(isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message || 'Sign-in failed. Try again.'
        : 'Sign-in failed. Try again.');
    }
  };

  return (
    <main className="grid min-h-dvh bg-slate-50 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative hidden min-h-full overflow-hidden lg:block">
        <Image src="/Fresh Grocery Bag Hero Scene.png" alt="" fill sizes="50vw" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071b3b]/45 to-transparent" />
      </div>
      <section className="flex min-w-0 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Image src="/Bring Basket Logo.png" alt="Bring Basket" width={156} height={51} className="mb-7 rounded-md" priority />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{master ? 'Master sign-in' : 'Employee sign-in'}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {master ? 'Manage staff accounts, roles, and module permissions.' : 'Use the account created by your administrator.'}
            </p>
            <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4">
              {signInError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{signInError}</p>}
              <div className="space-y-1.5">
                <Label htmlFor="admin-sign-in-email">Email address</Label>
                <Input id="admin-sign-in-email" type="email" autoComplete="username" aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'admin-sign-in-email-error' : undefined}
                  className="h-11" {...register('email')} />
                {errors.email && <p id="admin-sign-in-email-error" className="text-sm text-red-700">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-sign-in-password">Password</Label>
                <div className="relative">
                  <Input id="admin-sign-in-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'admin-sign-in-password-error' : undefined}
                    className="h-11 pr-12" {...register('password')} />
                  <Button type="button" variant="ghost" size="icon" aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setShowPassword((current) => !current)}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </Button>
                </div>
                {errors.password && <p id="admin-sign-in-password-error" className="text-sm text-red-700">{errors.password.message}</p>}
              </div>
              <Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-[#0b438d] text-white hover:bg-[#082f68]">
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
            <Link href={master ? '/admin/employee-login' : '/master/login'}
              className="mt-5 inline-block text-sm font-semibold text-[#0b438d] hover:underline">
              {master ? 'Employee sign-in' : 'Master sign-in'}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Mail, LockKeyhole, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post('/admin/auth/login', data);
      setAuth(res.data.data.token, res.data.data.admin);
      toast.success('Login successful');
      router.push('/admin/dashboard');
    } catch (err: unknown) {
      if (axios.isAxiosError<{ message?: string }>(err)) {
        toast.error(err.response?.data?.message || 'Login failed. Please try again.');
      } else {
        toast.error('Login failed. Please try again.');
      }
    }
  };

  return (
    <main className="admin-page-enter min-h-screen flex bg-white">

      {/* LEFT PANEL — full image background */}
      <section className="relative hidden lg:flex lg:w-[55%] xl:w-[60%] flex-col overflow-hidden">

        {/* Background image */}
        <Image
          src="/Fresh Grocery Bag Hero Scene.png"
          alt="Fresh Grocery"
          fill
          className="object-cover object-center"
          priority
        />

        {/* Dark gradient overlay — bottom to top */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

        {/* Top — Logo */}
        <div className="relative z-10 p-8 xl:p-10">
          <div className="inline-flex items-center justify-center rounded-2xl bg-white/90 px-5 py-3 shadow-md backdrop-blur-sm">
            <Image
              src="/Bring Basket Logo.png"
              alt="BringBasket"
              width={160}
              height={54}
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Bottom — Text overlay */}
        <div className="relative z-10 mt-auto p-8 xl:p-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#087443]/80 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
            🌿 Freshness at your fingertips
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-white xl:text-5xl">
            Your Daily <br />
            Essentials <br />
            <span className="text-[#f36b21]">Just a Click Away.</span>
          </h1>

          <p className="mt-4 max-w-sm text-sm leading-7 text-white/75 xl:text-base">
            Manage your store, products, orders and customers from one simple, powerful dashboard.
          </p>

          {/* Stats */}
          <div className="mt-8 flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-white">500+</p>
              <p className="text-xs text-white/60">Products</p>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-center">
              <p className="text-2xl font-extrabold text-white">50+</p>
              <p className="text-xs text-white/60">Stores</p>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-center">
              <p className="text-2xl font-extrabold text-white">10k+</p>
              <p className="text-xs text-white/60">Customers</p>
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT PANEL — Login form */}
      <section className="relative flex w-full lg:w-[45%] xl:w-[40%] flex-col items-center justify-center bg-[#f9fafb] px-6 py-12 sm:px-10 xl:px-16">

        {/* Version badge */}
        <div className="absolute right-6 top-6">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-400 shadow-sm">
            v1.0.0
          </span>
        </div>

        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="mb-10 lg:hidden">
            <Image
              src="/Bring Basket Logo.png"
              alt="BringBasket"
              width={160}
              height={54}
              className="object-contain"
              priority
            />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <div className="mb-4">
              <Image
                src="/Bring Basket Logo.png"
                alt="BringBasket"
                width={180}
                height={60}
                className="object-contain hidden lg:block"
                priority
              />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Welcome Back</h1>
            <p className="mt-2 text-sm text-gray-500">Sign in to continue to your admin dashboard.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="admin-stagger space-y-5">

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold text-gray-700">Email Address</Label>
              <div className="relative">
                <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@example.com"
                  className="h-12 rounded-xl border-gray-200 bg-white pl-11 text-sm shadow-sm focus-visible:border-[#087443] focus-visible:ring-[#087443]/20"
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-semibold text-gray-700">Password</Label>
              <div className="relative">
                <LockKeyhole size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-12 rounded-xl border-gray-200 bg-white pl-11 pr-12 text-sm shadow-sm focus-visible:border-[#087443] focus-visible:ring-[#087443]/20"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#087443] transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 accent-[#087443]" />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => toast.info('Contact your administrator to reset password.')}
                className="text-sm font-semibold text-[#087443] hover:text-[#f36b21] transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="group h-12 w-full rounded-xl bg-[#087443] text-sm font-semibold text-white shadow-md hover:bg-[#066238] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:translate-y-0"
            >
              {isSubmitting ? 'Signing in...' : (
                <>
                  Sign In
                  <ArrowRight size={17} className="ml-2 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 border-t border-gray-100 pt-6 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <ShieldCheck size={14} />
              <span>Protected Admin Access · Bring Basket</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

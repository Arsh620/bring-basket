'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api/client';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AdminLoadingState, AdminNavigationLoader } from '../LoadingState';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const hydrate = useAuthStore((state) => state.hydrate);
  const setAuth = useAuthStore((state) => state.setAuth);
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hasHydrated && !isAuthenticated()) router.replace('/admin/login');
  }, [hasHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    api.get<{ data: Parameters<typeof setAuth>[1] }>('/admin/auth/me')
      .then((response) => {
        if (active) setAuth(token, response.data.data);
      })
      .catch((error: unknown) => {
        if (!(error instanceof AxiosError && error.response?.status === 401)) {
          toast.error('Could not load the administrator profile.');
        }
      });
    return () => { active = false; };
  }, [setAuth, token]);

  useEffect(() => {
    const handleUnauthorized = () => {
      useAuthStore.getState().logout();
      router.replace('/admin/login');
    };
    window.addEventListener('admin:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('admin:unauthorized', handleUnauthorized);
  }, [router]);

  if (!hasHydrated) return <AdminLoadingState fullScreen />;
  if (!isAuthenticated()) return null;

  return (
    <div className="min-h-screen bg-[#f5f7fb] lg:flex lg:h-screen lg:overflow-hidden">
      <AdminNavigationLoader />
      <Sidebar mobileOpen={mobileMenuOpen} onNavigate={() => setMobileMenuOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:h-screen lg:min-h-0">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="admin-page-enter flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

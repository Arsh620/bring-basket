'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getWorkspaceLoginPath, useAuthStore } from '@/store/auth.store';
import api from '@/lib/api/client';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AdminLoadingState, AdminNavigationLoader } from '../LoadingState';
import { canAccessAdminModule, getAdminDashboardPath, getAdminModuleForPath, isPrimaryAdmin } from '@/lib/admin-permissions';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AdminLoadingState fullScreen />}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const admin = useAuthStore((state) => state.admin);
  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const hydrate = useAuthStore((state) => state.hydrate);
  const setAuth = useAuthStore((state) => state.setAuth);
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const masterWorkspace = pathname.startsWith('/master/');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileToken, setProfileToken] = useState<string | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hasHydrated && !token) router.replace(masterWorkspace ? '/master/login' : getWorkspaceLoginPath());
  }, [hasHydrated, masterWorkspace, token, router]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    api.get<{ data: Parameters<typeof setAuth>[1] }>('/admin/auth/me')
      .then((response) => {
        if (active && localStorage.getItem('admin_token') === token) {
          setAuth(token, response.data.data);
          setProfileToken(token);
          setProfileError(false);
        }
      })
      .catch((error: unknown) => {
        if (active && localStorage.getItem('admin_token') === token) {
          if (error instanceof AxiosError && [401, 403].includes(error.response?.status ?? 0)) {
            useAuthStore.getState().logout();
            router.replace(masterWorkspace ? '/master/login' : getWorkspaceLoginPath());
          } else {
            toast.error('Could not load the administrator profile.');
            setProfileToken(token);
            setProfileError(true);
          }
        }
      });
    return () => { active = false; };
  }, [masterWorkspace, retryCount, router, setAuth, token]);

  useEffect(() => {
    const handleUnauthorized = () => {
      queryClient.clear();
      useAuthStore.getState().logout();
      router.replace(masterWorkspace ? '/master/login' : getWorkspaceLoginPath());
    };
    const syncSession = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== null && event.key !== 'admin_token')) return;
      if (localStorage.getItem('admin_token') === useAuthStore.getState().token) return;
      queryClient.clear();
      hydrate();
    };
    const refreshPermissions = () => {
      if (localStorage.getItem('admin_token')) setRetryCount((count) => count + 1);
    };
    window.addEventListener('admin:unauthorized', handleUnauthorized);
    window.addEventListener('storage', syncSession);
    window.addEventListener('focus', refreshPermissions);
    return () => {
      window.removeEventListener('admin:unauthorized', handleUnauthorized);
      window.removeEventListener('storage', syncSession);
      window.removeEventListener('focus', refreshPermissions);
    };
  }, [hydrate, masterWorkspace, queryClient, router]);

  const isDashboard = pathname === '/admin/dashboard' || pathname === '/admin/employee-dashboard';
  const dashboardPath = getAdminDashboardPath(admin);
  const redirectDashboard = isDashboard && admin && pathname !== dashboardPath;

  useEffect(() => {
    if (redirectDashboard && token && profileToken === token && !profileError) router.replace(dashboardPath);
  }, [dashboardPath, profileError, profileToken, redirectDashboard, router, token]);

  if (!hasHydrated) return <AdminLoadingState fullScreen />;
  if (!token) return null;
  if (profileToken !== token) return <AdminLoadingState fullScreen />;
  if (profileError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-6">
        <section role="alert" className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Profile unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">The administrator profile could not be loaded.</p>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-5 rounded-lg bg-[#08234b] px-4 py-2 text-sm font-medium text-white">
            Try again
          </button>
        </section>
      </div>
    );
  }
  if (redirectDashboard) return <AdminLoadingState fullScreen />;

  const requiredModule = getAdminModuleForPath(pathname);
  const canAccessPage = masterWorkspace
    ? isPrimaryAdmin(admin)
    : !requiredModule || canAccessAdminModule(admin, requiredModule);

  return (
    <div className="min-h-screen bg-[#f5f7fb] lg:flex lg:h-screen lg:overflow-hidden">
      <AdminNavigationLoader />
      <Sidebar mobileOpen={mobileMenuOpen} onNavigate={() => setMobileMenuOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:h-screen lg:min-h-0">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="admin-page-enter flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
          {canAccessPage ? children : (
            <section role="alert" className="mx-auto mt-12 max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
              <h1 className="text-xl font-semibold text-slate-900">Access denied</h1>
              <p className="mt-2 text-sm text-slate-600">
                {masterWorkspace ? 'This workspace requires a master administrator account.' : 'Your assigned role does not allow access to this page.'}
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

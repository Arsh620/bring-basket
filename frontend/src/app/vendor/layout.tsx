'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Package, ShoppingBag, Store, LogOut, Users, Shield, Wallet, Star, ClipboardList, ScanLine } from 'lucide-react';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { useVendorStore } from '@/store/vendor.store';
import vendorApi from '@/lib/api/vendor';
import { canAccessVendorModule, getVendorModuleForPath, vendorMenuModuleByPath } from '@/lib/vendor-permissions';
import { PortalMobileMenu } from '@/components/portal/PortalMobileMenu';

const NAV = [
  { href: '/vendor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vendor/items', label: 'Products', icon: Package },
  { href: '/vendor/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/vendor/pos', label: 'POS', icon: ScanLine },
  { href: '/vendor/stores', label: 'Stores', icon: Store },
  { href: '/vendor/store-stock-requests', label: 'Stock Requests', icon: ClipboardList },
  { href: '/vendor/wallet', label: 'Wallet', icon: Wallet },
  { href: '/vendor/reviews', label: 'Reviews', icon: Star },
  { href: '/vendor/roles', label: 'Roles', icon: Shield },
  { href: '/vendor/employees', label: 'Employees', icon: Users },
] as const;

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrate, hasHydrated, isAuthenticated, logout, vendor } = useVendorStore();
  const token = useVendorStore((state) => state.token);
  const setAuth = useVendorStore((state) => state.setAuth);
  const [profileToken, setProfileToken] = useState<string | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const isPublicAuthPage = pathname === '/vendor/login' || pathname === '/vendor/employee-login' || pathname === '/vendor/register';

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!isPublicAuthPage && hasHydrated && !isAuthenticated()) router.replace('/vendor/login');
  }, [hasHydrated, isAuthenticated, isPublicAuthPage, router]);

  useEffect(() => {
    if (!token || isPublicAuthPage) return;
    let active = true;
    vendorApi.get('/vendor/auth/me')
      .then((response) => {
        if (active) {
          setAuth(token, response.data.data);
          setProfileToken(token);
          setProfileError(false);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof AxiosError && [401, 403].includes(error.response?.status ?? 0)) {
          logout();
          router.replace('/vendor/login');
          return;
        }
        toast.error('Could not load the vendor profile.');
        setProfileToken(token);
        setProfileError(true);
      });
    return () => { active = false; };
  }, [isPublicAuthPage, logout, retryCount, router, setAuth, token]);

  if (isPublicAuthPage) return children;
  if (!hasHydrated || !isAuthenticated()) return null;
  if (profileToken !== token) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading vendor profile…</div>;
  if (profileError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section role="alert" className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Profile unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">The vendor profile could not be loaded.</p>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">Try again</button>
        </section>
      </div>
    );
  }
  const requiredModule = getVendorModuleForPath(pathname);
  const canAccessPage = !requiredModule || canAccessVendorModule(vendor, requiredModule);
  const visibleNav = NAV.filter(({ href }) => {
    const permissionKey = vendorMenuModuleByPath[href];
    return !permissionKey || canAccessVendorModule(vendor, permissionKey);
  });
  const signOut = () => {
    const signin = vendor?.isEmployee ? '/vendor/employee-login' : '/vendor/login';
    logout();
    router.replace(signin);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-white lg:flex">
        <div className="border-b px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{vendor?.isEmployee ? 'Store employee' : 'Vendor portal'}</p>
          <p className="mt-1 truncate font-bold text-slate-800">{vendor?.fName} {vendor?.lName}</p>
          {vendor?.isEmployee && typeof vendor.employeeRoleId === 'object' && (
            <p className="mt-1 truncate text-sm text-slate-600">{vendor.employeeRoleId.name}</p>
          )}
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {visibleNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <button type="button" onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <PortalMobileMenu title={vendor?.isEmployee ? 'Store employee' : 'Vendor portal'} links={visibleNav} onSignOut={signOut} />
        <main className="min-w-0 flex-1">
          {canAccessPage ? children : (
            <section role="alert" className="mx-auto mt-12 max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
              <h1 className="text-xl font-semibold text-slate-900">Access denied</h1>
              <p className="mt-2 text-sm text-slate-600">Your assigned role does not allow access to this page.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Package, ArrowLeftRight, Inbox, ShoppingCart,
  Building2, AlertTriangle, History, LogOut, Warehouse as WarehouseIcon,
} from 'lucide-react';
import warehouseApi from '@/lib/api/warehouse';
import { PortalMobileMenu } from '@/components/portal/PortalMobileMenu';
import { WarehouseContext, type WarehouseProfile } from '@/components/portal/warehouse-context';

const NAV = [
  { href: '/warehouse/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/warehouse/stock', label: 'Stock', icon: Package },
  { href: '/warehouse/history', label: 'Stock History', icon: History },
  { href: '/warehouse/transfers', label: 'Transfers', icon: ArrowLeftRight },
  { href: '/warehouse/requests', label: 'Store Requests', icon: Inbox, motherOnly: true },
  { href: '/warehouse/purchases', label: 'Purchases', icon: ShoppingCart, motherOnly: true },
  { href: '/warehouse/subs', label: 'Sub-Warehouses', icon: Building2, motherOnly: true },
  { href: '/warehouse/expiry', label: 'Expiry', icon: AlertTriangle },
] as const;

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/warehouse/login') return children;
  return <WarehouseWorkspace>{children}</WarehouseWorkspace>;
}

function WarehouseWorkspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<WarehouseProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('warehouse_token');
    if (!token) { router.replace('/warehouse/login'); return; }
    let active = true;
    warehouseApi.get<{ data: WarehouseProfile }>('/warehouse/auth/me')
      .then(({ data }) => {
        if (active && localStorage.getItem('warehouse_token') === token) setProfile(data.data);
      })
      .catch((error) => {
        if (!active || localStorage.getItem('warehouse_token') !== token) return;
        if ([401, 403].includes(error.response?.status)) {
          localStorage.removeItem('warehouse_token');
          router.replace('/warehouse/login');
        } else {
          setProfileError(true);
        }
      });
    return () => { active = false; };
  }, [retry, router]);

  const logout = () => {
    localStorage.removeItem('warehouse_token');
    router.replace('/warehouse/login');
  };

  if (profileError) return (
    <main className="mx-auto max-w-md p-6">
      <p role="alert" className="mb-3 text-sm text-red-700">The warehouse profile could not be loaded.</p>
      <button type="button" className="rounded-lg border px-4 py-2 text-sm font-medium" onClick={() => {
        setProfileError(false);
        setRetry((attempt) => attempt + 1);
      }}>Try again</button>
    </main>
  );
  if (!profile) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading warehouse portal…</div>;

  const isMother = profile.type === 'mother';
  const visibleNav = NAV.filter((item) => !('motherOnly' in item && item.motherOnly && !isMother));
  const canAccessPage = isMother || !NAV.some((item) => 'motherOnly' in item
    && (pathname === item.href || pathname.startsWith(item.href + '/')));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-white lg:flex">
        <div className="border-b px-5 py-5">
          <div className="flex items-center gap-2">
            <WarehouseIcon size={18} className="text-emerald-600" />
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Warehouse</p>
          </div>
          <p className="mt-1 truncate font-bold text-slate-800">{profile.name || 'Portal'}</p>
          {profile.type && <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium capitalize text-emerald-700">{profile.type}</span>}
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
          <button onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <PortalMobileMenu title={profile.name || 'Warehouse portal'} links={visibleNav} onSignOut={logout} />
        <main className="flex-1 p-4 sm:p-6">
          {canAccessPage ? <WarehouseContext.Provider value={profile}>{children}</WarehouseContext.Provider> : (
            <section role="alert" className="rounded-xl border bg-white p-6">
              <h1 className="font-semibold text-slate-900">Access denied</h1>
              <p className="mt-1 text-sm text-slate-600">This section is available to mother warehouses.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

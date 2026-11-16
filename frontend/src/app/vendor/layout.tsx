'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LayoutDashboard, Package, ShoppingBag, Store, LogOut } from 'lucide-react';
import { useVendorStore } from '@/store/vendor.store';

const NAV = [
  { href: '/vendor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vendor/items', label: 'Products', icon: Package },
  { href: '/vendor/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/vendor/stores', label: 'Stores', icon: Store },
] as const;

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrate, hasHydrated, isAuthenticated, logout, vendor } = useVendorStore();

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (hasHydrated && !isAuthenticated()) router.replace('/vendor/login');
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated || !isAuthenticated()) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-white lg:flex">
        <div className="border-b px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Vendor Portal</p>
          <p className="mt-1 truncate font-bold text-slate-800">{vendor?.fName} {vendor?.lName}</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <button onClick={() => { logout(); router.push('/vendor/login'); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <div className="flex flex-1 flex-col">
        <main className="flex-1 pb-16 lg:pb-0">{children}</main>
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white lg:hidden">
          <div className="flex items-center justify-around px-2 py-2">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link key={href} href={href}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium ${active ? 'text-emerald-600' : 'text-slate-500'}`}>
                  <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

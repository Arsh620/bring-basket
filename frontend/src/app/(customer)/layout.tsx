'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Home, ShoppingBag, Heart, Wallet, User } from 'lucide-react';
import { useCustomerStore } from '@/store/customer.store';

const NAV = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/profile', label: 'Profile', icon: User },
] as const;

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrate = useCustomerStore((s) => s.hydrate);

  useEffect(() => { hydrate(); }, [hydrate]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {children}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium transition-colors ${active ? 'text-emerald-600' : 'text-slate-500'}`}>
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

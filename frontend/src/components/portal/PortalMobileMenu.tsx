'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

type NavigationLink = { href: string; label: string; icon: LucideIcon };

export function PortalMobileMenu({ title, links, onSignOut }: {
  title: string;
  links: readonly NavigationLink[];
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b bg-white px-4 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button type="button" variant="outline" size="icon" aria-label="Open navigation" />}>
          <Menu size={18} />
        </SheetTrigger>
        <SheetContent side="left" className="overflow-y-auto">
          <SheetHeader><SheetTitle>{title}</SheetTitle></SheetHeader>
          <nav aria-label={title} className="space-y-1 px-3">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link key={href} href={href} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 font-medium ${active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'}`}>
                  <Icon size={18} aria-hidden="true" /> {label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t p-3">
            <Button type="button" variant="ghost" onClick={onSignOut} className="w-full justify-start text-red-700">
              <LogOut size={17} aria-hidden="true" /> Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
    </header>
  );
}

'use client';

import { LoaderCircle, ShoppingBasket } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function AdminLoadingState({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center bg-[#f5f7fb] px-4 ${
        fullScreen ? 'min-h-screen' : 'min-h-[40vh]'
      }`}
    >
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ffe500] text-[#08234b] shadow-sm">
          <ShoppingBasket size={27} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <LoaderCircle
          size={20}
          aria-hidden="true"
          className="mt-5 animate-spin text-[#0b55ad]"
        />
        <p className="mt-2 text-sm font-semibold text-[#0b2346]">Loading your workspace</p>
        <p className="mt-1 text-xs text-gray-500">Please wait a moment.</p>
      </div>
    </div>
  );
}

export function AdminNavigationLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleNavigationClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
      ) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.hasAttribute('download') || link.target === '_blank') return;

      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === pathname) return;

      pendingRef.current = true;
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        pendingRef.current = false;
        setVisible(false);
      }, 10000);
    };

    document.addEventListener('click', handleNavigationClick);
    return () => {
      document.removeEventListener('click', handleNavigationClick);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname]);

  useEffect(() => {
    if (!pendingRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      pendingRef.current = false;
      setVisible(false);
    }, 180);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#f5f7fb]/75 px-4 backdrop-blur-[2px]">
      <div role="status" aria-live="polite" className="flex flex-col items-center rounded-2xl border border-white/80 bg-white/95 px-8 py-7 text-center shadow-xl shadow-[#0b2346]/10">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ffe500] text-[#08234b] shadow-sm">
          <ShoppingBasket size={27} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <LoaderCircle size={21} aria-hidden="true" className="mt-5 animate-spin text-[#0b55ad]" />
        <p className="mt-2 text-sm font-semibold text-[#0b2346]">Loading page</p>
        <p className="mt-1 text-xs text-gray-500">Please wait a moment.</p>
      </div>
    </div>
  );
}

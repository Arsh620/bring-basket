'use client';

import { useAuthStore } from '@/store/auth.store';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Menu, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api/client';

const pageTitles: Record<string, string> = {
  '/admin/dashboard': 'Overview',
  '/admin/catalog/items': 'Products',
  '/admin/catalog/categories': 'Categories',
  '/admin/catalog/brands': 'Brands',
  '/admin/catalog/units': 'Units',
  '/admin/catalog/unit-groups': 'Unit groups',
  '/admin/catalog/item-batches': 'Item batches',
  '/admin/stores': 'Stores',
  '/admin/modules': 'Modules',
  '/admin/zones': 'Delivery zones',
  '/admin/warehouse': 'Warehouses',
  '/admin/admins': 'Administrators',
  '/admin/roles': 'Admin roles',
  '/admin/inventory/stock-movements': 'Stock movements',
  '/admin/inventory/batch-write-offs': 'Stock write-offs',
  '/admin/inventory/warehouse-stock': 'Warehouse stock',
  '/admin/inventory/stock-transfers': 'Stock transfers',
  '/admin/inventory/store-stock-requests': 'Store stock requests',
};

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { admin, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await api.post('/admin/auth/logout');
    } catch {
      toast.error('Could not notify the server. Your local session has still been signed out.');
    } finally {
      logout();
      router.push('/admin/login');
    }
  };

  const initials = admin
    ? `${admin.fName?.[0] ?? ''}${admin.lName?.[0] ?? ''}`.toUpperCase() || 'A'
    : 'A';

  return (
    <header className="sticky top-0 z-30 flex h-[68px] shrink-0 items-center justify-between border-b border-gray-200/80 bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onMenuClick} aria-label="Open navigation" className="rounded-xl p-2 text-gray-600 transition hover:bg-gray-100 lg:hidden">
          <Menu size={20} />
        </button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-gray-400">Bring Basket</p>
          <h1 className="mt-0.5 text-sm font-bold text-gray-800">{pageTitles[pathname] ?? 'Admin workspace'}</h1>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-gray-50 sm:gap-3 sm:px-3">
          <Avatar className="h-9 w-9 ring-2 ring-[#ffe500]/70">
            <AvatarFallback className="bg-[#071b3b] text-sm font-semibold text-[#ffe500]">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden text-left sm:block">
            <span className="block max-w-36 truncate text-sm font-semibold text-gray-800">
              {admin ? `${admin.fName} ${admin.lName}`.trim() : 'Administrator'}
            </span>
            <span className="mt-0.5 block text-[11px] text-gray-500">Admin account</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem className="gap-2">
            <UserRound size={16} /> Account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="gap-2 text-red-600">
            <LogOut size={16} /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

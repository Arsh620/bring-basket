'use client';

import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User } from 'lucide-react';
import api from '@/lib/api/client';

export function Header() {
  const { admin, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    try { await api.post('/admin/auth/logout'); } catch {}
    logout();
    router.push('/admin/login');
  };

  const initials = admin
    ? `${admin.fName?.[0] ?? ''}${admin.lName?.[0] ?? ''}`.toUpperCase() || 'A'
    : 'A';

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-gray-800">Admin Panel</h1>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-600 text-white text-sm">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-gray-700">
              {admin ? `${admin.fName} ${admin.lName}` : 'Admin'}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem className="gap-2">
            <User size={16} /> Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="gap-2 text-red-600">
            <LogOut size={16} /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

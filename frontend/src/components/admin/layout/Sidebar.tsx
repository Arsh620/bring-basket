'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Package, Tag, Bookmark, Ruler, Layers,
  Store, Map, Building2, Warehouse, ShoppingCart, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Catalog',
    icon: Package,
    children: [
      { label: 'Items', href: '/admin/catalog/items', icon: Package },
      { label: 'Categories', href: '/admin/catalog/categories', icon: Tag },
      { label: 'Brands', href: '/admin/catalog/brands', icon: Bookmark },
      { label: 'Units', href: '/admin/catalog/units', icon: Ruler },
      { label: 'Unit Groups', href: '/admin/catalog/unit-groups', icon: Layers },
      { label: 'Item Batches', href: '/admin/catalog/item-batches', icon: Layers },
    ],
  },
  {
    label: 'Stores',
    icon: Store,
    children: [
      { label: 'Stores', href: '/admin/stores', icon: Store },
      { label: 'Modules', href: '/admin/modules', icon: Layers },
      { label: 'Zones', href: '/admin/zones', icon: Map },
    ],
  },
  {
    label: 'Warehouse',
    icon: Warehouse,
    children: [
      { label: 'Warehouses', href: '/admin/warehouse', icon: Building2 },
    ],
  },
  {
    label: 'Orders',
    href: '/admin/orders',
    icon: ShoppingCart,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<string[]>(['Catalog']);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  return (
    <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-gray-700">
        <span className="text-xl font-bold text-white">Bring Basket</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navItems.map((item) => {
          if (item.children) {
            const isOpen = openGroups.includes(item.label);
            const isActive = item.children.some((c) => pathname.startsWith(c.href));
            return (
              <div key={item.label} className="mb-1">
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <span className="flex items-center gap-3">
                    <item.icon size={18} />
                    {item.label}
                  </span>
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {isOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                          pathname.startsWith(child.href)
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        )}
                      >
                        <child.icon size={16} />
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1',
                pathname === item.href
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

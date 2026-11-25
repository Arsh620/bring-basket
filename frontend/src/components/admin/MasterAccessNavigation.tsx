import Link from 'next/link';
import { LayoutDashboard, Shield, Users } from 'lucide-react';

const routes = [
  { key: 'employees', href: '/master/employees', label: 'Employees', icon: Users },
  { key: 'roles', href: '/master/roles', label: 'Role permissions', icon: Shield },
] as const;

export function MasterAccessNavigation({ current }: { current: 'employees' | 'roles' }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-base font-semibold text-slate-900"><Shield size={18} aria-hidden="true" /> Access management</p>
        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-[#0b438d] hover:underline">
          <LayoutDashboard size={16} aria-hidden="true" /> Operations dashboard
        </Link>
      </div>
      <nav aria-label="Master access management" className="mt-4 flex flex-wrap gap-2">
        {routes.map(({ key, href, label, icon: Icon }) => (
          <Link key={key} href={href} aria-current={current === key ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${current === key
              ? 'border-[#0b438d] bg-[#0b438d] text-white'
              : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
            <Icon size={16} aria-hidden="true" /> {label}
          </Link>
        ))}
      </nav>
    </section>
  );
}

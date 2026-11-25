'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, Users, TrendingUp } from 'lucide-react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import api from '@/lib/api/client';

type Plan = { _id: string; name: string; tier: string; billingCycle: string; price: number; status: boolean };
type Sub = { _id: string; userId: { fName: string; phone: string }; membershipPlanId: { name: string; tier: string }; status: string; endDate: string };
type Dashboard = { active: number; expiring: number; expired: number; plans: number };

export default function MembershipPage() {
  return <AdminLayout><MembershipContent /></AdminLayout>;
}

function MembershipContent() {
  const [tab, setTab] = useState<'dashboard' | 'plans' | 'subscriptions'>('dashboard');
  const dashboardQuery = useQuery({
    queryKey: ['admin-membership', 'dashboard'],
    queryFn: async () => (await api.get<{ data: Dashboard }>('/admin/membership/dashboard')).data.data,
    enabled: tab === 'dashboard',
  });
  const plansQuery = useQuery({
    queryKey: ['admin-membership', 'plans'],
    queryFn: async () => (await api.get<{ data: Plan[] }>('/admin/membership/plans')).data.data,
    enabled: tab === 'plans',
  });
  const subsQuery = useQuery({
    queryKey: ['admin-membership', 'subscriptions'],
    queryFn: async () => (await api.get<{ data: Sub[] }>('/admin/membership/subscriptions')).data.data,
    enabled: tab === 'subscriptions',
  });
  const currentQuery = { dashboard: dashboardQuery, plans: plansQuery, subscriptions: subsQuery }[tab];
  const dashboard = dashboardQuery.data;
  const plans = plansQuery.data ?? [];
  const subs = subsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Membership Plans</h1>
        <p className="mt-0.5 text-sm text-slate-500">Manage customer membership tiers and subscriptions</p>
      </div>

      <div className="flex gap-2">
        {(['dashboard', 'plans', 'subscriptions'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${tab === t ? 'bg-[#08234b] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {currentQuery.isLoading && <p role="status" className="text-sm text-slate-500">Loading membership data…</p>}
      {currentQuery.isError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load membership data. <button type="button" className="font-semibold underline" onClick={() => void currentQuery.refetch()}>Try again</button>
        </p>
      )}
      {tab === 'dashboard' && currentQuery.isSuccess && dashboard && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Active Subscriptions', value: dashboard.active, icon: Users, color: 'text-green-600' },
            { label: 'Expiring in 7 days', value: dashboard.expiring, icon: TrendingUp, color: 'text-yellow-600' },
            { label: 'Expired', value: dashboard.expired, icon: Star, color: 'text-red-500' },
            { label: 'Total Plans', value: dashboard.plans, icon: Star, color: 'text-blue-600' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <stat.icon size={20} className={stat.color} />
              <p className="mt-3 text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'plans' && currentQuery.isSuccess && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Tier</th><th className="px-4 py-3 text-left">Cycle</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-left">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans.length === 0 && <tr><td colSpan={5} className="px-4 py-5 text-center text-slate-500">No membership plans found.</td></tr>}
              {plans.map((p) => (
                <tr key={p._id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{p.tier}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{p.billingCycle}</td>
                  <td className="px-4 py-3 text-right font-medium">₹{p.price}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{p.status ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'subscriptions' && currentQuery.isSuccess && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-4 py-3 text-left">Customer</th><th className="px-4 py-3 text-left">Plan</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Expires</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subs.length === 0 && <tr><td colSpan={4} className="px-4 py-5 text-center text-slate-500">No subscriptions found.</td></tr>}
              {subs.map((s) => (
                <tr key={s._id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{s.userId?.fName} <span className="text-slate-400 text-xs">{s.userId?.phone}</span></td>
                  <td className="px-4 py-3 capitalize text-slate-600">{s.membershipPlanId?.name} ({s.membershipPlanId?.tier})</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span></td>
                  <td className="px-4 py-3 text-slate-600">{new Date(s.endDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

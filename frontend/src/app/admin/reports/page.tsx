'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Package, TrendingUp, Warehouse, Tag, Users, CreditCard, ArrowLeft, ArrowRight } from 'lucide-react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api/client';

type Period = 'today' | 'this_week' | 'this_month' | 'this_year';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_year', label: 'This Year' },
] as const;

const TABS = [
  { key: 'orders', label: 'Orders', icon: BarChart3, endpoint: '/admin/reports/orders' },
  { key: 'items', label: 'Items', icon: Package, endpoint: '/admin/reports/items' },
  { key: 'store-summary', label: 'Store Summary', icon: TrendingUp, endpoint: '/admin/reports/store-summary' },
  { key: 'stock', label: 'Store Stock', icon: Package, endpoint: '/admin/reports/stock' },
  { key: 'warehouse-stock', label: 'Warehouse Stock', icon: Warehouse, endpoint: '/admin/reports/warehouse-stock' },
  { key: 'brands', label: 'Brand Sales', icon: Tag, endpoint: '/admin/reports/brands' },
  { key: 'customers', label: 'Customers', icon: Users, endpoint: '/admin/reports/customers' },
  { key: 'disbursements', label: 'Disbursements', icon: CreditCard, endpoint: '/admin/reports/disbursements' },
] as const;

const INR = (v: unknown) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (v: unknown) => v ? new Date(String(v)).toLocaleDateString('en-IN') : '—';

function SummaryCards({ summary }: { summary: Record<string, unknown> }) {
  const entries = Object.entries(summary).filter(([, v]) => typeof v === 'number');
  if (!entries.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4">
      {entries.slice(0, 8).map(([key, value]) => (
        <Card key={key} className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{key.replace(/_/g, ' ')}</p>
            <p className="mt-1 text-xl font-bold text-[#0b2346]">
              {key.toLowerCase().includes('amount') || key.toLowerCase().includes('sales') || key.toLowerCase().includes('revenue') ? INR(value) : Number(value).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ReportTable({ rows, page, setPage, total }: { rows: Record<string, unknown>[]; page: number; setPage: (p: number) => void; total: number }) {
  if (!rows.length) return <p className="py-12 text-center text-sm text-gray-500">No data for this period.</p>;
  const cols = Object.keys(rows[0]).filter((k) => k !== '__v' && k !== '_id').slice(0, 8);
  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#f5f8fc]">
              {cols.map((c) => <TableHead key={c} className="text-xs font-semibold uppercase tracking-wide text-[#526783]">{c.replace(/_/g, ' ')}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={String(row._id ?? i)} className="hover:bg-[#f8faff]">
                {cols.map((c) => {
                  const v = row[c];
                  const isAmt = c.toLowerCase().includes('amount') || c.toLowerCase().includes('total') || c.toLowerCase().includes('sales') || c.toLowerCase().includes('revenue');
                  const isDate = c.toLowerCase().includes('date') || c.toLowerCase().includes('_at') || c === 'createdAt';
                  return (
                    <TableCell key={c} className="text-sm text-gray-700">
                      {v == null ? '—' : isAmt && typeof v === 'number' ? INR(v) : isDate ? fmtDate(v) : typeof v === 'object' ? String((v as Record<string, unknown>).name ?? (v as Record<string, unknown>)._id ?? '—') : String(v)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
          <span>Page {page} of {pages} · {total} records</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}><ArrowLeft size={14} /> Prev</Button>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next <ArrowRight size={14} /></Button>
          </div>
        </div>
      )}
    </>
  );
}

function ReportContent({ tabKey, endpoint, period }: { tabKey: string; endpoint: string; period: Period }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-report', tabKey, period, page],
    queryFn: async () => (await api.get(endpoint, { params: { filter: period, page, limit: 20 } })).data,
  });

  if (isLoading) return <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-gray-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-[#0b55ad] border-t-transparent" />Loading…</div>;
  if (isError || !data) return <p className="py-10 text-center text-sm text-red-600">Could not load report. Try again.</p>;

  const rows: Record<string, unknown>[] = Array.isArray(data.data) ? data.data : [];
  const summary: Record<string, unknown> = data.summary ?? {};
  const total: number = data.pagination?.total ?? rows.length;

  return (
    <div>
      {Object.keys(summary).length > 0 && <SummaryCards summary={summary} />}
      <ReportTable rows={rows} page={page} setPage={setPage} total={total} />
    </div>
  );
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<string>(TABS[0].key);
  const [period, setPeriod] = useState<Period>('this_month');
  const tab = TABS.find((t) => t.key === activeTab)!;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0755b8]"><BarChart3 size={16} />REPORTS</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0b2346]">Business Reports</h1>
            <p className="mt-1 text-sm text-gray-500">Analytics and performance data across your operations.</p>
          </div>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm outline-none focus:border-[#0b55ad]">
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === t.key ? 'bg-[#0b438d] text-white shadow-sm' : 'border border-[#dce4ef] bg-white text-slate-600 hover:border-[#9db7d9] hover:text-[#0b438d]'}`}>
                <Icon size={14} />{t.label}
              </button>
            );
          })}
        </div>

        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-gray-900">{tab.label} Report</CardTitle>
              <Badge variant="outline" className="capitalize">{period.replace(/_/g, ' ')}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ReportContent key={`${activeTab}-${period}`} tabKey={activeTab} endpoint={tab.endpoint} period={period} />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

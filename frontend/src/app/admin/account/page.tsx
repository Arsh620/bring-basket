'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BookOpen, TrendingUp, FileText, BarChart3, Receipt } from 'lucide-react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api/client';

type Filter = 'today' | 'this_week' | 'this_month' | 'this_year';

const TABS = [
  { key: 'kpis', label: 'KPIs', icon: BarChart3, endpoint: '/admin/account/kpis' },
  { key: 'trial-balance', label: 'Trial Balance', icon: BookOpen, endpoint: '/admin/account/trial-balance' },
  { key: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp, endpoint: '/admin/account/profit-loss' },
  { key: 'balance-sheet', label: 'Balance Sheet', icon: FileText, endpoint: '/admin/account/balance-sheet' },
  { key: 'ledgers', label: 'Ledgers', icon: BookOpen, endpoint: '/admin/account/ledgers' },
  { key: 'journals', label: 'Journals', icon: FileText, endpoint: '/admin/account/journals' },
  { key: 'gstr3b', label: 'GSTR-3B', icon: Receipt, endpoint: '/admin/account/gstr3b' },
  { key: 'gst-summary', label: 'GST Summary', icon: Receipt, endpoint: '/admin/account/gst-summary' },
  { key: 'hsn-summary', label: 'HSN Summary', icon: Receipt, endpoint: '/admin/account/hsn-summary' },
  { key: 'payable-aging', label: 'Payable Aging', icon: FileText, endpoint: '/admin/account/payable-aging' },
  { key: 'grn-register', label: 'GRN Register', icon: FileText, endpoint: '/admin/account/grn-register' },
  { key: 'payment-register', label: 'Payment Register', icon: Receipt, endpoint: '/admin/account/payment-register' },
] as const;

const INR = (v: unknown) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: unknown) => Number(v || 0).toLocaleString('en-IN');
const pct = (v: unknown) => `${Number(v || 0).toFixed(2)}%`;
const dt = (v: unknown) => v ? new Date(String(v)).toLocaleDateString('en-IN') : '—';

function KpiCards({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => typeof v === 'number');
  if (!entries.length) return <p className="py-8 text-center text-sm text-gray-500">No KPI data available.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 p-5">
      {entries.map(([key, value]) => (
        <Card key={key} className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{key.replace(/_/g, ' ')}</p>
            <p className="mt-1 text-xl font-bold text-[#0b2346]">
              {key.toLowerCase().includes('rate') || key.toLowerCase().includes('pct') ? pct(value) : key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('revenue') || key.toLowerCase().includes('profit') || key.toLowerCase().includes('loss') ? INR(value) : num(value)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TrialBalanceTable({ rows }: { rows: { ledger: string; debit: number; credit: number }[] }) {
  if (!rows?.length) return <p className="py-8 text-center text-sm text-gray-500">No trial balance data.</p>;
  const totalDebit = rows.reduce((s, r) => s + (r.debit || 0), 0);
  const totalCredit = rows.reduce((s, r) => s + (r.credit || 0), 0);
  return (
    <Table>
      <TableHeader><TableRow className="bg-[#f5f8fc]"><TableHead>Ledger</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i} className="hover:bg-[#f8faff]">
            <TableCell className="font-medium text-gray-800">{r.ledger}</TableCell>
            <TableCell className="text-right text-gray-700">{r.debit ? INR(r.debit) : '—'}</TableCell>
            <TableCell className="text-right text-gray-700">{r.credit ? INR(r.credit) : '—'}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-[#f0f5fc] font-bold">
          <TableCell>Total</TableCell>
          <TableCell className="text-right">{INR(totalDebit)}</TableCell>
          <TableCell className="text-right">{INR(totalCredit)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function PLTable({ data }: { data: Record<string, unknown> }) {
  const sections = ['revenue', 'expenses', 'grossProfit', 'netProfit', 'operatingProfit'];
  return (
    <div className="divide-y divide-gray-100 p-5">
      {sections.filter((s) => data[s] != null).map((s) => (
        <div key={s} className="flex items-center justify-between py-3">
          <span className="text-sm font-medium capitalize text-gray-700">{s.replace(/([A-Z])/g, ' $1')}</span>
          <span className={`text-sm font-bold ${String(s).includes('Profit') ? 'text-emerald-700' : String(s).includes('expense') ? 'text-red-600' : 'text-[#0b2346]'}`}>
            {INR(data[s])}
          </span>
        </div>
      ))}
      {Object.entries(data).filter(([k]) => !sections.includes(k) && typeof data[k] === 'number').map(([k, v]) => (
        <div key={k} className="flex items-center justify-between py-3">
          <span className="text-sm font-medium capitalize text-gray-700">{k.replace(/_/g, ' ')}</span>
          <span className="text-sm font-bold text-[#0b2346]">{INR(v)}</span>
        </div>
      ))}
    </div>
  );
}

function GstTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows?.length) return <p className="py-8 text-center text-sm text-gray-500">No GST data for this period.</p>;
  const cols = Object.keys(rows[0]).filter((k) => k !== '__v' && k !== '_id').slice(0, 8);
  return (
    <Table>
      <TableHeader><TableRow className="bg-[#f5f8fc]">{cols.map((c) => <TableHead key={c} className="text-xs font-semibold uppercase tracking-wide text-[#526783]">{c.replace(/_/g, ' ')}</TableHead>)}</TableRow></TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i} className="hover:bg-[#f8faff]">
            {cols.map((c) => {
              const v = r[c];
              const isAmt = c.toLowerCase().includes('amount') || c.toLowerCase().includes('tax') || c.toLowerCase().includes('value') || c.toLowerCase().includes('total');
              return <TableCell key={c} className="text-sm text-gray-700">{v == null ? '—' : isAmt && typeof v === 'number' ? INR(v) : c.toLowerCase().includes('date') ? dt(v) : String(v)}</TableCell>;
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PaginatedTable({ rows, page, setPage, total }: { rows: Record<string, unknown>[]; page: number; setPage: (p: number) => void; total: number }) {
  if (!rows?.length) return <p className="py-8 text-center text-sm text-gray-500">No records found.</p>;
  const cols = Object.keys(rows[0]).filter((k) => k !== '__v').slice(0, 7);
  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="bg-[#f5f8fc]">{cols.map((c) => <TableHead key={c} className="text-xs font-semibold uppercase tracking-wide text-[#526783]">{c.replace(/_/g, ' ')}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={String(r._id ?? i)} className="hover:bg-[#f8faff]">
                {cols.map((c) => {
                  const v = r[c];
                  const isAmt = c.toLowerCase().includes('amount') || c.toLowerCase().includes('total') || c.toLowerCase().includes('balance');
                  return <TableCell key={c} className="text-sm text-gray-700">{v == null ? '—' : isAmt && typeof v === 'number' ? INR(v) : c.toLowerCase().includes('date') ? dt(v) : typeof v === 'object' ? String((v as Record<string, unknown>).name ?? (v as Record<string, unknown>)._id ?? '—') : String(v)}</TableCell>;
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

function TabContent({ tabKey, endpoint, filter }: { tabKey: string; endpoint: string; filter: Filter }) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-account', tabKey, filter, page],
    queryFn: async () => (await api.get(endpoint, { params: { filter, page, limit: 20 } })).data,
  });

  if (isLoading) return <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-gray-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-[#0b55ad] border-t-transparent" /> Loading…</div>;
  if (isError || !data) return <p className="py-10 text-center text-sm text-red-600">Could not load data. Try again.</p>;

  const d = data.data;

  if (tabKey === 'kpis') return <KpiCards data={d as Record<string, unknown>} />;
  if (tabKey === 'trial-balance') return <div className="overflow-x-auto"><TrialBalanceTable rows={(d as { rows: { ledger: string; debit: number; credit: number }[] }).rows ?? []} /></div>;
  if (tabKey === 'profit-loss') return <PLTable data={d as Record<string, unknown>} />;
  if (tabKey === 'balance-sheet') return <PLTable data={d as Record<string, unknown>} />;
  if (tabKey === 'gst-summary' || tabKey === 'hsn-summary') return <div className="overflow-x-auto"><GstTable rows={(d as { rows: Record<string, unknown>[] }).rows ?? (Array.isArray(d) ? d : [])} /></div>;
  if (tabKey === 'gstr3b') return <KpiCards data={d as Record<string, unknown>} />;

  const rows: Record<string, unknown>[] = Array.isArray(d) ? d : [];
  const total: number = data.pagination?.total ?? rows.length;
  return <PaginatedTable rows={rows} page={page} setPage={setPage} total={total} />;
}

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<string>(TABS[0].key);
  const [filter, setFilter] = useState<Filter>('this_month');
  const tab = TABS.find((t) => t.key === activeTab)!;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0755b8]"><BookOpen size={16} /> ACCOUNTING & GST</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0b2346]">Accounting & GST Reports</h1>
            <p className="mt-1 text-sm text-gray-500">Ledger, journals, trial balance and GST compliance reports.</p>
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm outline-none focus:border-[#0b55ad]">
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="this_year">This Year</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${activeTab === t.key ? 'bg-[#0b438d] text-white shadow-sm' : 'border border-[#dce4ef] bg-white text-slate-600 hover:border-[#9db7d9] hover:text-[#0b438d]'}`}>
                <Icon size={13} />{t.label}
              </button>
            );
          })}
        </div>

        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-gray-900">{tab.label}</CardTitle>
              <Badge variant="outline" className="capitalize">{filter.replace(/_/g, ' ')}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <TabContent key={`${activeTab}-${filter}`} tabKey={activeTab} endpoint={tab.endpoint} filter={filter} />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

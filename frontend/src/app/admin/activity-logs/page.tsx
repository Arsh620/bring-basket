'use client';

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import api from '@/lib/api/client';

type Log = { _id: string; actorType: string; actorId: string; action: string; entity: string; entityId?: string; createdAt: string };

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    api.get('/admin/activity-logs').then((r) => setLogs(r.data.data || [])).catch(() => {});
  }, []);

  return (
    <AdminLayout>
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText size={22} className="text-[#08234b]" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Activity Logs</h1>
          <p className="text-sm text-slate-500">Audit trail of admin actions</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Actor</th><th className="px-4 py-3 text-left">Action</th><th className="px-4 py-3 text-left">Entity</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No activity logs found.</td></tr>}
            {logs.map((l) => (
              <tr key={l._id}>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-700 capitalize">{l.actorType}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{l.action}</td>
                <td className="px-4 py-3 text-slate-600">{l.entity} {l.entityId ? <span className="text-xs text-slate-400">#{l.entityId.slice(-6)}</span> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </AdminLayout>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Bell, Send } from 'lucide-react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import api from '@/lib/api/client';

type Notif = { _id: string; title: string; description: string; topic?: string };
type AutoMsg = { _id: string; title: string; trigger: string; status: boolean };

export default function NotificationsPage() {
  const [tab, setTab] = useState<'templates' | 'automated' | 'broadcast'>('templates');
  const [templates, setTemplates] = useState<Notif[]>([]);
  const [autoMsgs, setAutoMsgs] = useState<AutoMsg[]>([]);
  const [broadcast, setBroadcast] = useState({ title: '', description: '', topic: 'all' });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/admin/notifications').then((r) => setTemplates(r.data.data || [])).catch(() => {});
    api.get('/admin/automated-messages').then((r) => setAutoMsgs(r.data.data || [])).catch(() => {});
  }, []);

  const sendBroadcast = async () => {
    setSending(true);
    try {
      await api.post('/admin/notifications/broadcast', broadcast);
      setMsg('Broadcast sent!');
      setBroadcast({ title: '', description: '', topic: 'all' });
    } catch { setMsg('Failed to send broadcast'); }
    finally { setSending(false); }
  };

  return (
    <AdminLayout>
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell size={22} className="text-[#08234b]" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">Push templates, automated messages and broadcasts</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['templates', 'automated', 'broadcast'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${tab === t ? 'bg-[#08234b] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {msg && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{msg}</div>}

      {tab === 'templates' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-4 py-3 text-left">Title</th><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-left">Topic</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.map((n) => (
                <tr key={n._id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{n.title}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{n.description}</td>
                  <td className="px-4 py-3 text-slate-500">{n.topic || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => api.post(`/admin/notifications/${n._id}/send`, {}).then(() => setMsg('Sent!'))}
                      className="flex items-center gap-1 rounded-lg bg-[#08234b] px-3 py-1.5 text-xs text-white hover:bg-[#0a2d5e]">
                      <Send size={11} /> Send
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'automated' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-4 py-3 text-left">Title</th><th className="px-4 py-3 text-left">Trigger</th><th className="px-4 py-3 text-left">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {autoMsgs.map((m) => (
                <tr key={m._id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{m.title}</td>
                  <td className="px-4 py-3 text-slate-600">{m.trigger}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.status ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{m.status ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'broadcast' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 max-w-lg">
          <h2 className="font-semibold text-slate-800">Send Broadcast Notification</h2>
          <div className="space-y-3">
            <input value={broadcast.title} onChange={(e) => setBroadcast((b) => ({ ...b, title: e.target.value }))}
              placeholder="Title" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#08234b]" />
            <textarea value={broadcast.description} onChange={(e) => setBroadcast((b) => ({ ...b, description: e.target.value }))}
              placeholder="Message" rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#08234b]" />
            <select value={broadcast.topic} onChange={(e) => setBroadcast((b) => ({ ...b, topic: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="all">All Users</option>
              <option value="customer">Customers</option>
              <option value="deliveryman">Delivery Men</option>
            </select>
          </div>
          <button onClick={sendBroadcast} disabled={sending || !broadcast.title}
            className="flex items-center gap-2 rounded-xl bg-[#08234b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0a2d5e] disabled:opacity-50">
            <Send size={14} /> {sending ? 'Sending...' : 'Send Broadcast'}
          </button>
        </div>
      )}
    </div>
    </AdminLayout>
  );
}

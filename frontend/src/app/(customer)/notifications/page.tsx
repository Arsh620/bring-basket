'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomerStore } from '@/store/customer.store';
import customerApi from '@/lib/api/customer';

interface Notification {
  _id: string;
  title: string;
  description?: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

const date = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, hydrate, hasHydrated } = useCustomerStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated()) { router.push('/login'); return; }
    load();
  }, [hasHydrated, isAuthenticated, router]);

  const load = async () => {
    try {
      const res = await customerApi.get('/customer/notifications?limit=50');
      setNotifications(res.data.data);
      setUnread(res.data.data.filter((n: Notification) => !n.isRead).length);
    } catch { toast.error('Could not load notifications'); }
  };

  const markAllRead = async () => {
    try {
      await customerApi.put('/customer/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
      toast.success('All marked as read');
    } catch { toast.error('Failed'); }
  };

  const markRead = async (id: string) => {
    try {
      await customerApi.put(`/customer/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
      setUnread((u) => Math.max(0, u - 1));
    } catch { /* silent */ }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 border-b bg-white px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Notifications</h1>
            {unread > 0 && <p className="text-xs text-slate-500">{unread} unread</p>}
          </div>
          {unread > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-emerald-500 hover:text-emerald-600">
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4">
        {notifications.length === 0 ? (
          <div className="mt-16 text-center">
            <Bell className="mx-auto mb-3 text-slate-300" size={40} />
            <p className="font-medium text-slate-600">No notifications yet</p>
            <p className="mt-1 text-sm text-slate-400">We'll notify you about orders and offers</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={n._id} onClick={() => !n.isRead && markRead(n._id)}
                className={`cursor-pointer rounded-2xl border p-4 transition ${n.isRead ? 'bg-white' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.isRead ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-600'}`}>
                    <Bell size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${n.isRead ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</p>
                    {n.description && <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.description}</p>}
                    <p className="mt-1 text-xs text-slate-400">{date(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

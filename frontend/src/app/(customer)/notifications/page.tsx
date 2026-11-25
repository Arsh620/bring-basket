'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { customerAccountId, useCustomerStore } from '@/store/customer.store';
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
  const { token, customer, hydrate, hasHydrated } = useCustomerStore();
  const queryClient = useQueryClient();
  const accountId = customerAccountId(customer, token);
  const queryKey = ['customer-notifications', accountId];

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (hasHydrated && !token) router.replace('/login');
  }, [hasHydrated, token, router]);

  const query = useQuery({
    queryKey,
    enabled: hasHydrated && Boolean(token && accountId),
    queryFn: async ({ signal }) =>
      (await customerApi.get<{ data: Notification[] }>('/customer/notifications?limit=50', { signal })).data.data ?? [],
  });
  const notifications = query.data ?? [];
  const unread = notifications.filter((notification) => !notification.isRead).length;

  const markInCache = async (id?: string) => {
    await queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData<Notification[]>(queryKey, (current) =>
      current?.map((notification) =>
        !id || notification._id === id ? { ...notification, isRead: true } : notification));
  };

  const markAllRead = async () => {
    try {
      await customerApi.put('/customer/notifications/read-all');
      await markInCache();
      toast.success('All marked as read');
    } catch { toast.error('Failed'); }
  };

  const markRead = async (id: string) => {
    try {
      await customerApi.put(`/customer/notifications/${id}/read`);
      await markInCache(id);
    } catch { toast.error('Could not mark notification as read'); }
  };

  if (!hasHydrated || !token) return null;

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
        {query.isPending ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading notifications…</p> : query.isError ? (
          <div className="py-8 text-center">
            <p role="alert">Could not load notifications.</p>
            <button type="button" className="mt-2 underline" onClick={() => void query.refetch()}>Try again</button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="mt-16 text-center">
            <Bell className="mx-auto mb-3 text-slate-300" size={40} />
            <p className="font-medium text-slate-600">No notifications yet</p>
            <p className="mt-1 text-sm text-slate-400">Order updates and offers will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <button key={n._id} type="button" disabled={n.isRead} onClick={() => void markRead(n._id)}
                className={`block w-full rounded-2xl border p-4 text-left transition ${n.isRead ? 'bg-white' : 'border-emerald-200 bg-emerald-50'}`}>
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
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

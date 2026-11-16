'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, LogOut, ChevronRight, Star, Wallet, Bell, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomerStore } from '@/store/customer.store';
import customerApi from '@/lib/api/customer';

interface CustomerInfo {
  _id: string;
  fName: string;
  lName?: string;
  email?: string;
  phone?: string;
  image?: string;
  walletBalance: number;
  loyaltyPoint: number;
  currentMembershipTier: string;
  orderCount: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, logout, hydrate, hasHydrated } = useCustomerStore();
  const [info, setInfo] = useState<CustomerInfo | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fName: '', lName: '', email: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated()) { router.push('/login'); return; }
    customerApi.get('/customer/info').then((res) => {
      setInfo(res.data.data);
      setForm({ fName: res.data.data.fName || '', lName: res.data.data.lName || '', email: res.data.data.email || '' });
    }).catch(() => toast.error('Could not load profile'));
  }, [hasHydrated, isAuthenticated, router]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await customerApi.post('/customer/update-profile', form);
      setInfo((prev) => prev ? { ...prev, ...res.data.data } : prev);
      setEditing(false);
      toast.success('Profile updated');
    } catch { toast.error('Update failed'); }
    finally { setBusy(false); }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!info) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
    </div>
  );

  const currency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-emerald-600 px-5 pb-8 pt-6 text-white">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-white">
            {info.image ? <img src={info.image} alt="avatar" className="h-full w-full rounded-full object-cover" /> : <User size={28} />}
          </div>
          <div>
            <h1 className="text-xl font-bold">{info.fName} {info.lName}</h1>
            <p className="text-sm text-emerald-100">{info.email || info.phone}</p>
            <span className="mt-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold capitalize">{info.currentMembershipTier} member</span>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Orders', value: info.orderCount },
            { label: 'Wallet', value: currency(info.walletBalance) },
            { label: 'Points', value: Math.floor(info.loyaltyPoint) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-white/15 p-3 text-center">
              <p className="text-lg font-bold">{value}</p>
              <p className="text-xs text-emerald-100">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 py-5">
        {/* Edit Profile */}
        {editing ? (
          <form onSubmit={handleUpdate} className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
            <h2 className="font-semibold text-slate-800">Edit Profile</h2>
            {[
              { key: 'fName', label: 'First name', placeholder: 'First name' },
              { key: 'lName', label: 'Last name', placeholder: 'Last name' },
              { key: 'email', label: 'Email', placeholder: 'Email' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
                <input value={form[key as keyof typeof form]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-500" />
              </div>
            ))}
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-xl border py-2 text-sm font-semibold text-slate-600">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setEditing(true)} className="flex w-full items-center justify-between rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><User size={18} /></div>
              <span className="font-medium text-slate-800">Edit Profile</span>
            </div>
            <ChevronRight size={18} className="text-slate-400" />
          </button>
        )}

        {/* Quick Links */}
        {[
          { href: '/wallet', icon: Wallet, label: 'Wallet & Transactions', color: 'bg-blue-50 text-blue-600' },
          { href: '/loyalty', icon: Star, label: 'Loyalty Points', color: 'bg-yellow-50 text-yellow-600' },
          { href: '/notifications', icon: Bell, label: 'Notifications', color: 'bg-purple-50 text-purple-600' },
          { href: '/orders', icon: ShieldCheck, label: 'My Orders', color: 'bg-emerald-50 text-emerald-600' },
        ].map(({ href, icon: Icon, label, color }) => (
          <a key={href} href={href} className="flex items-center justify-between rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon size={18} /></div>
              <span className="font-medium text-slate-800">{label}</span>
            </div>
            <ChevronRight size={18} className="text-slate-400" />
          </a>
        ))}

        {/* Logout */}
        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600"><LogOut size={18} /></div>
          <span className="font-medium text-red-600">Sign out</span>
        </button>
      </div>
    </main>
  );
}

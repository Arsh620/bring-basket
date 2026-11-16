'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, Plus, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomerStore } from '@/store/customer.store';
import customerApi from '@/lib/api/customer';
import { RazorpayButton } from '@/components/payment/RazorpayButton';

interface Transaction {
  _id: string;
  type: 'credit' | 'debit';
  amount: number;
  balance: number;
  referenceType?: string;
  note?: string;
  createdAt: string;
}

const currency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
const date = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function WalletPage() {
  const router = useRouter();
  const { isAuthenticated, hydrate, hasHydrated } = useCustomerStore();
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [addAmount, setAddAmount] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated()) { router.push('/login'); return; }
    loadData();
  }, [hasHydrated, isAuthenticated, router, page]);

  const loadData = async () => {
    try {
      const [balRes, txnRes] = await Promise.all([
        customerApi.get('/customer/wallet/balance'),
        customerApi.get(`/customer/wallet/transactions?page=${page}&limit=15`),
      ]);
      setBalance(balRes.data.data.balance);
      setTxns(txnRes.data.data);
      setTotal(txnRes.data.pagination.total);
    } catch { toast.error('Could not load wallet'); }
  };

  const handleAddFund = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(addAmount);
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    setBusy(true);
    try {
      const res = await customerApi.post('/customer/wallet/add-fund', { amount });
      setBalance(res.data.data.balance);
      if (res.data.data.bonus > 0) toast.success(`₹${amount} added + ₹${res.data.data.bonus} bonus!`);
      else toast.success(`₹${amount} added to wallet`);
      setAddAmount(''); setShowAdd(false);
      loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Add fund failed');
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-5 pb-8 pt-6 text-white">
        <p className="text-sm text-blue-100">Wallet Balance</p>
        <p className="mt-1 text-4xl font-bold">{currency(balance)}</p>
        <button onClick={() => setShowAdd(!showAdd)}
          className="mt-4 flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold transition hover:bg-white/30">
          <Plus size={16} /> Add Money
        </button>
      </div>

      {/* Add Fund Form */}
      {showAdd && (
        <div className="mx-4 -mt-4 rounded-2xl border bg-white p-5 shadow-md">
          <h3 className="mb-3 font-semibold text-slate-800">Add Money to Wallet</h3>

          {/* Quick amount selector */}
          <div className="mb-3 flex gap-2">
            {[100, 200, 500, 1000].map((amt) => (
              <button key={amt} type="button" onClick={() => setAddAmount(String(amt))}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  addAmount === String(amt) ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:border-emerald-400'
                }`}>
                ₹{amt}
              </button>
            ))}
          </div>

          <input type="number" value={addAmount} onChange={(e) => setAddAmount(e.target.value)}
            placeholder="Or enter custom amount" min={1} max={100000}
            className="mb-3 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />

          {/* Payment options */}
          <div className="space-y-2">
            {/* Razorpay */}
            {Number(addAmount) > 0 && (
              <RazorpayButton
                purpose="wallet_topup"
                amount={Number(addAmount)}
                label={`Pay ₹${addAmount} via Razorpay`}
                onSuccess={() => { setAddAmount(''); setShowAdd(false); loadData(); }}
              />
            )}

            {/* COD / Manual (for testing) */}
            <form onSubmit={handleAddFund} className="flex gap-2">
              <button type="submit" disabled={busy || !addAmount}
                className="w-full rounded-xl border py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">
                {busy ? '…' : 'Add (Test/Manual)'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="px-4 py-5">
        <h2 className="mb-3 font-semibold text-slate-800">Transactions ({total})</h2>
        {txns.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">
            <Wallet className="mx-auto mb-2 text-slate-300" size={32} />
            <p className="text-sm">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {txns.map((txn) => (
              <div key={txn._id} className="flex items-center gap-3 rounded-2xl border bg-white p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${txn.type === 'credit' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                  {txn.type === 'credit' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{txn.note || txn.referenceType || 'Transaction'}</p>
                  <p className="text-xs text-slate-500">{date(txn.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${txn.type === 'credit' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {txn.type === 'credit' ? '+' : '-'}{currency(txn.amount)}
                  </p>
                  <p className="text-xs text-slate-400">Bal: {currency(txn.balance)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 15 && (
          <div className="mt-4 flex justify-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Previous</button>
            <button disabled={page * 15 >= total} onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </main>
  );
}

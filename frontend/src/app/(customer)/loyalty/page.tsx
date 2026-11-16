'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomerStore } from '@/store/customer.store';
import customerApi from '@/lib/api/customer';

interface LoyaltyTxn {
  _id: string;
  type: 'credit' | 'debit';
  points: number;
  balance: number;
  transactionType: string;
  note?: string;
  createdAt: string;
}

const date = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function LoyaltyPage() {
  const router = useRouter();
  const { isAuthenticated, hydrate, hasHydrated } = useCustomerStore();
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<LoyaltyTxn[]>([]);
  const [transferPoints, setTransferPoints] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated()) { router.push('/login'); return; }
    customerApi.get('/customer/loyalty-point/transactions').then((res) => {
      setBalance(res.data.data.balance || 0);
      setTxns(res.data.data.transactions || []);
    }).catch(() => toast.error('Could not load loyalty points'));
  }, [hasHydrated, isAuthenticated, router]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const points = Number(transferPoints);
    if (!points || points <= 0) return toast.error('Enter valid points');
    if (points > balance) return toast.error('Insufficient points');
    setBusy(true);
    try {
      const res = await customerApi.post('/customer/loyalty-point/point-transfer', { points });
      setBalance(res.data.data.loyaltyPoint);
      toast.success(`${points} points converted to wallet!`);
      setTransferPoints('');
      customerApi.get('/customer/loyalty-point/transactions').then((r) => setTxns(r.data.data.transactions || []));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Transfer failed');
    } finally { setBusy(false); }
  };

  const txnLabel: Record<string, string> = {
    order_earn: 'Earned from order',
    order_redeem: 'Redeemed on order',
    admin_credit: 'Admin credit',
    admin_debit: 'Admin debit',
    convert_to_wallet: 'Converted to wallet',
    expire: 'Points expired',
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-yellow-500 to-orange-500 px-5 pb-8 pt-6 text-white">
        <p className="text-sm text-yellow-100">Loyalty Points</p>
        <div className="mt-1 flex items-end gap-2">
          <p className="text-4xl font-bold">{Math.floor(balance)}</p>
          <p className="mb-1 text-lg text-yellow-100">pts</p>
        </div>
        <p className="mt-1 text-xs text-yellow-100">1 point = ₹1 wallet balance</p>
      </div>

      {/* Convert to Wallet */}
      {balance > 0 && (
        <div className="mx-4 -mt-4 rounded-2xl border bg-white p-5 shadow-md">
          <h3 className="mb-3 font-semibold text-slate-800">Convert to Wallet</h3>
          <form onSubmit={handleTransfer} className="flex gap-2">
            <input type="number" value={transferPoints} onChange={(e) => setTransferPoints(e.target.value)}
              placeholder={`Max ${Math.floor(balance)} pts`} min={1} max={Math.floor(balance)}
              className="flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-yellow-500" />
            <button type="submit" disabled={busy}
              className="flex items-center gap-1 rounded-xl bg-yellow-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              Convert <ArrowRight size={14} />
            </button>
          </form>
        </div>
      )}

      {/* Transactions */}
      <div className="px-4 py-5">
        <h2 className="mb-3 font-semibold text-slate-800">History</h2>
        {txns.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">
            <Star className="mx-auto mb-2 text-slate-300" size={32} />
            <p className="text-sm">No loyalty transactions yet</p>
            <p className="mt-1 text-xs text-slate-400">Earn points by placing orders</p>
          </div>
        ) : (
          <div className="space-y-2">
            {txns.map((txn) => (
              <div key={txn._id} className="flex items-center gap-3 rounded-2xl border bg-white p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${txn.type === 'credit' ? 'bg-yellow-50 text-yellow-600' : 'bg-slate-100 text-slate-500'}`}>
                  <Star size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{txn.note || txnLabel[txn.transactionType] || txn.transactionType}</p>
                  <p className="text-xs text-slate-500">{date(txn.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${txn.type === 'credit' ? 'text-yellow-600' : 'text-slate-500'}`}>
                    {txn.type === 'credit' ? '+' : '-'}{txn.points} pts
                  </p>
                  <p className="text-xs text-slate-400">Bal: {Math.floor(txn.balance)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

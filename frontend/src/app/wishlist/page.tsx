'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { customerAccountId, useCustomerStore } from '@/store/customer.store';
import customerApi from '@/lib/api/customer';

interface SavedProduct {
  _id: string;
  name: string;
  price: number;
  moduleId: string;
  image?: string;
  stock?: number;
}
type WishlistItem = { _id: string; itemId: SavedProduct };

const currency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function WishlistPage() {
  const router = useRouter();
  const { token, customer, hydrate, hasHydrated } = useCustomerStore();
  const queryClient = useQueryClient();
  const accountId = customerAccountId(customer, token);
  const queryKey = ['customer-wishlist', accountId];
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (hasHydrated && !token) router.replace('/login');
  }, [hasHydrated, token, router]);

  const query = useQuery({
    queryKey,
    enabled: hasHydrated && Boolean(token && accountId),
    queryFn: async ({ signal }) => {
      const { data } = await customerApi.get<{ data: Array<{ _id: string; itemId: SavedProduct | null }> }>('/customer/wish-list', { signal });
      return (data.data ?? []).filter((row): row is WishlistItem => row.itemId !== null);
    },
  });
  const items = query.data ?? [];

  const remove = async (itemId: string) => {
    setBusy(itemId);
    try {
      await customerApi.delete('/customer/wish-list/remove', { data: { item_id: itemId } });
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData<WishlistItem[]>(queryKey, (current) => current?.filter((item) => item.itemId._id !== itemId));
      toast.success('Removed from wishlist');
    } catch { toast.error('Remove failed'); }
    finally { setBusy(null); }
  };

  const addToCart = async (item: SavedProduct) => {
    setBusy(item._id + '_cart');
    try {
      await customerApi.post('/customer/cart/add', { item_id: item._id, model: 'Item', price: item.price, quantity: 1 }, {
        headers: { moduleId: item.moduleId },
      });
      toast.success('Added to cart');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Could not add to cart');
    } finally { setBusy(null); }
  };

  if (!hasHydrated || !token) return null;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 border-b bg-white px-4 py-4">
        <h1 className="text-lg font-bold text-slate-800">Wishlist ({items.length})</h1>
      </div>

      <div className="px-4 py-4">
        {query.isPending ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading wishlist…</p> : query.isError ? (
          <div className="py-8 text-center">
            <p role="alert">Could not load wishlist.</p>
            <button type="button" className="mt-2 underline" onClick={() => void query.refetch()}>Try again</button>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-16 text-center">
            <Heart className="mx-auto mb-3 text-slate-300" size={40} />
            <p className="font-medium text-slate-600">Your wishlist is empty</p>
            <p className="mt-1 text-sm text-slate-400">Save items you love to buy later</p>
            <Link href="/home" className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((w) => (
              <div key={w._id} className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {w.itemId.image ? (
                    <Image src={w.itemId.image} alt={w.itemId.name} width={64} height={64} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      <ShoppingCart size={20} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{w.itemId.name}</p>
                  <p className="mt-0.5 font-bold text-emerald-600">{currency(w.itemId.price)}</p>
                  {w.itemId.stock === 0 && (
                    <span className="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">Out of stock</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => addToCart(w.itemId)}
                    disabled={!w.itemId.moduleId || busy === w.itemId._id + '_cart' || w.itemId.stock === 0}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    <ShoppingCart size={13} /> Add
                  </button>
                  <button
                    onClick={() => remove(w.itemId._id)}
                    disabled={busy === w.itemId._id}
                    className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium text-red-500 disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

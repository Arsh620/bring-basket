'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

type Banner = { _id: string; title?: string; image: string; type: string; url?: string };
type Category = { _id: string; name: string; image?: string };
type Store = { _id: string; name: string; logo?: string; address?: string; rating?: string; deliveryTime?: string; minimumOrder?: number };
type Item = { _id: string; name: string; image?: string; price: number; mrp?: number; discount?: number; discountType?: string; stock: number };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  return data.data as T;
}

const currency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function HomePage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [popular, setPopular] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    let active = true;
    const loadHome = async () => {
      const results = await Promise.allSettled([
        get<Banner[]>('/customer/banners'),
        get<Category[]>('/customer/categories?limit=10'),
        get<Store[]>('/customer/stores?limit=8'),
        get<Item[]>('/customer/items/popular?limit=8'),
      ] as const);
      if (!active) return;

      const [bannerResult, categoryResult, storeResult, popularResult] = results;
      if (bannerResult.status === 'fulfilled') setBanners(bannerResult.value);
      if (categoryResult.status === 'fulfilled') setCategories(categoryResult.value);
      if (storeResult.status === 'fulfilled') setStores(storeResult.value);
      if (popularResult.status === 'fulfilled') setPopular(popularResult.value);

      const failed = results.find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') {
        setLoadError(failed.reason instanceof Error ? failed.reason.message : 'Some homepage content could not be loaded.');
      }
    };
    void loadHome();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!search.trim()) return;
    let active = true;
    const timer = setTimeout(async () => {
      if (!active) return;
      setSearching(true);
      setSearchError('');
      setSearchResults([]);
      try {
        const results = await get<Item[]>(`/customer/items/search?name=${encodeURIComponent(search)}&limit=6`);
        if (active) setSearchResults(results);
      } catch (error) {
        if (active) {
          setSearchResults([]);
          setSearchError(error instanceof Error ? error.message : 'Search failed.');
        }
      }
      finally {
        if (active) setSearching(false);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-emerald-700 px-5 py-4 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Bring Basket</h1>
            <div className="flex gap-3 text-sm">
              <Link href="/shop" className="underline">Cart</Link>
              <Link href="/deliveryman/login" className="underline">Delivery</Link>
              <Link href="/admin/login" className="underline">Admin</Link>
            </div>
          </div>
          <div className="relative mt-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="w-full rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none"
            />
            {search && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border bg-white shadow-lg">
                {searching && <p className="px-4 py-3 text-sm text-slate-500">Searching...</p>}
                {!searching && searchError && <p className="px-4 py-3 text-sm text-red-600">{searchError}</p>}
                {!searching && !searchError && searchResults.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No results found</p>}
                {searchResults.map((item) => (
                  <Link key={item._id} href={`/shop?item=${item._id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    {item.image && <img src={item.image} alt={item.name} className="h-10 w-10 rounded-lg object-cover" />}
                    <div>
                      <p className="text-sm font-medium text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">{currency(item.price)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-5 py-6">
        {loadError && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError}</p>}
        {banners.length > 0 && (
          <section>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {banners.map((b) => (
                <div key={b._id} className="relative h-36 w-72 shrink-0 overflow-hidden rounded-2xl bg-slate-200">
                  {b.image && <img src={b.image} alt={b.title ?? 'Banner'} className="h-full w-full object-cover" />}
                  {b.title && <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 px-4 py-3"><p className="text-sm font-semibold text-white">{b.title}</p></div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {categories.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-800">Categories</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {categories.map((cat) => (
                <Link key={cat._id} href={`/shop?categoryId=${cat._id}`} className="flex shrink-0 flex-col items-center gap-2">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl bg-emerald-50">
                    {cat.image && <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" />}
                  </div>
                  <p className="w-16 text-center text-xs font-medium text-slate-700">{cat.name}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {stores.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-800">Stores Near You</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stores.map((store) => (
                <Link key={store._id} href={`/shop?storeId=${store._id}`} className="rounded-2xl border bg-white p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-100">
                      {store.logo && <img src={store.logo} alt={store.name} className="h-full w-full object-cover" />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{store.name}</p>
                      {store.address && <p className="text-xs text-slate-500 line-clamp-1">{store.address}</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-3 text-xs text-slate-500">
                    {store.deliveryTime && <span>🕐 {store.deliveryTime} min</span>}
                    {store.minimumOrder ? <span>Min ₹{store.minimumOrder}</span> : null}
                    {store.rating && <span>⭐ {store.rating}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {popular.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-800">Popular Items</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {popular.map((item) => (
                <Link key={item._id} href={`/shop?item=${item._id}`} className="rounded-2xl border bg-white p-4 hover:shadow-md transition-shadow">
                  <div className="h-32 overflow-hidden rounded-xl bg-slate-100">
                    {item.image && <img src={item.image} alt={item.name} className="h-full w-full object-cover" />}
                  </div>
                  <p className="mt-3 font-semibold text-slate-800 line-clamp-2">{item.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-bold text-emerald-700">{currency(item.price)}</span>
                    {item.mrp && item.mrp > item.price && <span className="text-xs text-slate-400 line-through">{currency(item.mrp)}</span>}
                  </div>
                  {item.stock <= 0 && <p className="mt-1 text-xs text-red-500">Out of stock</p>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

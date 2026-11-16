'use client';

import { useEffect, useState } from 'react';
import { Store, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';
import vendorApi from '@/lib/api/vendor';

interface StoreData {
  _id: string;
  name: string;
  phone?: string;
  address?: string;
  status: boolean;
  minimumOrder?: number;
  deliveryTime?: string;
}

export default function VendorStoresPage() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vendorApi.get('/vendor/stores')
      .then((res) => setStores(res.data.data || []))
      .catch(() => toast.error('Could not load stores'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-5">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800">My Stores</h1>
        <p className="text-sm text-slate-500">{stores.length} store(s) assigned to your account</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : stores.length === 0 ? (
        <div className="rounded-2xl border bg-white py-16 text-center">
          <Store className="mx-auto mb-3 text-slate-300" size={40} />
          <p className="font-medium text-slate-600">No stores assigned yet</p>
          <p className="mt-1 text-sm text-slate-400">Contact admin to assign a store to your account</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stores.map((store) => (
            <div key={store._id} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Store size={22} />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800">{store.name}</h2>
                    <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${store.status ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {store.status ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {store.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone size={14} className="text-slate-400" /> {store.phone}
                  </div>
                )}
                {store.address && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin size={14} className="text-slate-400" /> {store.address}
                  </div>
                )}
              </div>
              {(store.minimumOrder || store.deliveryTime) && (
                <div className="mt-3 flex gap-4 border-t pt-3">
                  {store.minimumOrder && (
                    <div className="text-sm">
                      <span className="text-slate-400">Min order: </span>
                      <span className="font-medium text-slate-700">₹{store.minimumOrder}</span>
                    </div>
                  )}
                  {store.deliveryTime && (
                    <div className="text-sm">
                      <span className="text-slate-400">Delivery: </span>
                      <span className="font-medium text-slate-700">{store.deliveryTime} min</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

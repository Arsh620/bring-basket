'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import vendorApi from '@/lib/api/vendor';

type Review = { _id: string; userId?: { fName?: string }; itemId?: { name?: string }; rating: number; comment?: string; createdAt: string };

export default function VendorReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    vendorApi.get('/vendor/reviews').then((r) => setReviews(r.data.data || [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Star size={22} />
        <h1 className="text-xl font-bold">Customer Reviews</h1>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr><th className="px-4 py-3 text-left">Customer</th><th className="px-4 py-3 text-left">Item</th><th className="px-4 py-3 text-left">Rating</th><th className="px-4 py-3 text-left">Comment</th><th className="px-4 py-3 text-left">Date</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reviews.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No reviews yet.</td></tr>}
            {reviews.map((r) => (
              <tr key={r._id}>
                <td className="px-4 py-3 font-medium">{r.userId?.fName || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{r.itemId?.name || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={12} className={i < r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'} />
                    ))}
                    <span className="ml-1 text-xs text-slate-500">{r.rating}/5</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.comment || '—'}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

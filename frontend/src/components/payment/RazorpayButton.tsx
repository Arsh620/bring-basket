'use client';

import { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { loadRazorpay, openRazorpay } from '@/lib/razorpay';
import customerApi from '@/lib/api/customer';

interface RazorpayButtonProps {
  purpose: 'order' | 'wallet_topup';
  amount: number;
  orderId?: string;
  label?: string;
  className?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess?: (data: { razorpay_payment_id: string; razorpay_order_id: string }) => void;
  onFailure?: () => void;
}

export function RazorpayButton({
  purpose,
  amount,
  orderId,
  label,
  className,
  prefill,
  onSuccess,
  onFailure,
}: RazorpayButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    try {
      // Load Razorpay script
      const loaded = await loadRazorpay();
      if (!loaded) {
        toast.error('Could not load payment gateway. Check your internet connection.');
        return;
      }

      // Create Razorpay order on backend
      const res = await customerApi.post('/payment/razorpay/create-order', {
        purpose,
        amount,
        order_id: orderId,
      });

      const { razorpay_order_id, key_id } = res.data.data;

      // Open Razorpay checkout
      openRazorpay({
        key: key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
        amount: Math.round(amount * 100),
        currency: 'INR',
        order_id: razorpay_order_id,
        name: 'Bring Basket',
        description: purpose === 'order' ? 'Order Payment' : 'Wallet Top-up',
        prefill,
        theme: { color: '#059669' },
        handler: async (response) => {
          try {
            // Verify on backend
            await customerApi.post('/payment/razorpay/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success(purpose === 'order' ? 'Payment successful!' : 'Wallet topped up!');
            onSuccess?.({ razorpay_payment_id: response.razorpay_payment_id, razorpay_order_id: response.razorpay_order_id });
          } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg || 'Payment verification failed');
            onFailure?.();
          }
        },
        modal: {
          ondismiss: () => {
            toast.info('Payment cancelled');
            onFailure?.();
          },
        },
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Could not initiate payment');
      onFailure?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePay}
      disabled={loading || amount <= 0}
      className={className ?? 'flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50'}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
      {loading ? 'Processing…' : (label ?? `Pay ₹${amount}`)}
    </button>
  );
}

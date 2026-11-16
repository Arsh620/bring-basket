// Load Razorpay checkout script dynamically
export const loadRazorpay = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as Window & { Razorpay?: unknown }).Razorpay) return resolve(true);

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}

export const openRazorpay = (options: RazorpayOptions) => {
  const RazorpayClass = (window as Window & { Razorpay?: new (opts: RazorpayOptions) => { open: () => void } }).Razorpay;
  if (!RazorpayClass) throw new Error('Razorpay not loaded');
  const rzp = new RazorpayClass(options);
  rzp.open();
};

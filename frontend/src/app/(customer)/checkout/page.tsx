'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, ShoppingBag, Wallet, CreditCard, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { customerAccountId, useCustomerStore } from '@/store/customer.store';
import customerApi from '@/lib/api/customer';
import { RazorpayButton } from '@/components/payment/RazorpayButton';

interface CartItem {
  _id: string;
  quantity: number;
  price: number;
  item: { name: string; storeId: string } | null;
}

interface Address {
  _id: string;
  contactPersonName: string;
  contactPersonNumber: string;
  address: string;
  latitude: string;
  longitude: string;
}

type Store = { _id: string; legacyId?: number; moduleId: string; delivery: boolean; takeAway: boolean };
type PlacedOrder = { _id: string; orderAmount: number; orderNumber: string };
const currency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

type PaymentMethod = 'cash_on_delivery' | 'digital_payment' | 'wallet';

export default function CheckoutPage() {
  return <Suspense fallback={<p role="status" className="p-6">Loading checkout…</p>}><Checkout /></Suspense>;
}

function Checkout() {
  const router = useRouter();
  const requestedStoreId = useSearchParams().get('store') ?? '';
  const { token, hydrate, hasHydrated, customer } = useCustomerStore();
  const accountId = customerAccountId(customer, token);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_on_delivery');
  const [requestedOrderType, setOrderType] = useState<'delivery' | 'take_away'>('delivery');
  const [busy, setBusy] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const attempt = useRef<{ key: string; intent: string } | null>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (hasHydrated && !token) router.replace('/login');
  }, [hasHydrated, token, router]);

  const checkout = useQuery({
    queryKey: ['customer-checkout', accountId, requestedStoreId],
    enabled: hasHydrated && Boolean(token && accountId && requestedStoreId) && !placedOrder,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const store = (await customerApi.get<{ data: Store }>(`/customer/stores/${encodeURIComponent(requestedStoreId)}`, { signal })).data.data;
      const [cartRes, addrRes, walletRes] = await Promise.all([
        customerApi.get<{ data: CartItem[] }>('/customer/cart/list', { signal, headers: { moduleId: store.moduleId } }),
        customerApi.get<{ data: { addresses: Address[] } }>('/customer/addresses', { signal }),
        customerApi.get<{ data: { balance: number } }>('/customer/wallet/balance', { signal }),
      ]);
      return { store, cart: cartRes.data.data ?? [], addresses: addrRes.data.data?.addresses ?? [], walletBalance: walletRes.data.data?.balance ?? 0 };
    },
  });
  const { store, cart = [], addresses = [], walletBalance = 0 } = checkout.data ?? {};
  const selectedAddress = addresses.find((address) => address._id === selectedAddressId) ?? addresses[0];
  const orderType = store?.delivery && (requestedOrderType === 'delivery' || !store.takeAway) ? 'delivery' : 'take_away';
  const storeConflict = Boolean(store && cart.some((row) => !row.item || ![store._id, String(store.legacyId)].includes(row.item.storeId)));
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const placeOrder = async (method: PaymentMethod = paymentMethod) => {
    if (busy || placedOrder || !store || !cart.length || storeConflict || (!store.delivery && !store.takeAway)) return;
    if (orderType === 'delivery' && !selectedAddress) return toast.error('Please select a delivery address');

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        store_id: store._id,
        order_type: orderType,
        payment_method: method,
      };
      if (orderType === 'delivery' && selectedAddress) {
        body.address = {
          contact_person_name: selectedAddress.contactPersonName,
          contact_person_number: selectedAddress.contactPersonNumber,
          address: selectedAddress.address,
          latitude: selectedAddress.latitude,
          longitude: selectedAddress.longitude,
        };
      }

      const intent = JSON.stringify(body);
      if (attempt.current?.intent !== intent) attempt.current = { key: window.crypto.randomUUID(), intent };
      const res = await customerApi.post<{ data: PlacedOrder }>('/customer/order/place', body, {
        headers: { moduleId: store.moduleId, 'Idempotency-Key': attempt.current.key },
      });

      const order = res.data.data;
      setPlacedOrder(order);
      toast.success(`Order ${order.orderNumber} placed!`);

      if (method !== 'digital_payment') {
        router.push('/orders');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Order placement failed');
    } finally { setBusy(false); }
  };

  if (!hasHydrated || !token) return null;

  if (!requestedStoreId) return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-lg font-bold">Checkout</h1>
      <Link href="/shop" className="text-emerald-700 underline">Choose a store and cart in the shop</Link>
    </main>
  );

  if (placedOrder) return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-lg font-bold">Order {placedOrder.orderNumber}</h1>
      {paymentMethod === 'digital_payment' && <RazorpayButton
        purpose="order" amount={placedOrder.orderAmount} orderId={placedOrder._id}
        label={`Pay ${currency(placedOrder.orderAmount)} via Razorpay`}
        prefill={{ name: customer?.fName, email: customer?.email }}
        onSuccess={() => router.push('/orders')}
      />}
      <Link href="/orders" className="block text-emerald-700 underline">View orders</Link>
    </main>
  );

  if (checkout.isPending || checkout.isError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-5">
        {checkout.isPending ? <p role="status">Loading checkout…</p> : (
          <>
            <p role="alert">Could not load checkout.</p>
            <button type="button" onClick={() => void checkout.refetch()} className="rounded-xl border px-4 py-2">Try again</button>
          </>
        )}
      </main>
    );
  }

  if (cart.length === 0 && !busy) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-5">
        <ShoppingBag className="text-slate-300" size={48} />
        <p className="font-semibold text-slate-600">Your cart is empty</p>
        <Link href="/shop" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">
          Continue Shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 border-b bg-white px-4 py-4">
        <h1 className="text-lg font-bold text-slate-800">Checkout</h1>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-5">
        {/* Order Type */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Order Type</h2>
          <div className="grid grid-cols-2 gap-2">
            {(['delivery', 'take_away'] as const).filter((type) => type === 'delivery' ? store?.delivery : store?.takeAway).map((type) => (
              <button key={type} onClick={() => setOrderType(type)}
                className={`rounded-xl border py-2.5 text-sm font-medium capitalize transition ${orderType === type ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'text-slate-600'}`}>
                {type === 'delivery' ? '🚚 Delivery' : '🏪 Takeaway'}
              </button>
            ))}
          </div>
        </div>

        {/* Delivery Address */}
        {orderType === 'delivery' && (
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              <MapPin size={16} className="text-emerald-600" /> Delivery Address
            </h2>
            {addresses.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <p className="text-sm text-slate-500">No addresses saved</p>
                <Link href="/shop" className="mt-2 inline-block text-sm font-medium text-emerald-600 hover:underline">
                  Add an address in the shop
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <button key={addr._id} onClick={() => setSelectedAddressId(addr._id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${selectedAddress?._id === addr._id ? 'border-emerald-500 bg-emerald-50' : 'hover:border-slate-300'}`}>
                    <p className="text-sm font-medium text-slate-800">{addr.contactPersonName}</p>
                    <p className="text-xs text-slate-500">{addr.contactPersonNumber}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{addr.address}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cart Summary */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Order Summary</h2>
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item._id} className="flex justify-between text-sm">
                <span className="text-slate-700">{item.item?.name ?? 'Unavailable product'} × {item.quantity}</span>
                <span className="font-medium">{currency(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t pt-3 font-bold text-slate-800">
            <span>Item subtotal</span>
            <span className="text-emerald-600">{currency(subtotal)}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Payment Method</h2>
          <div className="space-y-2">
            {[
              { value: 'cash_on_delivery' as PaymentMethod, label: 'Cash on Delivery', icon: Truck, desc: 'Pay when order arrives' },
              { value: 'digital_payment' as PaymentMethod, label: 'Pay Online (Razorpay)', icon: CreditCard, desc: 'UPI, Cards, Net Banking' },
              { value: 'wallet' as PaymentMethod, label: `Wallet (₹${walletBalance.toFixed(0)} available)`, icon: Wallet, desc: 'Pay from wallet balance', disabled: walletBalance < subtotal },
            ].map(({ value, label, icon: Icon, desc, disabled }) => (
              <button key={value} onClick={() => !disabled && setPaymentMethod(value)} disabled={disabled}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${paymentMethod === value ? 'border-emerald-500 bg-emerald-50' : 'hover:border-slate-300'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${paymentMethod === value ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  <Icon size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Place Order Button */}
        <div className="pb-6">
          {storeConflict && <p role="alert" className="mb-2 text-sm text-amber-800">Some cart items are unavailable for this store. Return to the shop to update your cart.</p>}
          <button type="button" onClick={() => void placeOrder()} disabled={busy || storeConflict || (!store?.delivery && !store?.takeAway) || (orderType === 'delivery' && !selectedAddress) || (paymentMethod === 'wallet' && walletBalance < subtotal)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Placing order…' : paymentMethod === 'digital_payment' ? 'Proceed to payment' : 'Place order'}
          </button>
        </div>
      </div>
    </main>
  );
}

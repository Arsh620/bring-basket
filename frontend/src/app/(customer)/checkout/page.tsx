'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, ShoppingBag, Wallet, CreditCard, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomerStore } from '@/store/customer.store';
import customerApi from '@/lib/api/customer';
import { RazorpayButton } from '@/components/payment/RazorpayButton';

interface CartItem {
  _id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  image?: string;
}

interface Address {
  _id: string;
  contact_person_name: string;
  contact_person_number: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

const currency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

type PaymentMethod = 'cash_on_delivery' | 'digital_payment' | 'wallet';

export default function CheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, hydrate, hasHydrated, customer } = useCustomerStore();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_on_delivery');
  const [walletBalance, setWalletBalance] = useState(0);
  const [storeId, setStoreId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'take_away'>('delivery');
  const [busy, setBusy] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated()) { router.push('/login'); return; }
    loadData();
  }, [hasHydrated, isAuthenticated, router]);

  const loadData = async () => {
    try {
      const [cartRes, addrRes, walletRes] = await Promise.all([
        customerApi.get('/cart/list'),
        customerApi.get('/customer/addresses'),
        customerApi.get('/customer/wallet/balance'),
      ]);
      const cartItems: CartItem[] = cartRes.data.data || [];
      setCart(cartItems);
      setAddresses(addrRes.data.data || []);
      setWalletBalance(walletRes.data.data?.balance || 0);

      // Get storeId + moduleId from cart (first item)
      if (cartItems.length > 0) {
        const firstItem = cartItems[0] as CartItem & { storeId?: string; moduleId?: string };
        if (firstItem.storeId) setStoreId(firstItem.storeId);
        if (firstItem.moduleId) setModuleId(firstItem.moduleId);
      }

      if (addrRes.data.data?.length > 0) setSelectedAddress(addrRes.data.data[0]);
    } catch { toast.error('Could not load checkout data'); }
  };

  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);

  const placeOrder = async (method: PaymentMethod = paymentMethod) => {
    if (!storeId) return toast.error('Store not found in cart');
    if (orderType === 'delivery' && !selectedAddress) return toast.error('Please select a delivery address');

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        store_id: storeId,
        order_type: orderType,
        payment_method: method,
      };
      if (orderType === 'delivery' && selectedAddress) {
        body.address = {
          contact_person_name: selectedAddress.contact_person_name,
          contact_person_number: selectedAddress.contact_person_number,
          address: selectedAddress.address,
          latitude: selectedAddress.latitude || 0,
          longitude: selectedAddress.longitude || 0,
        };
      }

      const res = await customerApi.post('/order/place', body, {
        headers: { moduleId: moduleId || 'default' },
      });

      const order = res.data.data;
      setPlacedOrderId(order._id);
      toast.success(`Order ${order.orderNumber} placed!`);

      if (method !== 'digital_payment') {
        router.push('/orders');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Order placement failed');
    } finally { setBusy(false); }
  };

  if (cart.length === 0 && !busy) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-5">
        <ShoppingBag className="text-slate-300" size={48} />
        <p className="font-semibold text-slate-600">Your cart is empty</p>
        <a href="/home" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">
          Continue Shopping
        </a>
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
            {(['delivery', 'take_away'] as const).map((type) => (
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
                <a href="/addresses" className="mt-2 inline-block text-sm font-medium text-emerald-600 hover:underline">
                  Add address
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <button key={addr._id} onClick={() => setSelectedAddress(addr)}
                    className={`w-full rounded-xl border p-3 text-left transition ${selectedAddress?._id === addr._id ? 'border-emerald-500 bg-emerald-50' : 'hover:border-slate-300'}`}>
                    <p className="text-sm font-medium text-slate-800">{addr.contact_person_name}</p>
                    <p className="text-xs text-slate-500">{addr.contact_person_number}</p>
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
                <span className="text-slate-700">{item.itemName} × {item.quantity}</span>
                <span className="font-medium">{currency(item.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t pt-3 font-bold text-slate-800">
            <span>Total</span>
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
          {paymentMethod === 'digital_payment' ? (
            placedOrderId ? (
              <RazorpayButton
                purpose="order"
                amount={subtotal}
                orderId={placedOrderId}
                label={`Pay ${currency(subtotal)} via Razorpay`}
                prefill={{ name: customer?.fName, email: customer?.email }}
                onSuccess={() => router.push('/orders')}
              />
            ) : (
              <button onClick={() => placeOrder('digital_payment')} disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? 'Creating order…' : `Proceed to Pay ${currency(subtotal)}`}
              </button>
            )
          ) : (
            <button onClick={() => placeOrder()} disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Placing order…' : `Place Order • ${currency(subtotal)}`}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

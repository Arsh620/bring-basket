'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

interface Store {
  _id: string;
  legacyId?: number;
  name: string;
  moduleId: string;
  address?: string;
  minimumOrder: number;
  delivery: boolean;
  takeAway: boolean;
}

interface Item {
  _id: string;
  name: string;
  description?: string;
  price: number;
  mrp?: number;
  stock: number;
  image?: string;
  storeId: string;
}

interface CartRow {
  _id: string;
  item_id: string;
  quantity: number;
  price: number;
  item: Item | null;
}

interface Order {
  _id: string;
  orderNumber: string;
  orderStatus: string;
  orderAmount: number;
  orderType: string;
  paymentMethod: string;
  storeName: string;
  items: Array<{ itemName: string; quantity: number; lineTotal: number }>;
  createdAt: string;
}

interface CustomerAddress {
  _id: string;
  addressType: string;
  contactPersonName: string;
  contactPersonNumber: string;
  address: string;
  latitude: string;
  longitude: string;
  floor?: string;
  road?: string;
  house?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

const getGuestId = () => {
  let guestId = localStorage.getItem('bring_basket_guest_id');
  if (!guestId) {
    guestId = window.crypto.randomUUID();
    localStorage.setItem('bring_basket_guest_id', guestId);
  }
  return guestId;
};

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: Record<string, unknown>; moduleId?: string; idempotencyKey?: string } = {},
): Promise<T> {
  const guestId = getGuestId();
  const token = localStorage.getItem('customer_token');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.moduleId) headers.moduleId = options.moduleId;
  if (token) headers.authorization = `Bearer ${token}`;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const url = new URL(`${API_URL}${path}`);
  if (guestId && !token) url.searchParams.set('guest_id', guestId);
  const body = options.body && !token ? { ...options.body, guest_id: guestId } : options.body;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || !payload.success) throw new ApiError(payload.message || 'Request failed', response.status);
  return payload.data;
}

const currency = (amount: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(amount) || 0);

export default function ShopPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<CartRow[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [requestedOrderType, setRequestedOrderType] = useState<'delivery' | 'take_away'>('delivery');
  const [contactName, setContactName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [addressType, setAddressType] = useState('home');
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [accountMode, setAccountMode] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerFirstName, setRegisterFirstName] = useState('');
  const [registerLastName, setRegisterLastName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const selectedStore = stores.find((store) => store._id === storeId);
  const orderType: 'delivery' | 'take_away' = selectedStore?.delivery
    ? (requestedOrderType === 'take_away' && selectedStore.takeAway ? 'take_away' : 'delivery')
    : 'take_away';
  const cartStoreConflict = Boolean(selectedStore && cart.some((row) =>
    !row.item || ![selectedStore._id, String(selectedStore.legacyId)].includes(row.item.storeId),
  ));
  const canDeliver = Boolean(selectedStore?.delivery);
  const canTakeAway = Boolean(selectedStore?.takeAway);

  const refreshCart = useCallback(async (store: Store) => {
    const result = await request<CartRow[]>('/customer/cart/list', { moduleId: store.moduleId });
    setCart(result);
  }, []);

  const refreshOrders = useCallback(async () => {
    const result = await request<{ orders: Order[] }>('/customer/order/list?limit=10&offset=1');
    setOrders(result.orders);
  }, []);

  const refreshAddresses = useCallback(async () => {
    const result = await request<{ addresses: CustomerAddress[] }>('/customer/addresses?limit=100');
    setAddresses(result.addresses);
  }, []);

  useEffect(() => {
    let active = true;
    const loadPageData = async () => {
      getGuestId();
      const signedIn = Boolean(localStorage.getItem('customer_token'));
      setIsSignedIn(signedIn);
      const [storeResult, orderResult] = await Promise.all([
        request<Store[]>('/customer/stores?limit=100'),
        request<{ orders: Order[] }>('/customer/order/list?limit=10&offset=1'),
      ]);
      if (!active) return;
      setStores(storeResult);
      if (storeResult.length) setStoreId(storeResult[0]._id);
      setOrders(orderResult.orders);
      if (signedIn) {
        void refreshAddresses().catch((error: unknown) => {
          if (active) setMessage(error instanceof Error ? error.message : 'Could not load saved addresses');
        });
      }
    };
    void loadPageData().catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Could not load shop data');
    });
    return () => { active = false; };
  }, [refreshAddresses]);

  useEffect(() => {
    if (!selectedStore) return;
    let active = true;
    Promise.all([
      request<Item[]>(`/customer/items?storeId=${encodeURIComponent(selectedStore._id)}&limit=100`),
      request<CartRow[]>('/customer/cart/list', { moduleId: selectedStore.moduleId }),
    ]).then(([catalog, currentCart]) => {
      if (!active) return;
      setItems(catalog);
      setCart(currentCart);
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Could not load the store catalog');
    });
    return () => { active = false; };
  }, [selectedStore, refreshCart]);

  const subtotal = useMemo(
    () => cart.reduce((sum, row) => sum + (Number(row.item?.price ?? row.price) * row.quantity), 0),
    [cart],
  );

  const addItem = async (item: Item) => {
    if (!selectedStore) return;
    if (cartStoreConflict) {
      setMessage('Clear the current cart before shopping from another store.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const current = cart.find((row) => row.item_id === item._id);
      if (current) {
        await request('/customer/cart/update', {
          method: 'POST',
          moduleId: selectedStore.moduleId,
          body: { cart_id: current._id, price: item.price, quantity: current.quantity + 1 },
        });
      } else {
        await request('/customer/cart/add', {
          method: 'POST',
          moduleId: selectedStore.moduleId,
          body: { item_id: item._id, model: 'Item', price: item.price, quantity: 1 },
        });
      }
      await refreshCart(selectedStore);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add item');
    } finally {
      setBusy(false);
    }
  };

  const updateQuantity = async (row: CartRow, quantity: number) => {
    if (!selectedStore) return;
    setBusy(true);
    try {
      if (quantity <= 0) {
        await request('/customer/cart/remove-item', {
          method: 'DELETE',
          moduleId: selectedStore.moduleId,
          body: { cart_id: row._id },
        });
      } else {
        await request('/customer/cart/update', {
          method: 'POST',
          moduleId: selectedStore.moduleId,
          body: { cart_id: row._id, price: row.price, quantity },
        });
      }
      await refreshCart(selectedStore);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update cart');
    } finally {
      setBusy(false);
    }
  };

  const placeOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStore || !cart.length) return;
    setBusy(true);
    setMessage('');
    try {
      const order = await request<Order>('/customer/order/place', {
        method: 'POST',
        moduleId: selectedStore.moduleId,
        idempotencyKey: sessionStorage.getItem('bring_basket_checkout_key') || window.crypto.randomUUID(),
        body: {
          store_id: selectedStore._id,
          order_type: orderType,
          payment_method: 'cash_on_delivery',
          order_note: orderNote,
          ...(orderType === 'delivery' ? {
            address: {
              contact_person_name: contactName,
              contact_person_number: contactNumber,
              address,
              latitude,
              longitude,
            },
          } : {}),
        },
      });
      sessionStorage.removeItem('bring_basket_checkout_key');
      setMessage(`Order ${order.orderNumber} placed successfully.`);
      await Promise.all([refreshCart(selectedStore), refreshOrders()]);
    } catch (error) {
      if (error instanceof ApiError && !(error.status === 409 && error.message.includes('still in progress'))) {
        sessionStorage.removeItem('bring_basket_checkout_key');
      }
      setMessage(error instanceof Error ? error.message : 'Could not place order');
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async (order: Order) => {
    setBusy(true);
    try {
      await request('/customer/order/cancel', {
        method: 'PUT',
        body: { order_id: order._id, reason: 'Cancelled by customer' },
      });
      await refreshOrders();
      setMessage(`Order ${order.orderNumber} cancelled.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not cancel order');
    } finally {
      setBusy(false);
    }
  };

  const showOrderDetails = async (order: Order) => {
    try {
      setSelectedOrder(await request<Order>(`/customer/order/details?order_id=${encodeURIComponent(order._id)}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load order details');
    }
  };

  const clearCart = async () => {
    if (!selectedStore) return;
    setBusy(true);
    try {
      await request('/customer/cart/remove', { method: 'DELETE', moduleId: selectedStore.moduleId });
      await refreshCart(selectedStore);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not clear cart');
    } finally {
      setBusy(false);
    }
  };

  const authenticateCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = accountMode === 'login'
        ? await request<{ token: string }>('/customer/auth/login', {
          method: 'POST',
          body: { email: loginEmail, password: loginPassword },
        })
        : await request<{ token: string }>('/customer/auth/register', {
          method: 'POST',
          body: {
            fName: registerFirstName,
            lName: registerLastName,
            phone: registerPhone,
            email: loginEmail,
            password: loginPassword,
          },
        });
      localStorage.setItem('customer_token', result.token);
      setIsSignedIn(true);
      if (cart.length && selectedStore) {
        await request('/customer/cart/merge-guest', {
          method: 'POST',
          moduleId: selectedStore.moduleId,
          body: { guest_id: getGuestId() },
        });
      }
      await Promise.all([refreshAddresses(), refreshOrders()]);
      if (selectedStore) await refreshCart(selectedStore);
      setMessage(accountMode === 'login' ? 'Signed in successfully.' : 'Account created successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  const signOutCustomer = async () => {
    localStorage.removeItem('customer_token');
    setIsSignedIn(false);
    setAddresses([]);
    setSelectedAddressId('');
    try {
      await Promise.all([
        refreshOrders(),
        selectedStore ? refreshCart(selectedStore) : Promise.resolve(),
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Signed out, but shop data could not refresh');
    }
  };

  const selectSavedAddress = (addressId: string) => {
    setSelectedAddressId(addressId);
    const saved = addresses.find((entry) => entry._id === addressId);
    if (!saved) return;
    setAddressType(saved.addressType);
    setContactName(saved.contactPersonName);
    setContactNumber(saved.contactPersonNumber);
    setAddress(saved.address);
    setLatitude(saved.latitude);
    setLongitude(saved.longitude);
  };

  const saveAddress = async () => {
    if (!selectedStore || !isSignedIn) return;
    setBusy(true);
    try {
      const body = {
        address_type: addressType,
        contact_person_name: contactName,
        contact_person_number: contactNumber,
        address,
        latitude,
        longitude,
      };
      if (selectedAddressId) {
        await request(`/customer/addresses/${encodeURIComponent(selectedAddressId)}`, {
          method: 'PUT',
          moduleId: selectedStore.moduleId,
          body,
        });
      } else {
        await request('/customer/addresses', {
          method: 'POST',
          moduleId: selectedStore.moduleId,
          body,
        });
      }
      await refreshAddresses();
      setMessage(selectedAddressId ? 'Address updated.' : 'Address saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save address');
    } finally {
      setBusy(false);
    }
  };

  const removeAddress = async (addressId: string) => {
    setBusy(true);
    try {
      await request('/customer/addresses', {
        method: 'DELETE',
        body: { address_id: addressId },
      });
      setAddresses((current) => current.filter((entry) => entry._id !== addressId));
      if (selectedAddressId === addressId) setSelectedAddressId('');
      setMessage('Address removed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove address');
    } finally {
      setBusy(false);
    }
  };

  const startCheckout = (event: React.FormEvent<HTMLFormElement>) => {
    const key = sessionStorage.getItem('bring_basket_checkout_key');
    if (!key) sessionStorage.setItem('bring_basket_checkout_key', window.crypto.randomUUID());
    void placeOrder(event);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Bring Basket</p>
            <h1 className="text-2xl font-bold">Shop groceries</h1>
          </div>
          <a className="text-sm font-medium text-slate-600 underline" href="/admin/login">Admin</a>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-7 lg:grid-cols-[1fr_390px]">
        <section className="space-y-5">
          <div className="rounded-2xl border bg-white p-5">
            <label htmlFor="shop-store" className="mb-2 block text-sm font-semibold">Choose a store</label>
            <select id="shop-store" value={storeId} onChange={(event) => setStoreId(event.target.value)} className="w-full rounded-lg border px-3 py-2">
              {stores.map((store) => <option key={store._id} value={store._id}>{store.name}</option>)}
            </select>
            {selectedStore?.address && <p className="mt-2 text-sm text-slate-500">{selectedStore.address}</p>}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold">Available products</h2>
            {items.length === 0 ? (
              <p className="rounded-xl border bg-white p-6 text-slate-600">No active products are available at this store.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <article key={item._id} className="rounded-xl border bg-white p-4">
                    <h3 className="font-semibold">{item.name}</h3>
                    {item.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.description}</p>}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="font-bold">{currency(item.price)}</span>
                      <button type="button" disabled={busy || item.stock <= 0} onClick={() => void addItem(item)} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                        {item.stock <= 0 ? 'Out of stock' : 'Add'}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Stock: {item.stock}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border bg-white p-5">
            {isSignedIn ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Customer account · Saved addresses: {addresses.length}</p>
                <button type="button" onClick={() => void signOutCustomer()} className="text-sm text-emerald-700 underline">Sign out</button>
              </div>
            ) : (
              <form onSubmit={authenticateCustomer} className="space-y-3">
                <h2 className="text-lg font-bold">{accountMode === 'login' ? 'Customer sign in' : 'Create customer account'}</h2>
                {accountMode === 'register' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input required value={registerFirstName} onChange={(event) => setRegisterFirstName(event.target.value)} placeholder="First name" className="w-full rounded-lg border px-3 py-2 text-sm" />
                    <input required value={registerLastName} onChange={(event) => setRegisterLastName(event.target.value)} placeholder="Last name" className="w-full rounded-lg border px-3 py-2 text-sm" />
                    <input required value={registerPhone} onChange={(event) => setRegisterPhone(event.target.value)} placeholder="Phone number" className="col-span-2 w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                )}
                <input required type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="Email" className="w-full rounded-lg border px-3 py-2 text-sm" />
                <input required type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="Password" className="w-full rounded-lg border px-3 py-2 text-sm" />
                <button type="submit" disabled={busy} className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {accountMode === 'login' ? 'Sign in' : 'Create account'}
                </button>
                <button type="button" onClick={() => setAccountMode(accountMode === 'login' ? 'register' : 'login')} className="text-sm text-emerald-700 underline">
                  {accountMode === 'login' ? 'Create an account' : 'Already registered? Sign in'}
                </button>
              </form>
            )}
          </section>

          <section className="rounded-2xl border bg-white p-5">
            <h2 className="text-lg font-bold">Your cart</h2>
            {cartStoreConflict && <p className="mt-2 text-sm text-amber-700">Cart items belong to another store. Clear the cart before checking out.</p>}
            {!cart.length ? <p className="mt-4 text-sm text-slate-500">Your cart is empty.</p> : (
              <ul className="mt-3 divide-y">
                {cart.map((row) => (
                  <li key={row._id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{row.item?.name || 'Unavailable item'}</p>
                      <p className="text-sm text-slate-500">{currency(Number(row.item?.price ?? row.price) * row.quantity)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label="Decrease quantity" disabled={busy} onClick={() => void updateQuantity(row, row.quantity - 1)} className="h-8 w-8 rounded border">−</button>
                      <span className="w-5 text-center text-sm">{row.quantity}</span>
                      <button type="button" aria-label="Increase quantity" disabled={busy} onClick={() => void updateQuantity(row, row.quantity + 1)} className="h-8 w-8 rounded border">+</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex justify-between border-t pt-3 font-bold">
              <span>Estimated subtotal</span><span>{currency(subtotal)}</span>
            </div>
            {!!cart.length && <button type="button" disabled={busy} onClick={() => void clearCart()} className="mt-3 text-sm text-red-700 underline">Clear cart</button>}
            <p className="mt-2 text-xs text-slate-500">Final prices and delivery fee are confirmed by the server at checkout.</p>
          </section>

          <form onSubmit={startCheckout} className="space-y-3 rounded-2xl border bg-white p-5">
            <h2 className="text-lg font-bold">Checkout</h2>
            <label className="block text-sm font-medium">
              Order type
              <select value={orderType} onChange={(event) => setRequestedOrderType(event.target.value as 'delivery' | 'take_away')} className="mt-1 w-full rounded-lg border px-3 py-2">
                {canDeliver && <option value="delivery">Home delivery</option>}
                {canTakeAway && <option value="take_away">Takeaway</option>}
              </select>
            </label>
            {orderType === 'delivery' && (
              <>
                {isSignedIn && addresses.length > 0 && (
                  <label className="block text-sm font-medium">
                    Saved address
                    <select value={selectedAddressId} onChange={(event) => selectSavedAddress(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
                      <option value="">Enter a new address</option>
                      {addresses.map((saved) => <option key={saved._id} value={saved._id}>{saved.addressType}: {saved.address}</option>)}
                    </select>
                    {selectedAddressId && (
                      <button type="button" disabled={busy} onClick={() => void removeAddress(selectedAddressId)} className="mt-2 text-xs text-red-700 underline">Delete saved address</button>
                    )}
                  </label>
                )}
                <select value={addressType} onChange={(event) => setAddressType(event.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" aria-label="Address type">
                  <option value="home">Home</option>
                  <option value="work">Work</option>
                  <option value="other">Other</option>
                </select>
                <input required value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Contact name" className="w-full rounded-lg border px-3 py-2 text-sm" />
                <input required value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} placeholder="Phone number" className="w-full rounded-lg border px-3 py-2 text-sm" />
                <input required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Delivery address" className="w-full rounded-lg border px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input required type="number" step="any" min="-90" max="90" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="Latitude" className="w-full rounded-lg border px-3 py-2 text-sm" />
                  <input required type="number" step="any" min="-180" max="180" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="Longitude" className="w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
                {isSignedIn && (
                  <button type="button" disabled={busy || !contactName || !contactNumber || !address || !latitude || !longitude} onClick={() => void saveAddress()} className="w-full rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50">
                    {selectedAddressId ? 'Update saved address' : 'Save this address'}
                  </button>
                )}
              </>
            )}
            <textarea value={orderNote} onChange={(event) => setOrderNote(event.target.value)} maxLength={1000} placeholder="Order note (optional)" className="min-h-20 w-full rounded-lg border px-3 py-2 text-sm" />
            <p className="text-sm text-slate-600">Payment: Cash on delivery</p>
            <button type="submit" disabled={busy || !cart.length || !selectedStore || cartStoreConflict || (!canDeliver && !canTakeAway)} className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50">
              {busy ? 'Please wait…' : 'Place order'}
            </button>
          </form>

          <section className="rounded-2xl border bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Running orders</h2>
              <button type="button" onClick={() => void refreshOrders().catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not load orders'))} className="text-sm text-emerald-700 underline">Refresh</button>
            </div>
            {!orders.length ? <p className="mt-3 text-sm text-slate-500">No running orders.</p> : (
              <ul className="mt-3 space-y-3">
                {orders.map((order) => (
                  <li key={order._id} className="rounded-lg border p-3">
                    <div className="flex justify-between gap-2 text-sm">
                      <strong>{order.orderNumber}</strong><span className="capitalize">{order.orderStatus}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{order.storeName} · {currency(order.orderAmount)}</p>
                    <button type="button" onClick={() => void showOrderDetails(order)} className="mt-2 text-sm font-medium text-emerald-700 underline">Details</button>
                    {order.orderStatus === 'pending' && (
                      <button type="button" disabled={busy} onClick={() => void cancelOrder(order)} className="mt-2 text-sm font-medium text-red-700 underline">Cancel order</button>
                    )}
                    {selectedOrder && (
                      <div className="mt-4 rounded-lg bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-sm">Order details</strong>
                          <button type="button" onClick={() => setSelectedOrder(null)} aria-label="Close order details">×</button>
                        </div>
                        <ul className="mt-2 space-y-1 text-sm text-slate-600">
                          {selectedOrder.items.map((line, index) => (
                            <li key={`${selectedOrder._id}-${index}`} className="flex justify-between gap-2">
                              <span>{line.itemName} × {line.quantity}</span><span>{currency(line.lineTotal)}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-sm font-semibold">Total: {currency(selectedOrder.orderAmount)}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
      {message && <div role="status" className="fixed bottom-4 right-4 max-w-md rounded-xl border bg-white p-4 text-sm shadow-lg">{message}</div>}
    </main>
  );
}

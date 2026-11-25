'use client';

import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ShoppingBag, Trash2, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import vendorApi from '@/lib/api/vendor';
import { useVendorStore } from '@/store/vendor.store';
import PosItemOptionsDialog, { type PosItemSelection, type PosOptionItem } from '@/components/pos/PosItemOptionsDialog';
import { usePosDeliveryAddress, usePosWorkspace, type DeliveryAddress } from '@/components/pos/usePosWorkspace';

type Store = { _id: string; name: string };
type Item = PosOptionItem & { stock: number; status?: boolean; isApproved?: boolean; image?: string; suggestedQty?: number; scaleWeight?: boolean; trackBatch?: boolean; isPerishable?: boolean; nearestExpiry?: string | null; batches?: { _id: string; batchCode?: string; qty: number; expiryDate?: string | null }[] };
type CartLine = { itemId: string; itemName: string; unitPrice: number; qty: number; lineTotal: number; variant?: string; offerLabel?: string; variations?: { name: string; values?: { label?: string[] } }[]; addOns?: { name: string; qty: number }[]; addOnTotal?: number };
type CartData = {
  cart: { items: CartLine[]; orderMode?: 'counter' | 'delivery'; deliveryAddress?: DeliveryAddress | null; customerId?: { _id: string; fName: string; lName?: string; phone?: string } | string | null } | null;
  totals: { itemSubtotal: number; itemDiscount: number; extraDiscount: number; taxTotal: number; deliveryCharge: number; grandTotal: number } | null;
};
type Customer = { _id: string; fName: string; lName?: string; phone?: string };
type HeldCart = { _id: string; label: string; itemCount: number; createdAt: string };
const EMPTY_CART: CartData = { cart: null, totals: null };

const currency = (value: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(value || 0);

export default function VendorPosPage() {
  const vendor = useVendorStore((state) => state.vendor);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const assignedStoreId = vendor?.isEmployee ? vendor.storeId : undefined;
  const storesQuery = useQuery({
    queryKey: ['vendor-pos-stores', vendor?._id],
    enabled: Boolean(vendor?._id) && !vendor?.isEmployee,
    queryFn: async ({ signal }) => (await vendorApi.get<{ data: Store[] }>('/vendor/stores', { signal })).data.data ?? [],
  });
  const stores = vendor?.isEmployee
    ? (assignedStoreId ? [{ _id: assignedStoreId, name: 'Assigned store' }] : [])
    : storesQuery.data ?? [];
  const storeId = stores.find((store) => store._id === selectedStoreId)?._id ?? stores[0]?._id ?? '';
  if (!vendor || (!vendor.isEmployee && storesQuery.isPending)) return <p role="status" className="p-6">Loading stores…</p>;
  if (!vendor.isEmployee && storesQuery.isError) {
    return <div className="p-6"><p role="alert">Could not load stores.</p><button type="button" className="underline" onClick={() => void storesQuery.refetch()}>Try again</button></div>;
  }
  if (!storeId) return <p role="status" className="p-6">No stores are available to this account.</p>;
  return <VendorPosStore key={`${vendor._id}:${storeId}`} operatorId={vendor._id} storeId={storeId} stores={stores} onStoreChange={setSelectedStoreId} />;
}

function VendorPosStore({ operatorId, storeId, stores, onStoreChange }: {
  operatorId: string; storeId: string; stores: Store[]; onStoreChange: (id: string) => void;
}) {
  const [itemQuery, setItemQuery] = useState('');
  const [barcode, setBarcode] = useState('');
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const { session, sessionId, headers, cart, held, catalog, setCartData } = usePosWorkspace<CartData, HeldCart, Item>(vendorApi, 'vendor', operatorId, storeId, itemQuery);
  const cartData = cart.data ?? EMPTY_CART;
  const heldCarts = held.data ?? [];
  const items = catalog.data?.pages.flatMap((page) => page.items) ?? [];
  const [deliveryForm, setDeliveryForm, resetDeliveryForm] = usePosDeliveryAddress(sessionId, cartData.cart?.deliveryAddress);
  const fetchCart = () => cart.refetch({ throwOnError: true });
  const fetchHeldCarts = () => held.refetch({ throwOnError: true });

  const addItem = async (item: Item, selection?: PosItemSelection) => {
    try {
      await vendorApi.post('/vendor/pos/cart/items', { itemId: item._id, storeId, qty: item.suggestedQty || 1, scaleWeight: item.scaleWeight, ...(selection || {}) }, { headers });
      await fetchCart();
    } catch {
      toast.error('Could not add this product to the cart.');
    }
  };

  const openItem = (item: Item) => {
    const hasOptions = (value: unknown) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') { try { return JSON.parse(value).length > 0; } catch { return false; } }
      return Boolean(value);
    };
    if (hasOptions(item.foodVariations) || hasOptions(item.choiceOptions) || hasOptions(item.addOns)) setPendingItem(item);
    else void addItem(item);
  };

  const changeQuantity = async (index: number, qty: number) => {
    if (qty <= 0) return;
    try {
      await vendorApi.put(`/vendor/pos/cart/items/${index}`, { qty }, { headers });
      await fetchCart();
    } catch {
      toast.error('Could not update the product quantity.');
    }
  };

  const removeItem = async (index: number) => {
    try {
      await vendorApi.delete(`/vendor/pos/cart/items/${index}`, { headers });
      await fetchCart();
    } catch {
      toast.error('Could not remove this product.');
    }
  };

  const searchCustomers = async (query: string) => {
    setCustomerQuery(query);
    if (!query.trim()) { setCustomers([]); return; }
    try {
      const response = await vendorApi.get('/vendor/pos/customers', { params: { q: query }, headers });
      setCustomers(response.data.data || []);
    } catch {
      toast.error('Could not search customers.');
    }
  };

  const selectCustomer = async (customerId: string) => {
    try {
      await vendorApi.patch('/vendor/pos/cart/meta', { customerId }, { headers });
      setCustomers([]);
      setCustomerQuery('');
      await fetchCart();
    } catch {
      toast.error('Could not select this customer.');
    }
  };

  const setOrderMode = async (orderMode: 'counter' | 'delivery') => {
    try {
      const response = await vendorApi.patch('/vendor/pos/cart/meta', { orderMode }, { headers });
      await setCartData(response.data.data ?? EMPTY_CART);
      if (orderMode === 'counter') resetDeliveryForm();
    } catch {
      toast.error('Could not update the order type.');
    }
  };

  const saveDeliveryDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const response = await vendorApi.patch('/vendor/pos/cart/meta', { deliveryAddress: deliveryForm }, { headers });
      await setCartData(response.data.data ?? EMPTY_CART);
      resetDeliveryForm();
      toast.success('Delivery address saved and fee calculated.');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(message || 'Could not calculate delivery for this address.');
    }
  };

  const placeOrder = async () => {
    setSubmitting(true);
    try {
      await vendorApi.post('/vendor/pos/cart/place-order', { paymentMethod }, { headers });
      toast.success('POS order placed.');
      await setCartData(EMPTY_CART);
      resetDeliveryForm();
      await fetchCart();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(message || 'Could not place this order.');
    } finally {
      setSubmitting(false);
    }
  };

  const clearCart = async () => {
    try {
      await vendorApi.delete('/vendor/pos/cart', { headers });
      await setCartData(EMPTY_CART);
      resetDeliveryForm();
    } catch {
      toast.error('Could not clear the cart.');
    }
  };

  const scanItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    try {
      const response = await vendorApi.get('/vendor/pos/items/scan', { params: { code }, headers });
      const item = response.data.data as Item;
      openItem(item);
      setBarcode('');
      await fetchCart();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(message || 'Could not find this barcode or SKU.');
    }
  };

  const holdCart = async () => {
    try {
      await vendorApi.post('/vendor/pos/cart/hold', { storeId }, { headers });
      await setCartData(EMPTY_CART);
      resetDeliveryForm();
      await Promise.all([fetchCart(), fetchHeldCarts()]);
      toast.success('Cart held.');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(message || 'Could not hold this cart.');
    }
  };

  const resumeHeldCart = async (heldId: string) => {
    try {
      await vendorApi.post(`/vendor/pos/cart/held/${heldId}/resume`, { storeId }, { headers });
      resetDeliveryForm();
      await Promise.all([fetchCart(), fetchHeldCarts()]);
      toast.success('Held cart resumed.');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(message || 'Could not resume this cart.');
    }
  };

  const deleteHeldCart = async (heldId: string) => {
    try {
      await vendorApi.delete(`/vendor/pos/cart/held/${heldId}`, { headers, data: { storeId } });
      await fetchHeldCarts();
    } catch {
      toast.error('Could not delete this held cart.');
    }
  };

  const lines = cartData.cart?.items || [];
  const totals = cartData.totals;
  const selectedCustomer = typeof cartData.cart?.customerId === 'object' ? cartData.cart.customerId : null;
  const orderMode = cartData.cart?.orderMode || 'counter';

  if (session.isPending) return <p role="status" className="p-6">Opening POS session…</p>;
  if (session.isError) {
    return <div className="p-6"><p role="alert">Could not open POS session.</p><button type="button" className="underline" onClick={() => void session.refetch()}>Try again</button></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShoppingBag className="text-emerald-700" size={24} />
          <div><h1 className="text-xl font-bold text-slate-900">Point of Sale</h1><p className="text-sm text-slate-500">Create an in-store order</p></div>
        </div>
        {stores.length > 1 && (
          <select aria-label="Store" value={storeId} onChange={(event) => onStoreChange(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            {stores.map((store) => <option key={store._id} value={store._id}>{store.name}</option>)}
          </select>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <form onSubmit={(event) => void scanItem(event)} className="flex gap-2">
            <input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Scan or enter barcode / SKU" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            <button type="submit" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Add</button>
          </form>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search size={17} className="text-slate-400" />
            <input value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="Search store products" className="w-full text-sm outline-none" />
          </label>
          {catalog.isPending ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading products…</p> : catalog.isError && !items.length ? (
            <p role="alert" className="text-sm">Could not load products. <button type="button" className="underline" onClick={() => void catalog.refetch()}>Try again</button></p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <button key={item._id} type="button" disabled={item.stock <= 0} onClick={() => openItem(item)} className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="block truncate text-sm font-semibold text-slate-800">{item.name}</span>
                  <span className="mt-1 block text-sm text-emerald-700">{currency(item.price)}</span>
                  <span className="mt-1 block text-xs text-slate-500">Sellable: {item.stock}{item.trackBatch && item.nearestExpiry ? ` · Expires ${new Date(item.nearestExpiry).toLocaleDateString('en-IN')}` : ''}</span>
                </button>
              ))}
              {!items.length && <p className="col-span-full py-8 text-center text-sm text-slate-500">No products found for this store.</p>}
              {catalog.hasNextPage && <button type="button" disabled={catalog.isFetching} onClick={() => void catalog.fetchNextPage()} className="col-span-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{catalog.isFetchingNextPage ? 'Loading…' : 'Show more products'}</button>}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Customer (optional)</label>
            <input value={customerQuery} onChange={(event) => void searchCustomers(event.target.value)} placeholder="Search by name or phone" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            {customers.length > 0 && <ul className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-200">{customers.map((customer) => <li key={customer._id}><button type="button" onClick={() => void selectCustomer(customer._id)} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50">{customer.fName} {customer.lName} {customer.phone && `· ${customer.phone}`}</button></li>)}</ul>}
            {selectedCustomer && <p className="mt-2 text-xs text-emerald-700">Selected: {selectedCustomer.fName} {selectedCustomer.lName}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Order type</label>
            <select value={orderMode} onChange={(event) => void setOrderMode(event.target.value as 'counter' | 'delivery')} aria-label="Order type" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="counter">Counter pickup</option><option value="delivery">Home delivery</option>
            </select>
          </div>

          {orderMode === 'delivery' && (
            <form onSubmit={(event) => void saveDeliveryDetails(event)} className="space-y-3 rounded-xl border border-slate-200 p-3">
              <h2 className="text-sm font-semibold text-slate-800">Delivery details</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <input required value={deliveryForm.contact_person_name} onChange={(event) => setDeliveryForm({ ...deliveryForm, contact_person_name: event.target.value })} placeholder="Contact name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input required value={deliveryForm.contact_person_number} onChange={(event) => setDeliveryForm({ ...deliveryForm, contact_person_number: event.target.value })} placeholder="Contact phone" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input required value={deliveryForm.address} onChange={(event) => setDeliveryForm({ ...deliveryForm, address: event.target.value })} placeholder="Address / locality" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
                <input required value={deliveryForm.floor} onChange={(event) => setDeliveryForm({ ...deliveryForm, floor: event.target.value })} placeholder="Floor" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input required value={deliveryForm.road} onChange={(event) => setDeliveryForm({ ...deliveryForm, road: event.target.value })} placeholder="Road" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input required value={deliveryForm.house} onChange={(event) => setDeliveryForm({ ...deliveryForm, house: event.target.value })} placeholder="House / building" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
                <input required type="number" step="any" min="-90" max="90" value={deliveryForm.latitude} onChange={(event) => setDeliveryForm({ ...deliveryForm, latitude: event.target.value })} placeholder="Latitude" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input required type="number" step="any" min="-180" max="180" value={deliveryForm.longitude} onChange={(event) => setDeliveryForm({ ...deliveryForm, longitude: event.target.value })} placeholder="Longitude" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50">Save address and quote delivery</button>
              {cartData.cart?.deliveryAddress && <p className="text-xs text-emerald-700">Delivery area verified · {currency(totals?.deliveryCharge || 0)}</p>}
            </form>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200">
            {cart.isPending ? <p role="status" className="p-6 text-center text-sm text-slate-500">Loading cart…</p> : cart.isError ? <p role="alert" className="p-6 text-sm">Could not load cart. <button type="button" className="underline" onClick={() => void cart.refetch()}>Try again</button></p> : !lines.length ? <p className="p-6 text-center text-sm text-slate-500">Add products to start an order.</p> : (
              <ul className="divide-y divide-slate-100">{lines.map((line, index) => (
                <li key={`${line.itemId}-${index}`} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{line.itemName}</p><p className="text-xs text-slate-500">{currency(line.unitPrice)} each</p>{(line.variant || line.variations?.length || line.addOns?.length) ? <p className="truncate text-xs text-slate-600">{[line.variant, ...(line.variations || []).flatMap((group) => (group.values?.label || []).map((label) => `${group.name}: ${label}`)), ...(line.addOns || []).map((addon) => `${addon.name} ×${addon.qty}`)].filter(Boolean).join(' · ')}</p> : null}{line.offerLabel && <p className="text-xs font-medium text-emerald-700">{line.offerLabel}</p>}</div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button aria-label="Decrease quantity" onClick={() => void changeQuantity(index, line.qty - 1)} className="rounded p-1 hover:bg-slate-100"><Minus size={14} /></button>
                    <span className="w-6 text-center text-sm">{line.qty}</span>
                    <button aria-label="Increase quantity" onClick={() => void changeQuantity(index, line.qty + 1)} className="rounded p-1 hover:bg-slate-100"><Plus size={14} /></button>
                    <span className="w-20 text-right text-sm font-semibold">{currency(line.lineTotal)}</span>
                    <button aria-label="Remove product" onClick={() => void removeItem(index)} className="rounded p-1 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
                  </div>
                </li>
              ))}</ul>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{currency(totals?.itemSubtotal || 0)}</span></div>
            <div className="flex justify-between text-slate-600"><span>Discount</span><span>−{currency((totals?.itemDiscount || 0) + (totals?.extraDiscount || 0))}</span></div>
            <div className="flex justify-between text-slate-600"><span>Tax</span><span>{currency(totals?.taxTotal || 0)}</span></div>
            {orderMode === 'delivery' && <div className="flex justify-between text-slate-600"><span>Delivery</span><span>{currency(totals?.deliveryCharge || 0)}</span></div>}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900"><span>Total</span><span>{currency(totals?.grandTotal || 0)}</span></div>
          </div>
          <div className="flex gap-3">
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} aria-label="Payment method" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI</option><option value="wallet">Wallet</option><option value="other">Other</option>
            </select>
            <button disabled={submitting || !lines.length || !cart.isSuccess || (orderMode === 'delivery' && (!selectedCustomer || !cartData.cart?.deliveryAddress))} onClick={() => void placeOrder()} className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{submitting ? 'Placing…' : 'Place order'}</button>
          </div>
          <button disabled={!lines.length} onClick={() => void holdCart()} className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">Hold cart</button>
          <button disabled={!lines.length} onClick={() => void clearCart()} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Clear cart</button>
          <div className="border-t border-slate-200 pt-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Held carts</h2>
            {held.isPending ? <p role="status" className="text-xs">Loading held carts…</p> : held.isError ? <p role="alert" className="text-xs">Could not load held carts. <button type="button" className="underline" onClick={() => void held.refetch()}>Try again</button></p> : !heldCarts.length ? <p className="text-xs text-slate-500">No carts on hold.</p> : <ul className="space-y-2">{heldCarts.map((held) => (
              <li key={held._id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-2">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{held.label}</p><p className="text-xs text-slate-500">{held.itemCount} items</p></div>
                <div className="flex shrink-0 gap-2"><button onClick={() => void resumeHeldCart(held._id)} className="text-xs font-semibold text-emerald-700 hover:underline">Resume</button><button aria-label="Delete held cart" onClick={() => void deleteHeldCart(held._id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button></div>
              </li>
            ))}</ul>}
          </div>
        </section>
      </div>
      {pendingItem && <PosItemOptionsDialog item={pendingItem} onCancel={() => setPendingItem(null)} onConfirm={(selection) => { const item = pendingItem; setPendingItem(null); void addItem(item, selection); }} />}
    </div>
  );
}

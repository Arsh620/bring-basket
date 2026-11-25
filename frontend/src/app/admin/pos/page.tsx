'use client';

import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Minus, Plus, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api/client';
import PosItemOptionsDialog, { type PosItemSelection, type PosOptionItem } from '@/components/pos/PosItemOptionsDialog';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { useAuthStore } from '@/store/auth.store';
import { usePosDeliveryAddress, usePosWorkspace, type DeliveryAddress } from '@/components/pos/usePosWorkspace';

type Store = { _id: string; name: string };
type Item = PosOptionItem & { stock: number; suggestedQty?: number; scaleWeight?: boolean; trackBatch?: boolean; isPerishable?: boolean; nearestExpiry?: string | null; batches?: { _id: string; batchCode?: string; qty: number; expiryDate?: string | null }[] };
type Customer = { _id: string; fName: string; lName?: string; phone?: string };
type CartLine = { itemId: string | { _id: string }; itemName: string; unitPrice: number; qty: number; lineTotal: number; variant?: string; offerLabel?: string; variations?: { name: string; values?: { label?: string[] } }[]; addOns?: { name: string; qty: number }[]; addOnTotal?: number };
type CartData = {
  cart: { items: CartLine[]; orderMode?: 'counter' | 'delivery'; deliveryAddress?: DeliveryAddress | null; customerId?: Customer | string | null } | null;
  totals: { itemSubtotal: number; itemDiscount: number; extraDiscount: number; taxTotal: number; deliveryCharge: number; grandTotal: number } | null;
};
type HeldCart = { _id: string; label: string; itemCount: number };

const EMPTY_CART: CartData = { cart: null, totals: null };
const currency = (value: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(value || 0);

export default function PosPage() {
  return <AdminLayout><AdminPos /></AdminLayout>;
}

function AdminPos() {
  const operatorId = useAuthStore((state) => state.admin?._id);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const storesQuery = useQuery({
    queryKey: ['admin-pos-stores', operatorId],
    enabled: Boolean(operatorId),
    queryFn: async ({ signal }) => (await api.get<{ data: Store[] }>('/admin/pos/stores', { signal })).data.data ?? [],
  });
  const stores = storesQuery.data ?? [];
  const storeId = stores.find((store) => store._id === selectedStoreId)?._id ?? stores[0]?._id ?? '';
  if (storesQuery.isPending) return <p role="status" className="p-6">Loading stores…</p>;
  if (storesQuery.isError) {
    return <div className="p-6"><p role="alert">Could not load stores.</p><button type="button" className="underline" onClick={() => void storesQuery.refetch()}>Try again</button></div>;
  }
  if (!storeId) return <p role="status" className="p-6">No active stores are available in your assigned zone.</p>;
  return <AdminPosStore key={`${operatorId}:${storeId}`} operatorId={operatorId} storeId={storeId} stores={stores} onStoreChange={setSelectedStoreId} />;
}

function AdminPosStore({ operatorId, storeId, stores, onStoreChange }: {
  operatorId?: string; storeId: string; stores: Store[]; onStoreChange: (id: string) => void;
}) {
  const [itemQuery, setItemQuery] = useState('');
  const [barcode, setBarcode] = useState('');
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const { session, sessionId, headers, cart, held, catalog, setCartData } = usePosWorkspace<CartData, HeldCart, Item>(api, 'admin', operatorId, storeId, itemQuery);
  const cartData = cart.data ?? EMPTY_CART;
  const heldCarts = held.data ?? [];
  const items = catalog.data?.pages.flatMap((page) => page.items) ?? [];
  const [deliveryForm, setDeliveryForm, resetDeliveryForm] = usePosDeliveryAddress(sessionId, cartData.cart?.deliveryAddress);
  const orderMode = cartData.cart?.orderMode || 'counter';
  const lines = cartData.cart?.items || [];
  const totals = cartData.totals;
  const selectedCustomer = typeof cartData.cart?.customerId === 'object' ? cartData.cart.customerId : null;

  const fetchCart = () => cart.refetch({ throwOnError: true });
  const fetchHeldCarts = () => held.refetch({ throwOnError: true });

  const addItem = async (item: Item, qty = 1, selection?: PosItemSelection) => {
    try {
      await api.post('/admin/pos/cart/items', { storeId, itemId: item._id, qty, scaleWeight: item.scaleWeight, ...(selection || {}) }, { headers });
      await fetchCart();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(message || 'Could not add this product.');
    }
  };

  const openItem = (item: Item, qty = 1) => {
    const hasOptions = (value: unknown) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') { try { return JSON.parse(value).length > 0; } catch { return false; } }
      return Boolean(value);
    };
    if (hasOptions(item.foodVariations) || hasOptions(item.choiceOptions) || hasOptions(item.addOns)) setPendingItem({ ...item, suggestedQty: qty });
    else void addItem(item, qty);
  };

  const scanItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    try {
      const response = await api.get('/admin/pos/items/scan', { params: { code }, headers });
      const item = response.data.data as Item;
      openItem(item, item.suggestedQty || 1);
      setBarcode('');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(message || 'No available product matches this barcode or SKU.');
    }
  };

  const searchCustomers = async (query: string) => {
    setCustomerQuery(query);
    if (!query.trim()) { setCustomers([]); return; }
    try {
      const response = await api.get('/admin/pos/customers', { params: { q: query }, headers });
      setCustomers(response.data.data || []);
    } catch { toast.error('Could not search customers.'); }
  };

  const patchCart = async (body: Record<string, unknown>) => {
    const response = await api.patch('/admin/pos/cart/meta', body, { headers });
    await setCartData(response.data.data ?? EMPTY_CART);
  };

  const selectCustomer = async (customerId: string) => {
    try {
      await patchCart({ customerId });
      setCustomers([]);
      setCustomerQuery('');
    } catch {
      toast.error('Could not select this customer.');
    }
  };

  const changeQuantity = async (index: number, qty: number) => {
    if (qty <= 0) return;
    try { await api.put(`/admin/pos/cart/items/${index}`, { qty }, { headers }); await fetchCart(); }
    catch { toast.error('Could not update quantity.'); }
  };

  const removeItem = async (index: number) => {
    try { await api.delete(`/admin/pos/cart/items/${index}`, { headers }); await fetchCart(); }
    catch { toast.error('Could not remove product.'); }
  };

  const setOrderMode = async (mode: 'counter' | 'delivery') => {
    try {
      await patchCart({ orderMode: mode });
      if (mode === 'counter') resetDeliveryForm();
    } catch { toast.error('Could not update order type.'); }
  };

  const saveDeliveryDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await patchCart({ deliveryAddress: deliveryForm });
      resetDeliveryForm();
      toast.success('Address saved and delivery fee calculated.');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(message || 'Could not calculate delivery for this address.');
    }
  };

  const placeOrder = async () => {
    setLoading(true);
    try {
      await api.post('/admin/pos/cart/place-order', { paymentMethod }, { headers });
      toast.success('POS order placed.');
      await setCartData(EMPTY_CART);
      resetDeliveryForm();
      await fetchCart();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(message || 'Could not place this order.');
    } finally { setLoading(false); }
  };

  const holdCart = async () => {
    try {
      await api.post('/admin/pos/cart/hold', { storeId }, { headers });
      resetDeliveryForm();
      await Promise.all([fetchCart(), fetchHeldCarts()]);
      toast.success('Cart held.');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(message || 'Could not hold this cart.');
    }
  };

  const resumeHeldCart = async (id: string) => {
    try {
      await api.post(`/admin/pos/cart/held/${id}/resume`, { storeId }, { headers });
      resetDeliveryForm();
      await Promise.all([fetchCart(), fetchHeldCarts()]);
    } catch { toast.error('Could not resume held cart.'); }
  };

  const clearCart = async () => {
    try {
      await api.delete('/admin/pos/cart', { headers });
      await setCartData(EMPTY_CART);
      resetDeliveryForm();
      await fetchCart();
    }
    catch { toast.error('Could not clear cart.'); }
  };

  const deleteHeldCart = async (id: string) => {
    try { await api.delete(`/admin/pos/cart/held/${id}`, { headers, data: { storeId } }); await fetchHeldCarts(); }
    catch { toast.error('Could not delete held cart.'); }
  };

  if (session.isPending) return <p role="status" className="p-6">Opening POS session…</p>;
  if (session.isError) {
    return <div className="p-6"><p role="alert">Could not open POS session.</p><button type="button" className="underline" onClick={() => void session.refetch()}>Try again</button></div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><ShoppingBag size={22} className="text-[#08234b]" /><div><h1 className="text-xl font-bold text-slate-900">Point of Sale</h1><p className="text-sm text-slate-500">Admin in-store orders</p></div></div>
        <select aria-label="Store" value={storeId} onChange={(event) => onStoreChange(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:w-auto sm:min-w-60">
          {stores.map((store) => <option key={store._id} value={store._id}>{store.name}</option>)}
        </select>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <form onSubmit={(event) => void scanItem(event)} className="flex gap-2"><input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Scan barcode or enter SKU" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" /><button className="rounded-lg bg-[#08234b] px-4 py-2 text-sm font-semibold text-white">Add</button></form>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><Search size={16} className="text-slate-400" /><input value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="Search products" className="w-full text-sm outline-none" /></label>
          {catalog.isPending ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading products…</p> : catalog.isError && !items.length ? (
            <p role="alert" className="text-sm">Could not load products. <button type="button" className="underline" onClick={() => void catalog.refetch()}>Try again</button></p>
          ) : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => <button key={item._id} disabled={item.stock <= 0} onClick={() => openItem(item)} className="rounded-xl border border-slate-200 p-3 text-left hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"><span className="block truncate text-sm font-semibold">{item.name}</span><span className="mt-1 block text-sm text-blue-700">{currency(item.price)}</span><span className="mt-1 block text-xs text-slate-500">Sellable: {item.stock}{item.trackBatch && item.nearestExpiry ? ` · Expires ${new Date(item.nearestExpiry).toLocaleDateString('en-IN')}` : ''}</span></button>)}
            {!items.length && <p className="col-span-full py-8 text-center text-sm text-slate-500">No products found.</p>}
            {catalog.hasNextPage && <button disabled={catalog.isFetching} onClick={() => void catalog.fetchNextPage()} className="col-span-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{catalog.isFetchingNextPage ? 'Loading…' : 'Show more'}</button>}
          </div>}
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div><label className="mb-2 block text-sm font-medium">Customer (optional for counter)</label><input value={customerQuery} onChange={(event) => void searchCustomers(event.target.value)} placeholder="Search name or phone" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            {customers.length > 0 && <ul className="mt-2 max-h-36 overflow-auto rounded-lg border">{customers.map((customer) => <li key={customer._id}><button onClick={() => void selectCustomer(customer._id)} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50">{customer.fName} {customer.lName} · {customer.phone}</button></li>)}</ul>}
            {selectedCustomer && <p className="mt-2 text-xs text-emerald-700">Selected: {selectedCustomer.fName} {selectedCustomer.lName}</p>}
          </div>

          <div><label className="mb-2 block text-sm font-medium">Order type</label><select value={orderMode} onChange={(event) => void setOrderMode(event.target.value as 'counter' | 'delivery')} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="counter">Counter pickup</option><option value="delivery">Home delivery</option></select></div>
          {orderMode === 'delivery' && <form onSubmit={(event) => void saveDeliveryDetails(event)} className="space-y-2 rounded-xl border p-3"><h2 className="text-sm font-semibold">Delivery address</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <input required placeholder="Contact name" value={deliveryForm.contact_person_name} onChange={(e) => setDeliveryForm({ ...deliveryForm, contact_person_name: e.target.value })} className="rounded border px-3 py-2 text-sm" />
              <input required placeholder="Contact phone" value={deliveryForm.contact_person_number} onChange={(e) => setDeliveryForm({ ...deliveryForm, contact_person_number: e.target.value })} className="rounded border px-3 py-2 text-sm" />
              <input required placeholder="Address / locality" value={deliveryForm.address} onChange={(e) => setDeliveryForm({ ...deliveryForm, address: e.target.value })} className="rounded border px-3 py-2 text-sm sm:col-span-2" />
              <input required placeholder="Floor" value={deliveryForm.floor} onChange={(e) => setDeliveryForm({ ...deliveryForm, floor: e.target.value })} className="rounded border px-3 py-2 text-sm" />
              <input required placeholder="Road" value={deliveryForm.road} onChange={(e) => setDeliveryForm({ ...deliveryForm, road: e.target.value })} className="rounded border px-3 py-2 text-sm" />
              <input required placeholder="House / building" value={deliveryForm.house} onChange={(e) => setDeliveryForm({ ...deliveryForm, house: e.target.value })} className="rounded border px-3 py-2 text-sm sm:col-span-2" />
              <input required type="number" step="any" min="-90" max="90" placeholder="Latitude" value={deliveryForm.latitude} onChange={(e) => setDeliveryForm({ ...deliveryForm, latitude: e.target.value })} className="rounded border px-3 py-2 text-sm" />
              <input required type="number" step="any" min="-180" max="180" placeholder="Longitude" value={deliveryForm.longitude} onChange={(e) => setDeliveryForm({ ...deliveryForm, longitude: e.target.value })} className="rounded border px-3 py-2 text-sm" />
            </div><button className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm text-emerald-800">Save address and quote fee</button>
            {cartData.cart?.deliveryAddress && <p className="text-xs text-emerald-700">Delivery fee: {currency(totals?.deliveryCharge || 0)}</p>}
          </form>}

          <div className="max-h-64 overflow-auto rounded-xl border"><div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Cart</div>{cart.isPending ? <p role="status" className="p-5 text-sm">Loading cart…</p> : cart.isError ? <p role="alert" className="p-5 text-sm">Could not load cart. <button type="button" className="underline" onClick={() => void cart.refetch()}>Try again</button></p> : !lines.length ? <p className="p-5 text-center text-sm text-slate-500">Add products to start an order.</p> : <ul className="divide-y">{lines.map((line, index) => <li key={`${typeof line.itemId === 'string' ? line.itemId : line.itemId._id}-${index}`} className="flex items-center justify-between gap-2 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{line.itemName}</p><p className="text-xs text-slate-500">{currency(line.unitPrice)} each</p>{(line.variant || line.variations?.length || line.addOns?.length) ? <p className="truncate text-xs text-slate-600">{[line.variant, ...(line.variations || []).flatMap((group) => (group.values?.label || []).map((label) => `${group.name}: ${label}`)), ...(line.addOns || []).map((addon) => `${addon.name} ×${addon.qty}`)].filter(Boolean).join(' · ')}</p> : null}{line.offerLabel && <p className="text-xs font-medium text-emerald-700">{line.offerLabel}</p>}</div><div className="flex items-center gap-1"><button aria-label="Decrease quantity" onClick={() => void changeQuantity(index, line.qty - 1)} className="p-1"><Minus size={14} /></button><span className="w-6 text-center text-sm">{line.qty}</span><button aria-label="Increase quantity" onClick={() => void changeQuantity(index, line.qty + 1)} className="p-1"><Plus size={14} /></button><span className="w-20 text-right text-sm font-semibold">{currency(line.lineTotal)}</span><button aria-label="Remove product" onClick={() => void removeItem(index)} className="p-1 text-red-500"><Trash2 size={14} /></button></div></li>)}</ul>}</div>

          <div className="space-y-1 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{currency(totals?.itemSubtotal || 0)}</span></div><div className="flex justify-between"><span>Discount</span><span>−{currency((totals?.itemDiscount || 0) + (totals?.extraDiscount || 0))}</span></div><div className="flex justify-between"><span>Tax</span><span>{currency(totals?.taxTotal || 0)}</span></div>{orderMode === 'delivery' && <div className="flex justify-between"><span>Delivery</span><span>{currency(totals?.deliveryCharge || 0)}</span></div>}<div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{currency(totals?.grandTotal || 0)}</span></div></div>
          <div className="flex gap-2"><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} aria-label="Payment method" className="rounded-lg border bg-white px-2 text-sm"><option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI</option><option value="wallet">Wallet</option><option value="other">Other</option></select><button disabled={loading || !cart.isSuccess || !lines.length || (orderMode === 'delivery' && (!selectedCustomer || !cartData.cart?.deliveryAddress))} onClick={() => void placeOrder()} className="flex-1 rounded-lg bg-[#08234b] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Placing…' : 'Place order'}</button></div>
          <button disabled={!lines.length} onClick={() => void holdCart()} className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-blue-800 disabled:opacity-50">Hold cart</button>
          <button disabled={!lines.length} onClick={() => void clearCart()} className="w-full rounded-lg border px-3 py-2 text-sm text-slate-600 disabled:opacity-50">Clear cart</button>
          <div className="border-t pt-3"><h2 className="mb-2 text-sm font-semibold">Held carts</h2>{held.isPending ? <p role="status" className="text-xs">Loading held carts…</p> : held.isError ? <p role="alert" className="text-xs">Could not load held carts. <button type="button" className="underline" onClick={() => void held.refetch()}>Try again</button></p> : !heldCarts.length ? <p className="text-xs text-slate-500">No carts on hold.</p> : <ul className="space-y-2">{heldCarts.map((held) => <li key={held._id} className="flex items-center justify-between rounded bg-slate-50 p-2"><span className="text-sm">{held.label} · {held.itemCount} items</span><div className="flex gap-2"><button onClick={() => void resumeHeldCart(held._id)} className="text-xs font-semibold text-blue-700">Resume</button><button onClick={() => void deleteHeldCart(held._id)} aria-label="Delete held cart" className="text-red-500"><Trash2 size={14} /></button></div></li>)}</ul>}</div>
        </section>
      </div>
      {pendingItem && <PosItemOptionsDialog item={pendingItem} onCancel={() => setPendingItem(null)} onConfirm={(selection) => { const item = pendingItem; setPendingItem(null); void addItem(item, item.suggestedQty || 1, selection); }} />}
    </div>
  );
}

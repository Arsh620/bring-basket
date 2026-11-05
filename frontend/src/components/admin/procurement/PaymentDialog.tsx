'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { LoaderCircle, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api/client';

type Vendor = { _id: string; displayName: string; legalName?: string };
type BillChoice = { _id: string; billNumber: number; status: string; balanceDue: number };
type FixedBill = {
  _id: string;
  billNumber: number;
  balanceDue: number;
  purchaseVendorId: { _id: string; displayName?: string } | null;
};

function msg(error: unknown) {
  if (error instanceof AxiosError) return error.response?.data?.message || error.message;
  return error instanceof Error ? error.message : 'Request failed';
}

function today() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function PaymentDialog({
  fixedBill,
  onClose,
  onSaved,
}: {
  fixedBill?: FixedBill;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [vendorId, setVendorId] = useState(fixedBill?.purchaseVendorId?._id ?? '');
  const [billId, setBillId] = useState(fixedBill?._id ?? '');
  const [paymentDate, setPaymentDate] = useState(today);
  const [amount, setAmount] = useState(fixedBill ? String(fixedBill.balanceDue) : '');
  const [mode, setMode] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const vendors = useQuery({
    queryKey: ['payment-vendors'],
    enabled: !fixedBill,
    queryFn: async () => {
      const { data } = await api.get('/admin/purchases/vendors', {
        params: { page: 1, limit: 100, approval: 'approved', status: 'true' },
      });
      return (data.data ?? []) as Vendor[];
    },
  });
  const bills = useQuery({
    queryKey: ['payment-open-bills', vendorId],
    enabled: Boolean(vendorId) && !fixedBill,
    queryFn: async () => {
      const { data } = await api.get('/admin/purchases/bills', {
        params: { page: 1, limit: 100, purchaseVendorId: vendorId },
      });
      return (data.data ?? []) as BillChoice[];
    },
  });
  const openBills = (bills.data ?? []).filter(
    bill => ['open', 'partially_paid'].includes(bill.status) && Number(bill.balanceDue) > 0,
  );
  const selectedBill = fixedBill
    ? { _id: fixedBill._id, balanceDue: fixedBill.balanceDue, billNumber: fixedBill.billNumber }
    : openBills.find(bill => bill._id === billId);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const numericAmount = Number(amount);
    if (!vendorId) {
      setError('Select a vendor for this payment.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter a payment amount greater than zero.');
      return;
    }
    if (selectedBill && numericAmount - Number(selectedBill.balanceDue) > 0.009) {
      setError(`Payment cannot exceed the bill balance of ₹${Number(selectedBill.balanceDue).toFixed(2)}.`);
      return;
    }

    setSaving(true);
    try {
      await api.post('/admin/purchases/payments', {
        purchaseVendorId: vendorId,
        ...(billId ? { purchaseBillId: billId } : {}),
        paymentDate,
        amount: numericAmount,
        mode,
        reference: reference.trim(),
        notes: notes.trim(),
      });
      await onSaved();
      onClose();
    } catch (submitError) {
      setError(msg(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="record-payment-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0b55ad]">Purchases</p>
            <h2 id="record-payment-title" className="mt-1 text-xl font-bold text-[#0b2346]">Record payment</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close payment form" onClick={onClose} disabled={saving}>
            <X size={18} />
          </Button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-5 py-5">
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {!fixedBill && (
            <div>
              <Label htmlFor="payment-vendor">Vendor *</Label>
              <select
                id="payment-vendor"
                required
                value={vendorId}
                onChange={event => {
                  setVendorId(event.target.value);
                  setBillId('');
                  setAmount('');
                }}
                disabled={vendors.isLoading || vendors.isError}
                className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
              >
                <option value="">{vendors.isLoading ? 'Loading vendors…' : 'Select vendor'}</option>
                {(vendors.data ?? []).map(vendor => (
                  <option key={vendor._id} value={vendor._id}>{vendor.displayName}</option>
                ))}
              </select>
              {vendors.isError && <p role="alert" className="mt-1 text-xs text-red-700">{msg(vendors.error)}</p>}
            </div>
          )}
          {fixedBill ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <p><span className="font-semibold">Vendor:</span> {fixedBill.purchaseVendorId?.displayName || '—'}</p>
              <p className="mt-1"><span className="font-semibold">Bill:</span> #{String(fixedBill.billNumber).padStart(5, '0')} · balance ₹{Number(fixedBill.balanceDue).toFixed(2)}</p>
            </div>
          ) : vendorId && (
            <div>
              <Label htmlFor="payment-bill">Allocate to bill</Label>
              <select
                id="payment-bill"
                value={billId}
                onChange={event => {
                  const nextBillId = event.target.value;
                  setBillId(nextBillId);
                  const nextBill = openBills.find(bill => bill._id === nextBillId);
                  setAmount(nextBill ? String(nextBill.balanceDue) : '');
                }}
                disabled={bills.isLoading || bills.isError}
                className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
              >
                <option value="">Unallocated vendor payment</option>
                {openBills.map(bill => (
                  <option key={bill._id} value={bill._id}>
                    Bill #{String(bill.billNumber).padStart(5, '0')} · due ₹{Number(bill.balanceDue).toFixed(2)}
                  </option>
                ))}
              </select>
              {bills.isError && <p role="alert" className="mt-1 text-xs text-red-700">{msg(bills.error)}</p>}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="payment-date">Payment date *</Label><Input id="payment-date" type="date" required value={paymentDate} onChange={event => setPaymentDate(event.target.value)} className="mt-1" /></div>
            <div><Label htmlFor="payment-amount">Amount (₹) *</Label><Input id="payment-amount" type="number" min="0.01" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} className="mt-1" /></div>
            <div>
              <Label htmlFor="payment-mode">Payment mode</Label>
              <select id="payment-mode" value={mode} onChange={event => setMode(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm">
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          {selectedBill && <p className="text-xs text-gray-500">Maximum for this bill: ₹{Number(selectedBill.balanceDue).toFixed(2)}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="payment-reference">Reference</Label><Input id="payment-reference" maxLength={120} value={reference} onChange={event => setReference(event.target.value)} className="mt-1" /></div>
            <div><Label htmlFor="payment-notes">Notes</Label><Input id="payment-notes" maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} className="mt-1" /></div>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || vendors.isError || bills.isError} className="bg-[#0b438d] text-white hover:bg-[#082f68]">
              {saving && <LoaderCircle size={15} className="animate-spin" />} Save payment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

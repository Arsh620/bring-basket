'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { ArrowLeft, LoaderCircle, Truck } from 'lucide-react';
import { toast } from 'sonner';
import supplierApi from '@/lib/api/supplier';

type RegistrationOptions = {
  states: string[];
  gstTreatments: Record<string, string>;
  salutations: string[];
  paymentTerms: string[];
  languages: string[];
  currencies: string[];
};

type Contact = {
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  workPhone: string;
  mobile: string;
};

type Bank = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  accountNumberConfirm: string;
  ifsc: string;
  branch: string;
};

const initialContact: Contact = {
  salutation: '', firstName: '', lastName: '', email: '', workPhone: '', mobile: '',
};
const initialBank: Bank = {
  accountHolderName: '', bankName: '', accountNumber: '', accountNumberConfirm: '', ifsc: '', branch: '',
};
const initialFields: Record<string, string> = {
  salutation: '', firstName: '', lastName: '', legalName: '', displayName: '', email: '',
  workPhone: '', mobile: '', language: 'English', gstTreatment: '', sourceOfSupply: '',
  gstin: '', pan: '', currency: 'INR', paymentTerms: '', tds: '', notes: '',
  billingAttention: '', billingCountry: 'India', billingAddressLine1: '', billingAddressLine2: '',
  billingCity: '', billingState: '', billingZip: '', billingPhone: '',
  shippingAttention: '', shippingCountry: 'India', shippingAddressLine1: '', shippingAddressLine2: '',
  shippingCity: '', shippingState: '', shippingZip: '', shippingPhone: '',
};
const fieldClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10';

function messageFrom(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message || error.message;
  return error instanceof Error ? error.message : 'Registration failed. Please try again.';
}

function TextField({
  label, name, value, onChange, required = false, type = 'text', maxLength,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}{required && <span className="text-red-600"> *</span>}
      <input
        name={name}
        type={type}
        value={value}
        maxLength={maxLength}
        required={required}
        onChange={(event) => onChange(name, event.target.value)}
        className={fieldClass}
      />
    </label>
  );
}

function SelectField({
  label, name, value, values, onChange, required = false,
}: {
  label: string;
  name: string;
  value: string;
  values: Array<string | [string, string]>;
  onChange: (name: string, value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}{required && <span className="text-red-600"> *</span>}
      <select
        name={name}
        value={value}
        required={required}
        onChange={(event) => onChange(name, event.target.value)}
        className={fieldClass}
      >
        <option value="">Select</option>
        {values.map((entry) => {
          const [optionValue, optionLabel] = Array.isArray(entry) ? entry : [entry, entry];
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
    </label>
  );
}

export default function SupplierRegisterPage() {
  const router = useRouter();
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  const [fields, setFields] = useState(initialFields);
  const [contacts, setContacts] = useState<Contact[]>([{ ...initialContact }]);
  const [banks, setBanks] = useState<Bank[]>([{ ...initialBank }]);
  const [documents, setDocuments] = useState<FileList | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    supplierApi.get('/supplier/registration/options')
      .then(({ data }) => { if (active) setOptions(data.data as RegistrationOptions); })
      .catch((error: unknown) => { if (active) setLoadError(messageFrom(error)); })
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, []);

  const updateField = (name: string, value: string) => {
    setFields((current) => ({ ...current, [name]: value }));
  };

  const updateContact = (index: number, name: keyof Contact, value: string) => {
    setContacts((current) => current.map((contact, row) => (
      row === index ? { ...contact, [name]: value } : contact
    )));
  };

  const updateBank = (index: number, name: keyof Bank, value: string) => {
    setBanks((current) => current.map((bank, row) => (
      row === index ? { ...bank, [name]: value } : bank
    )));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    if (!documents?.length) {
      setErrorMessage('Upload at least one supporting document.');
      return;
    }
    if (documents.length > 10) {
      setErrorMessage('You can upload a maximum of 10 documents.');
      return;
    }
    if (photo && photo.size > 5 * 1024 * 1024) {
      setErrorMessage('Profile photo must not exceed 5 MB.');
      return;
    }

    const body = new FormData();
    Object.entries(fields).forEach(([name, value]) => body.append(name, value));
    body.append('termsAccepted', String(termsAccepted));
    body.append('msmeRegistered', String((event.currentTarget.elements.namedItem('msmeRegistered') as HTMLInputElement).checked));
    body.append('contacts', JSON.stringify(contacts));
    body.append('banks', JSON.stringify(banks));
    body.append('addresses', JSON.stringify([
      {
        attention: fields.billingAttention,
        country: fields.billingCountry,
        addressLine1: fields.billingAddressLine1,
        addressLine2: fields.billingAddressLine2,
        city: fields.billingCity,
        state: fields.billingState,
        zip: fields.billingZip,
        phone: fields.billingPhone,
      },
      {
        attention: fields.shippingAttention,
        country: fields.shippingCountry,
        addressLine1: fields.shippingAddressLine1,
        addressLine2: fields.shippingAddressLine2,
        city: fields.shippingCity,
        state: fields.shippingState,
        zip: fields.shippingZip,
        phone: fields.shippingPhone,
      },
    ]));
    Array.from(documents).forEach((file) => body.append('documents', file));
    if (photo) body.append('photo', photo);

    setBusy(true);
    try {
      await supplierApi.post('/supplier/registration', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Registration submitted for review');
      router.replace('/supplier/register/success');
    } catch (error: unknown) {
      setErrorMessage(messageFrom(error));
    } finally {
      setBusy(false);
    }
  };

  if (loadingOptions) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-slate-600"><LoaderCircle className="mr-2 animate-spin" size={18} /> Loading registration form…</main>;
  }
  if (loadError || !options) {
    return <main className="mx-auto max-w-lg p-8 text-center"><p role="alert" className="text-sm text-red-700">{loadError || 'Registration options could not be loaded.'}</p></main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white"><Truck size={23} /></div>
            <h1 className="text-2xl font-bold text-slate-900">Supplier registration</h1>
            <p className="mt-1 text-sm text-slate-600">Register as a Bring Basket purchase supplier.</p>
          </div>
          <Link href="/supplier/login" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"><ArrowLeft size={15} /> Sign in</Link>
        </header>

        <form onSubmit={submit} className="space-y-6">
          {errorMessage && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errorMessage}</p>}

          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Business and contact details</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField label="Salutation" name="salutation" value={fields.salutation} values={options.salutations} onChange={updateField} />
              <TextField label="First name" name="firstName" value={fields.firstName} onChange={updateField} required maxLength={255} />
              <TextField label="Last name" name="lastName" value={fields.lastName} onChange={updateField} required maxLength={255} />
              <TextField label="Company / legal name" name="legalName" value={fields.legalName} onChange={updateField} required maxLength={255} />
              <TextField label="Display name" name="displayName" value={fields.displayName} onChange={updateField} required maxLength={255} />
              <TextField label="Email" name="email" type="email" value={fields.email} onChange={updateField} required maxLength={255} />
              <TextField label="Work phone" name="workPhone" value={fields.workPhone} onChange={updateField} maxLength={30} />
              <TextField label="Mobile" name="mobile" value={fields.mobile} onChange={updateField} required maxLength={30} />
              <SelectField label="Preferred language" name="language" value={fields.language} values={options.languages} onChange={updateField} required />
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Tax and payment details</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField label="GST treatment" name="gstTreatment" value={fields.gstTreatment} values={Object.entries(options.gstTreatments)} onChange={updateField} required />
              <SelectField label="Source of supply" name="sourceOfSupply" value={fields.sourceOfSupply} values={options.states} onChange={updateField} required />
              <TextField label="GSTIN" name="gstin" value={fields.gstin} onChange={updateField} required maxLength={20} />
              <TextField label="PAN" name="pan" value={fields.pan} onChange={updateField} required maxLength={20} />
              <SelectField label="Currency" name="currency" value={fields.currency} values={options.currencies} onChange={updateField} required />
              <SelectField label="Payment terms" name="paymentTerms" value={fields.paymentTerms} values={options.paymentTerms} onChange={updateField} />
              <TextField label="TDS" name="tds" value={fields.tds} onChange={updateField} />
              <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                <input type="checkbox" name="msmeRegistered" className="h-4 w-4 accent-emerald-600" /> MSME registered
              </label>
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-3">
                Remarks
                <textarea name="notes" value={fields.notes} onChange={(event) => updateField('notes', event.target.value)} rows={3} className={fieldClass} />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Addresses</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {(['billing', 'shipping'] as const).map((type) => {
                const prefix = type === 'billing' ? 'billing' : 'shipping';
                const required = type === 'billing';
                return (
                  <fieldset key={type} className="space-y-3">
                    <legend className="mb-1 font-medium capitalize text-slate-800">{type} address</legend>
                    <TextField label="Attention" name={`${prefix}Attention`} value={fields[`${prefix}Attention`]} onChange={updateField} />
                    <TextField label="Country" name={`${prefix}Country`} value={fields[`${prefix}Country`]} onChange={updateField} />
                    <TextField label="Address line 1" name={`${prefix}AddressLine1`} value={fields[`${prefix}AddressLine1`]} onChange={updateField} required={required} maxLength={255} />
                    <TextField label="Address line 2" name={`${prefix}AddressLine2`} value={fields[`${prefix}AddressLine2`]} onChange={updateField} maxLength={255} />
                    <TextField label="City" name={`${prefix}City`} value={fields[`${prefix}City`]} onChange={updateField} required={required} maxLength={100} />
                    <SelectField label="State" name={`${prefix}State`} value={fields[`${prefix}State`]} values={options.states} onChange={updateField} required={required} />
                    <TextField label="PIN code" name={`${prefix}Zip`} value={fields[`${prefix}Zip`]} onChange={updateField} required={required} maxLength={20} />
                    <TextField label="Phone" name={`${prefix}Phone`} value={fields[`${prefix}Phone`]} onChange={updateField} maxLength={30} />
                  </fieldset>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-semibold text-slate-900">Contact persons</h2><p className="text-sm text-slate-500">The first contact requires a name and mobile.</p></div>
              <button type="button" onClick={() => setContacts((rows) => [...rows, { ...initialContact }])} disabled={contacts.length >= 10} className="text-sm font-semibold text-emerald-700 hover:underline disabled:opacity-50">+ Add contact</button>
            </div>
            <div className="space-y-4">
              {contacts.map((contact, index) => (
                <div key={index} className="grid gap-3 border-b border-slate-100 pb-4 sm:grid-cols-2 lg:grid-cols-3">
                  <SelectField label="Salutation" name={`contactSalutation${index}`} value={contact.salutation} values={options.salutations} onChange={(_, value) => updateContact(index, 'salutation', value)} />
                  <TextField label="First name" name={`contactFirstName${index}`} value={contact.firstName} onChange={(_, value) => updateContact(index, 'firstName', value)} required={index === 0} />
                  <TextField label="Last name" name={`contactLastName${index}`} value={contact.lastName} onChange={(_, value) => updateContact(index, 'lastName', value)} />
                  <TextField label="Email" name={`contactEmail${index}`} type="email" value={contact.email} onChange={(_, value) => updateContact(index, 'email', value)} />
                  <TextField label="Work phone" name={`contactWorkPhone${index}`} value={contact.workPhone} onChange={(_, value) => updateContact(index, 'workPhone', value)} />
                  <TextField label="Mobile" name={`contactMobile${index}`} value={contact.mobile} onChange={(_, value) => updateContact(index, 'mobile', value)} required={index === 0} maxLength={30} />
                  {index > 0 && <button type="button" onClick={() => setContacts((rows) => rows.filter((_, row) => row !== index))} className="justify-self-start text-sm text-red-700 hover:underline">Remove contact</button>}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-semibold text-slate-900">Bank details</h2><p className="text-sm text-slate-500">The first bank account is required; account number confirmation must match.</p></div>
              <button type="button" onClick={() => setBanks((rows) => [...rows, { ...initialBank }])} disabled={banks.length >= 10} className="text-sm font-semibold text-emerald-700 hover:underline disabled:opacity-50">+ Add bank account</button>
            </div>
            <div className="space-y-5">
              {banks.map((bank, index) => (
                <div key={index} className="grid gap-3 border-b border-slate-100 pb-4 sm:grid-cols-2 lg:grid-cols-3">
                  <TextField label="Account holder" name={`bankHolder${index}`} value={bank.accountHolderName} onChange={(_, value) => updateBank(index, 'accountHolderName', value)} required={index === 0} />
                  <TextField label="Bank name" name={`bankName${index}`} value={bank.bankName} onChange={(_, value) => updateBank(index, 'bankName', value)} required={index === 0} />
                  <TextField label="Account number" name={`bankAccount${index}`} value={bank.accountNumber} onChange={(_, value) => updateBank(index, 'accountNumber', value)} required={index === 0} maxLength={50} />
                  <TextField label="Confirm account number" name={`bankAccountConfirm${index}`} value={bank.accountNumberConfirm} onChange={(_, value) => updateBank(index, 'accountNumberConfirm', value)} required={index === 0} maxLength={50} />
                  <TextField label="IFSC" name={`bankIfsc${index}`} value={bank.ifsc} onChange={(_, value) => updateBank(index, 'ifsc', value)} required={index === 0} maxLength={20} />
                  <TextField label="Branch" name={`bankBranch${index}`} value={bank.branch} onChange={(_, value) => updateBank(index, 'branch', value)} />
                  {index > 0 && <button type="button" onClick={() => setBanks((rows) => rows.filter((_, row) => row !== index))} className="justify-self-start text-sm text-red-700 hover:underline">Remove bank account</button>}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Documents and terms</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Supporting documents <span className="text-red-600">*</span>
                <input type="file" required multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(event) => setDocuments(event.target.files)} className={fieldClass} />
                <span className="mt-1 block text-xs font-normal text-slate-500">Upload 1-10 PDF, image, DOC, or DOCX files; maximum 10 MB per file.</span>
              </label>
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Profile photo
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} className={fieldClass} />
                <span className="mt-1 block text-xs font-normal text-slate-500">Optional; JPEG, PNG, or WebP up to 5 MB.</span>
              </label>
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <button type="button" onClick={() => setShowTerms(true)} className="font-semibold text-emerald-700 underline">Read Terms of Trade</button>
              <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required className="mt-1 h-4 w-4 accent-emerald-600" />
                <span>I have read and agree to the Terms of Trade.</span>
              </label>
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-3">
            <Link href="/supplier/login" className="rounded-xl border bg-white px-5 py-3 text-sm font-semibold text-slate-700">Cancel</Link>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {busy && <LoaderCircle size={16} className="animate-spin" />}{busy ? 'Submitting…' : 'Submit registration'}
            </button>
          </div>
        </form>
      </div>

      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
          <section role="dialog" aria-modal="true" aria-labelledby="terms-title" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b p-4">
              <h2 id="terms-title" className="text-lg font-bold text-slate-900">Terms of Trade</h2>
              <button type="button" onClick={() => setShowTerms(false)} aria-label="Close Terms of Trade" className="rounded-lg px-3 py-1 text-slate-600 hover:bg-slate-100">Close</button>
            </header>
            <div className="overflow-y-auto bg-slate-200 p-3">
              {Array.from({ length: 13 }, (_, index) => index + 1).map((page) => (
                <Image
                  key={page}
                  src={`/assets/supplier/terms-of-trade/page-${String(page).padStart(2, '0')}.jpg`}
                  alt={`Terms of Trade page ${page}`}
                  width={1200}
                  height={1600}
                  loading={page === 1 ? 'eager' : 'lazy'}
                  className="mx-auto mb-3 h-auto w-full max-w-3xl bg-white shadow"
                />
              ))}
            </div>
            <footer className="flex justify-end gap-3 border-t p-4">
              <button type="button" onClick={() => setShowTerms(false)} className="rounded-xl border px-4 py-2 text-sm">Close</button>
              <button type="button" onClick={() => { setTermsAccepted(true); setShowTerms(false); }} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Agree</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

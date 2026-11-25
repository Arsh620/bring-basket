'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { LoaderCircle } from 'lucide-react';
import supplierApi from '@/lib/api/supplier';
import { SupplierPortalShell } from '@/components/supplier/SupplierPortalShell';

type SupplierProfile = {
  displayName: string;
  legalName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  workPhone?: string;
  gstTreatment?: string;
  gstin?: string;
  pan?: string;
  sourceOfSupply?: string;
  currency?: string;
  language?: string;
  paymentTerms?: string;
  approvalStatus?: string;
  addresses?: Array<{ type: string; addressLine1?: string; addressLine2?: string; city?: string; state?: string; zip?: string; country?: string; phone?: string }>;
  banks?: Array<{ accountHolderName?: string; bankName?: string; accountNumber?: string; ifsc?: string; branch?: string }>;
  contacts?: Array<{ firstName?: string; lastName?: string; email?: string; mobile?: string; workPhone?: string }>;
  documents?: Array<{ _id: string; originalName: string; size: number; contentType: string }>;
};

const value = (input?: string) => input?.trim() || '—';

export default function SupplierProfilePage() {
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    supplierApi.get<{ data: SupplierProfile }>('/supplier/profile')
      .then(({ data }) => { if (active) setProfile(data.data); })
      .catch((error: unknown) => { if (active) setErrorMessage(axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || 'Profile could not be loaded.' : 'Profile could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <SupplierPortalShell>
      {loading ? <div className="flex items-center justify-center rounded-2xl border bg-white p-12 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18} /> Loading profile…</div>
        : errorMessage ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{errorMessage}</p>
          : profile ? <div className="space-y-5">
            <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-bold text-slate-900">Supplier profile</h1><p className="mt-1 text-sm text-slate-500">Contact procurement to update registration details.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium capitalize text-amber-900">{value(profile.approvalStatus)}</span></div>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Display name', profile.displayName], ['Legal name', profile.legalName],
                  ['Contact name', `${profile.firstName || ''} ${profile.lastName || ''}`.trim()],
                  ['Email', profile.email], ['Mobile', profile.mobile], ['Work phone', profile.workPhone],
                  ['GST treatment', profile.gstTreatment], ['GSTIN', profile.gstin], ['PAN', profile.pan],
                  ['Source of supply', profile.sourceOfSupply], ['Currency', profile.currency],
                  ['Language', profile.language], ['Payment terms', profile.paymentTerms],
                ].map(([label, fieldValue]) => <div key={label}><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-900">{value(fieldValue)}</dd></div>)}
              </dl>
            </section>
            <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
              <h2 className="font-semibold text-slate-900">Addresses</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {profile.addresses?.map((address, index) => <article key={`${address.type}-${index}`} className="rounded-xl border p-4"><h3 className="font-medium capitalize text-slate-800">{address.type}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{[address.addressLine1, address.addressLine2, address.city, address.state, address.zip, address.country].filter(Boolean).join(', ') || 'No address provided'}</p><p className="text-sm text-slate-500">{value(address.phone)}</p></article>)}
                {!profile.addresses?.length && <p className="text-sm text-slate-500">No addresses provided.</p>}
              </div>
            </section>
            <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
              <h2 className="font-semibold text-slate-900">Contacts and bank accounts</h2>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <div><h3 className="text-sm font-medium text-slate-700">Contact persons</h3><ul className="mt-2 space-y-2">{profile.contacts?.map((contact, index) => <li key={index} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-medium">{[contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Contact'}</p><p className="text-slate-600">{value(contact.email)} · {value(contact.mobile)}</p></li>)}</ul>{!profile.contacts?.length && <p className="mt-2 text-sm text-slate-500">No contacts provided.</p>}</div>
                <div><h3 className="text-sm font-medium text-slate-700">Bank accounts</h3><ul className="mt-2 space-y-2">{profile.banks?.map((bank, index) => <li key={index} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-medium">{value(bank.bankName)} · {value(bank.accountHolderName)}</p><p className="text-slate-600">Account ending {bank.accountNumber?.slice(-4) || '—'} · IFSC {value(bank.ifsc)}</p><p className="text-slate-500">{value(bank.branch)}</p></li>)}</ul>{!profile.banks?.length && <p className="mt-2 text-sm text-slate-500">No bank accounts provided.</p>}</div>
              </div>
            </section>
            <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
              <h2 className="font-semibold text-slate-900">Registration documents</h2>
              {profile.documents?.length ? <ul className="mt-3 divide-y">{profile.documents.map((document) => <li key={document._id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{document.originalName}</span><span className="text-slate-500">{(document.size / 1024).toFixed(0)} KB · {document.contentType}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No documents uploaded.</p>}
            </section>
          </div> : null}
    </SupplierPortalShell>
  );
}

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export default function SupplierRegistrationSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm">
        <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Registration submitted</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your supplier account is pending admin approval. The procurement team will review your details and share a password setup link when portal access is ready.
        </p>
        <Link href="/supplier/login" className="mt-6 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700">Go to supplier sign in</Link>
      </section>
    </main>
  );
}

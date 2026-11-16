'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LoaderCircle, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/lib/api/client';

type SettingField = { key: string; label: string; placeholder?: string; textarea?: boolean };

const SETTING_GROUPS: { label: string; keys: SettingField[] }[] = [
  {
    label: 'App Info',
    keys: [
      { key: 'app_name', label: 'App Name' },
      { key: 'footer_text', label: 'Footer Text' },
      { key: 'currency_symbol', label: 'Currency Symbol', placeholder: '₹' },
      { key: 'country_code', label: 'Country Code', placeholder: '+91' },
    ],
  },
  {
    label: 'Legal Pages',
    keys: [
      { key: 'terms_and_conditions', label: 'Terms & Conditions', textarea: true },
      { key: 'about_us', label: 'About Us', textarea: true },
      { key: 'privacy_policy', label: 'Privacy Policy', textarea: true },
      { key: 'refund_policy', label: 'Refund Policy', textarea: true },
      { key: 'shipping_policy', label: 'Shipping Policy', textarea: true },
      { key: 'cancellation_policy', label: 'Cancellation Policy', textarea: true },
    ],
  },
];

type Setting = { key: string; value: string };

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { isLoading, isError } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const { data } = await api.get('/admin/settings');
      const map: Record<string, string> = {};
      (data.data as Setting[]).forEach((s) => { map[s.key] = String(s.value ?? ''); });
      setValues(map);
      return map;
    },
  });

  const save = async () => {
    setSaving(true);
    try {
      const settings = Object.entries(values).map(([key, value]) => ({ key, value }));
      await api.post('/admin/settings/bulk', { settings });
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      toast.success('Settings saved successfully');
    } catch {
      toast.error('Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Link href="/admin/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#0b55ad]">
              <ArrowLeft size={15} /> Dashboard
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0b55ad]">Bring Basket · Admin</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0b2346]">Business Settings</h1>
            <p className="mt-1 text-sm text-gray-500">Configure app info, legal pages and other global settings.</p>
          </div>
          <Button onClick={() => void save()} disabled={saving || isLoading} className="h-11 rounded-xl bg-[#0b438d] px-5 text-white hover:bg-[#082f68]">
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
            Save all
          </Button>
        </div>

        {isLoading && <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin text-[#0b55ad]" /> Loading settings…</div>}
        {isError && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Could not load settings. Please refresh.</div>}

        {!isLoading && SETTING_GROUPS.map((group) => (
          <Card key={group.label} className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
            <CardContent className="p-6">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#0b2346]">{group.label}</h2>
              <div className="space-y-4">
                {group.keys.map(({ key, label, placeholder, textarea }) => (
                  <div key={key}>
                    <Label htmlFor={`setting-${key}`} className="text-sm font-medium text-gray-700">{label}</Label>
                    {textarea ? (
                      <textarea
                        id={`setting-${key}`}
                        value={values[key] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                        rows={4}
                        className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#0b55ad] focus:ring-4 focus:ring-[#0b55ad]/10"
                      />
                    ) : (
                      <Input
                        id={`setting-${key}`}
                        value={values[key] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="mt-1.5 h-11 rounded-xl border-gray-200 focus-visible:border-[#0b55ad] focus-visible:ring-[#0b55ad]/15"
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
}

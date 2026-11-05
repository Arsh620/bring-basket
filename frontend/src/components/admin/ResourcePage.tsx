'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  Scale,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminResources, type AdminField, type AdminResource } from '@/lib/admin-resources';
import api from '@/lib/api/client';

type DataRow = Record<string, unknown> & { _id: string };
type FormValue = string | boolean;

interface ListResult {
  rows: DataRow[];
  total: number;
}

function getErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    return error.response?.data?.message || error.message || 'The request could not be completed.';
  }
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

function fieldValue(row: DataRow | null, field: AdminField): FormValue {
  const value = row?.[field.key];
  if (field.type === 'boolean') return typeof value === 'boolean' ? value : true;
  if (field.type === 'json') return value == null ? '' : JSON.stringify(value, null, 2);
  if (field.type === 'date' && value) return new Date(String(value)).toISOString().slice(0, 10);
  if (value && typeof value === 'object' && '_id' in value) return String((value as { _id: string })._id);
  return value == null ? '' : String(value);
}

function displayValue(value: unknown, columnType?: string) {
  if (columnType === 'status') {
    if (value === true || value === 'active') return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Active</Badge>;
    if (value === false || value === 'inactive') return <Badge variant="secondary" className="bg-gray-100 text-gray-600">Inactive</Badge>;
  }
  if (value == null || value === '') return <span className="text-gray-400">—</span>;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.length ? `${value.length} entries` : '—';
    const record = value as Record<string, unknown>;
    return String(record.name ?? record.moduleName ?? record.unit ?? record.code ?? record._id ?? '—');
  }
  if (columnType === 'date') {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }
  if (columnType === 'number' && typeof value === 'number') return value.toLocaleString();
  return String(value);
}

function ResourceSelectOptions({ field }: { field: AdminField }) {
  const query = useQuery({
    queryKey: ['admin-options', field.optionsPath],
    queryFn: async () => {
      const response = await api.get(field.optionsPath!);
      return (response.data.data ?? []) as DataRow[];
    },
    enabled: Boolean(field.optionsPath),
  });

  if (query.isError) {
    return <option value="">Options unavailable — reload to retry</option>;
  }

  return (
    <>
      <option value="">{query.isLoading ? 'Loading options…' : 'Select an option'}</option>
      {(query.data ?? []).map((option) => (
        <option key={option._id} value={String(option[field.optionValue ?? '_id'] ?? option._id)}>
          {String(option[field.optionLabel ?? 'name'] ?? option.name ?? option._id)}
        </option>
      ))}
    </>
  );
}

function EditorField({
  field,
  value,
  onChange,
}: {
  field: AdminField;
  value: FormValue;
  onChange: (value: FormValue) => void;
}) {
  const commonClass = 'mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition focus:border-[#0b55ad] focus:ring-4 focus:ring-[#0b55ad]/10';

  return (
    <div className={field.type === 'textarea' || field.type === 'json' ? 'sm:col-span-2' : ''}>
      <Label htmlFor={`field-${field.key}`} className="text-sm font-medium text-gray-700">
        {field.label}{field.required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {field.type === 'boolean' ? (
        <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3">
          <input
            id={`field-${field.key}`}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 accent-[#0b55ad]"
          />
          <span className="text-sm text-gray-700">{field.label}</span>
        </label>
      ) : field.type === 'select' ? (
        <select
          id={`field-${field.key}`}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          className={commonClass}
        >
          {field.options ? (
            <>
              {field.nullable && <option value="">None</option>}
              {!field.nullable && <option value="">Select an option</option>}
              {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </>
          ) : (
            <>
              {field.nullable && <option value="">None</option>}
              <ResourceSelectOptions field={field} />
            </>
          )}
        </select>
      ) : field.type === 'textarea' || field.type === 'json' ? (
        <textarea
          id={`field-${field.key}`}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          placeholder={field.placeholder}
          rows={field.type === 'json' ? 5 : 3}
          className={`${commonClass} resize-y font-mono`}
        />
      ) : (
        <Input
          id={`field-${field.key}`}
          type={field.type ?? 'text'}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          placeholder={field.placeholder}
          min={field.type === 'number' ? 0 : undefined}
          step={field.type === 'number' ? 'any' : undefined}
          className="mt-1.5 h-11 rounded-xl border-gray-200 bg-white shadow-sm focus-visible:border-[#0b55ad] focus-visible:ring-[#0b55ad]/15"
        />
      )}
      {field.help && <p className="mt-1 text-xs leading-5 text-gray-500">{field.help}</p>}
    </div>
  );
}

function ResourceEditor({
  resource,
  row,
  onClose,
}: {
  resource: AdminResource;
  row: DataRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, FormValue>>(() => {
    const initial: Record<string, FormValue> = {};
    for (const field of resource.fields) initial[field.key] = fieldValue(row, field);
    return initial;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const editing = row !== null;
  const fields = resource.fields.filter((field) => editing ? !field.createOnly : !field.editOnly);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    const payload: Record<string, unknown> = {};
    try {
      for (const field of fields) {
        const value = values[field.key];
        if (value === '' && field.nullable) {
          payload[field.key] = null;
          continue;
        }
        if (value === '' && !field.required) continue;
        if (field.type === 'number') payload[field.key] = Number(value);
        else if (field.type === 'json') payload[field.key] = JSON.parse(String(value));
        else payload[field.key] = value;
      }

      setIsSaving(true);
      if (editing) {
        const endpoint = (resource.updateEndpoint ?? `${resource.endpoint}/:id`).replace(':id', row._id);
        await api.put(endpoint, payload);
      } else {
        await api.post(resource.createEndpoint ?? resource.endpoint, payload);
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-resource', resource.key] });
      toast.success(`${resource.singular} ${editing ? 'updated' : 'created'} successfully`);
      onClose();
    } catch (error) {
      const message = getErrorMessage(error);
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSaving) onClose();
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby="resource-editor-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-100 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0b55ad]">{editing ? 'Update record' : 'New record'}</p>
            <h3 id="resource-editor-title" className="mt-1 text-xl font-bold text-[#0b2346]">
              {editing ? `Edit ${resource.singular}` : `Add ${resource.singular}`}
            </h3>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close form" disabled={isSaving} onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <form onSubmit={submit} className="space-y-5 px-6 py-5">
          {formError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <EditorField
                key={field.key}
                field={field}
                value={values[field.key] ?? ''}
                onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
              />
            ))}
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" disabled={isSaving} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSaving} className="bg-[#0b438d] text-white hover:bg-[#082f68]">
              {isSaving && <LoaderCircle size={16} className="animate-spin" />}
              {editing ? 'Save changes' : 'Create record'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
type StoreDay = { day: number; openingTime: string; closingTime: string };

function StoreScheduleForm({
  store,
  initialSchedule,
  onClose,
}: {
  store: DataRow;
  initialSchedule: StoreDay[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<StoreDay[]>(() => weekDays.map((_, day) => {
    const saved = initialSchedule.find((entry) => entry.day === day);
    return { day, openingTime: saved?.openingTime ?? '', closingTime: saved?.closingTime ?? '' };
  }));
  const [saving, setSaving] = useState(false);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.put(`/admin/stores/${store._id}/schedule`, { schedule });
      await queryClient.invalidateQueries({ queryKey: ['store-schedule', store._id] });
      toast.success('Store schedule saved');
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4 px-6 py-5">
      {schedule.map((entry) => <div key={entry.day} className="grid grid-cols-[minmax(90px,1fr)_1fr_1fr] items-center gap-3"><span className="text-sm font-medium text-gray-700">{weekDays[entry.day]}</span><Input type="time" aria-label={`${weekDays[entry.day]} opening time`} value={entry.openingTime} onChange={(event) => setSchedule((current) => current.map((day) => day.day === entry.day ? { ...day, openingTime: event.target.value } : day))} className="h-10 rounded-lg" /><Input type="time" aria-label={`${weekDays[entry.day]} closing time`} value={entry.closingTime} onChange={(event) => setSchedule((current) => current.map((day) => day.day === entry.day ? { ...day, closingTime: event.target.value } : day))} className="h-10 rounded-lg" /></div>)}
      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#0b438d] text-white hover:bg-[#082f68]">{saving && <LoaderCircle size={16} className="animate-spin" />} Save schedule</Button></div>
    </form>
  );
}

function StoreScheduleDialog({ store, onClose }: { store: DataRow; onClose: () => void }) {
  const scheduleQuery = useQuery({
    queryKey: ['store-schedule', store._id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/stores/${store._id}/schedule`);
      return (data.data ?? []) as StoreDay[];
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="schedule-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0b55ad]">Store operations</p><h2 id="schedule-title" className="mt-1 text-xl font-bold text-[#0b2346]">Opening hours</h2><p className="mt-1 text-sm text-gray-500">{String(store.name ?? 'Store')} · Leave both times blank for a closed day.</p></div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close schedule" onClick={onClose}><X size={18} /></Button>
        </div>
        {scheduleQuery.isLoading ? <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin text-[#0b55ad]" /> Loading schedule…</div>
          : scheduleQuery.isError ? <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{getErrorMessage(scheduleQuery.error)}</div>
            : <StoreScheduleForm key={store._id} store={store} initialSchedule={scheduleQuery.data ?? []} onClose={onClose} />}
      </div>
    </div>
  );
}

interface UnitConversion {
  _id: string;
  unit: string;
  factor: number;
}

function UnitConversionsDialog({ group, onClose }: { group: DataRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<UnitConversion | null>(null);
  const [unit, setUnit] = useState('');
  const [factor, setFactor] = useState('1');
  const [saving, setSaving] = useState(false);
  const conversionQuery = useQuery({
    queryKey: ['unit-conversions', group._id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/unit-groups/${group._id}/conversions`);
      return (data.data ?? []) as UnitConversion[];
    },
  });

  const reset = () => { setEditing(null); setUnit(''); setFactor('1'); };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.put(`/admin/unit-groups/${group._id}/conversions/${editing._id}`, { unit, factor: Number(factor) });
      else await api.post(`/admin/unit-groups/${group._id}/conversions`, { unit, factor: Number(factor) });
      await queryClient.invalidateQueries({ queryKey: ['unit-conversions', group._id] });
      toast.success(`Conversion ${editing ? 'updated' : 'added'}`);
      reset();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (conversion: UnitConversion) => {
    if (!window.confirm(`Delete the ${conversion.unit} conversion?`)) return;
    try {
      await api.delete(`/admin/unit-groups/${group._id}/conversions/${conversion._id}`);
      await queryClient.invalidateQueries({ queryKey: ['unit-conversions', group._id] });
      toast.success('Conversion deleted');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="conversions-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0b55ad]">Unit group</p><h2 id="conversions-title" className="mt-1 text-xl font-bold text-[#0b2346]">{String(group.name ?? 'Conversions')}</h2><p className="mt-1 text-sm text-gray-500">Base unit: {String(group.baseUnit ?? '—')} · Define how each unit converts to the base quantity.</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close conversions" onClick={onClose}><X size={18} /></Button></div>
        <div className="space-y-5 p-6">
          {conversionQuery.isLoading ? <p className="text-sm text-gray-500">Loading conversions…</p>
            : conversionQuery.isError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{getErrorMessage(conversionQuery.error)}</p>
              : (conversionQuery.data ?? []).length === 0 ? <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">No conversion units added yet.</p>
                : <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">{conversionQuery.data!.map((conversion) => <div key={conversion._id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="flex items-center gap-3"><span className="rounded-lg bg-[#fff7b2] p-2 text-[#0b55ad]"><Scale size={16} /></span><div><p className="text-sm font-semibold text-gray-800">{conversion.unit}</p><p className="text-xs text-gray-500">{conversion.factor} {String(group.baseUnit ?? '')}</p></div></div><div className="flex gap-1"><Button type="button" size="icon-sm" variant="ghost" aria-label={`Edit ${conversion.unit}`} onClick={() => { setEditing(conversion); setUnit(conversion.unit); setFactor(String(conversion.factor)); }}><Pencil size={14} /></Button><Button type="button" size="icon-sm" variant="ghost" aria-label={`Delete ${conversion.unit}`} onClick={() => void remove(conversion)} className="text-red-600"><Trash2 size={14} /></Button></div></div>)}</div>}
          <form onSubmit={save} className="grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-[1fr_120px_auto] sm:items-end">
            <div><Label htmlFor="conversion-unit">Unit</Label><Input id="conversion-unit" required value={unit} onChange={(event) => setUnit(event.target.value)} className="mt-1.5 h-10 rounded-lg bg-white" placeholder="e.g. kilogram" /></div>
            <div><Label htmlFor="conversion-factor">Factor</Label><Input id="conversion-factor" type="number" step="any" min="0.000001" required value={factor} onChange={(event) => setFactor(event.target.value)} className="mt-1.5 h-10 rounded-lg bg-white" /></div>
            <Button type="submit" disabled={saving} className="bg-[#0b438d] text-white hover:bg-[#082f68]">{saving && <LoaderCircle size={14} className="animate-spin" />}{editing ? 'Update' : 'Add unit'}</Button>
            {editing && <Button type="button" variant="ghost" onClick={reset} className="sm:col-span-3">Cancel edit</Button>}
          </form>
        </div>
      </div>
    </div>
  );
}

export function ResourcePage({ resourceKey }: { resourceKey: string }) {
  const resource = adminResources[resourceKey];
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editorRow, setEditorRow] = useState<DataRow | null | undefined>(undefined);
  const [extraRow, setExtraRow] = useState<DataRow | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin-resource', resourceKey, page, resource?.searchable ? search : ''],
    enabled: Boolean(resource),
    queryFn: async (): Promise<ListResult> => {
      const params: Record<string, string | number> = {};
      if (resource.paginated) {
        params.page = page;
        params.limit = 20;
      }
      if (resource.searchable && search.trim()) params.search = search.trim();
      const response = await api.get(resource.endpoint, { params });
      const rows = (response.data.data ?? []) as DataRow[];
      return { rows, total: response.data.pagination?.total ?? rows.length };
    },
  });

  const rows = useMemo(() => {
    if (resource.searchable) return listQuery.data?.rows ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return listQuery.data?.rows ?? [];
    return (listQuery.data?.rows ?? []).filter((row) =>
      resource.columns.some((column) => displayValue(row[column.key]).toString().toLowerCase().includes(term)),
    );
  }, [listQuery.data?.rows, resource, search]);

  if (!resource) {
    return <AdminLayout><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">This admin section is not configured.</div></AdminLayout>;
  }

  const totalPages = resource.paginated ? Math.max(1, Math.ceil((listQuery.data?.total ?? 0) / 20)) : 1;

  const toggleStatus = async (row: DataRow) => {
    if (!resource.statusEndpoint || !resource.statusValues) return;
    const current = row.status;
    const next = current === resource.statusValues.active ? resource.statusValues.inactive : resource.statusValues.active;
    setBusyRow(row._id);
    try {
      await api.patch(resource.statusEndpoint.replace(':id', row._id), { status: next });
      await queryClient.invalidateQueries({ queryKey: ['admin-resource', resource.key] });
      toast.success(`${resource.singular} status updated`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyRow(null);
    }
  };

  const removeRow = async (row: DataRow) => {
    const label = String(row.name ?? row.moduleName ?? row.unit ?? row.fName ?? resource.singular);
    if (!window.confirm(`Delete "${label}"? This action cannot be undone.`)) return;
    setBusyRow(row._id);
    try {
      await api.delete((resource.deleteEndpoint ?? `${resource.endpoint}/:id`).replace(':id', row._id));
      await queryClient.invalidateQueries({ queryKey: ['admin-resource', resource.key] });
      toast.success(`${resource.singular} deleted`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyRow(null);
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-[#0b55ad]">
              <ArrowLeft size={15} /> Dashboard
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0b55ad]">Bring Basket · Admin</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0b2346]">{resource.title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">{resource.description}</p>
          </div>
          {!resource.readOnly && (
            <Button
              type="button"
              onClick={() => setEditorRow(null)}
              className="h-11 rounded-xl bg-[#0b438d] px-5 text-white shadow-sm hover:bg-[#082f68]"
            >
              <Plus size={17} /> Add {resource.singular}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Card className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total records</p>
              <p className="mt-1 text-2xl font-bold text-[#0b2346]">{listQuery.isLoading ? '—' : (listQuery.data?.total ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm ring-1 ring-[#dce4ef]">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Showing</p>
              <p className="mt-1 text-2xl font-bold text-[#0b2346]">{listQuery.isLoading ? '—' : rows.length.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 border-0 shadow-sm ring-1 ring-[#dce4ef] lg:col-span-1">
            <CardContent className="flex h-full items-center gap-3 p-4">
              <span className="rounded-xl bg-[#fff7b2] p-2.5 text-[#0b55ad]"><Search size={18} /></span>
              <div><p className="text-xs font-medium uppercase tracking-wide text-gray-500">Quick search</p><p className="mt-1 text-sm font-semibold text-gray-800">Find records by name or details</p></div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf5] bg-white px-5 py-4">
            <div>
              <h2 className="font-semibold text-[#0b2346]">All {resource.title.toLowerCase()}</h2>
              <p className="mt-0.5 text-xs text-gray-500">Search, update or manage records in your workspace.</p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder={`Search ${resource.title.toLowerCase()}…`}
                aria-label={`Search ${resource.title}`}
                className="h-10 rounded-xl border-gray-200 bg-[#f7f9fc] pl-9 focus-visible:border-[#0b55ad] focus-visible:ring-[#0b55ad]/15"
              />
            </div>
          </div>

          {listQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-500">
              <LoaderCircle size={19} className="animate-spin text-[#0b55ad]" /> Loading {resource.title.toLowerCase()}…
            </div>
          ) : listQuery.isError ? (
            <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="font-semibold text-red-800">Could not load {resource.title.toLowerCase()}.</p>
              <p className="mt-1 text-sm text-red-700">{getErrorMessage(listQuery.error)}</p>
              <Button className="mt-4" variant="outline" onClick={() => void listQuery.refetch()}>Try again</Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff7b2] text-[#0b55ad]"><Search size={20} /></div>
              <p className="font-semibold text-gray-800">{search ? 'No matching records' : `No ${resource.title.toLowerCase()} yet`}</p>
              <p className="mt-1 text-sm text-gray-500">{search ? 'Try another search term.' : `Add your first ${resource.singular} to get started.`}</p>
              {!search && !resource.readOnly && <Button className="mt-4 bg-[#0b438d] text-white hover:bg-[#082f68]" onClick={() => setEditorRow(null)}><Plus size={16} /> Add {resource.singular}</Button>}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f5f8fc] hover:bg-[#f5f8fc]">
                    {resource.columns.map((column) => <TableHead key={column.key} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#526783]">{column.label}</TableHead>)}
                    {!resource.readOnly && <TableHead className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#526783]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row._id} className="group transition-colors hover:bg-[#f8faff]">
                      {resource.columns.map((column, index) => (
                        <TableCell key={column.key} className={`px-5 py-3.5 text-sm ${index === 0 ? 'font-semibold text-[#0b2346]' : 'text-gray-600'}`}>
                          {displayValue(row[column.key], column.type)}
                        </TableCell>
                      ))}
                      {!resource.readOnly && (
                        <TableCell className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {resource.statusEndpoint && resource.statusValues && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busyRow === row._id}
                                onClick={() => void toggleStatus(row)}
                                className="rounded-lg"
                              >
                                {busyRow === row._id ? <LoaderCircle size={14} className="animate-spin" /> : row.status === resource.statusValues.active ? 'Disable' : 'Enable'}
                              </Button>
                            )}
                            {resource.extraAction && (
                              <Button type="button" size="sm" variant="outline" disabled={busyRow === row._id} onClick={() => setExtraRow(row)} className="rounded-lg">
                                {resource.extraAction === 'schedule' ? <CalendarDays size={14} /> : <Scale size={14} />}
                                {resource.extraAction === 'schedule' ? 'Hours' : 'Conversions'}
                              </Button>
                            )}
                            {!resource.createOnly && (
                              <>
                                <Button type="button" size="sm" variant="outline" disabled={busyRow === row._id} onClick={() => setEditorRow(row)} className="rounded-lg">Edit</Button>
                                <Button type="button" size="sm" variant="ghost" disabled={busyRow === row._id} onClick={() => void removeRow(row)} className="rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700">Delete</Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {resource.paginated && (
                <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                  <p className="text-xs text-gray-500">Page {page} of {totalPages} · {listQuery.data?.total ?? 0} records</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={15} /> Previous</Button>
                    <Button type="button" size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next <ChevronRight size={15} /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
      {editorRow !== undefined && <ResourceEditor resource={resource} row={editorRow} onClose={() => setEditorRow(undefined)} />}
      {extraRow && resource.extraAction === 'schedule' && <StoreScheduleDialog store={extraRow} onClose={() => setExtraRow(null)} />}
      {extraRow && resource.extraAction === 'conversions' && <UnitConversionsDialog group={extraRow} onClose={() => setExtraRow(null)} />}
    </AdminLayout>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { ArrowDownToLine, ArrowLeft, ArrowRightLeft, Check, LoaderCircle, Plus, Send, X } from 'lucide-react';
import Link from 'next/link';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api/client';

type WorkflowType = 'stock-transfers' | 'store-stock-requests';
type InventoryRow = Record<string, unknown> & { _id: string; status: string };
type Choice = { _id: string; name?: string; code?: string; type?: string };
type LineItem = { itemId: string; qtyRequested: string };

function messageFrom(error: unknown) {
  if (error instanceof AxiosError) return error.response?.data?.message || error.message;
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

function relationshipName(value: unknown) {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return String(record.name ?? record.code ?? record._id ?? '—');
  }
  return String(value);
}

function statusStyle(status: string) {
  if (['received', 'approved', 'completed'].includes(status)) return 'bg-emerald-50 text-emerald-700';
  if (['rejected', 'cancelled'].includes(status)) return 'bg-red-50 text-red-700';
  if (['dispatched'].includes(status)) return 'bg-blue-50 text-blue-700';
  return 'bg-amber-50 text-amber-700';
}

function useInventoryChoices(endpoint: string) {
  return useQuery({
    queryKey: ['inventory-choices', endpoint],
    queryFn: async () => {
      const { data } = await api.get(endpoint, { params: endpoint.endsWith('/items') ? { limit: 100 } : undefined });
      return (data.data ?? []) as Choice[];
    },
  });
}

function WorkflowCreateDialog({ type, onClose }: { type: WorkflowType; onClose: () => void }) {
  const queryClient = useQueryClient();
  const request = type === 'store-stock-requests';
  const stores = useInventoryChoices('/admin/stores');
  const warehouses = useInventoryChoices('/admin/warehouses');
  const items = useInventoryChoices('/admin/items');
  const [storeId, setStoreId] = useState('');
  const [motherWarehouseId, setMotherWarehouseId] = useState('');
  const [subWarehouseId, setSubWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([{ itemId: '', qtyRequested: '1' }]);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const choicesLoading = stores.isLoading || warehouses.isLoading || items.isLoading;
  const choicesError = stores.error ?? warehouses.error ?? items.error;

  const addLine = () => setLines((current) => [...current, { itemId: '', qtyRequested: '1' }]);
  const updateLine = (index: number, patch: Partial<LineItem>) => setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorText('');
    if (lines.some((line) => !line.itemId || Number(line.qtyRequested) <= 0)) {
      setErrorText('Select a product and enter a quantity greater than zero for every line.');
      return;
    }
    if (new Set(lines.map((line) => line.itemId)).size !== lines.length) {
      setErrorText('A product can only be added once per request.');
      return;
    }
    const payload = {
      ...(request ? { storeId } : {}),
      motherWarehouseId,
      ...(!request ? { subWarehouseId: subWarehouseId || null } : {}),
      notes,
      items: lines.map((line) => ({ itemId: line.itemId, qtyRequested: Number(line.qtyRequested) })),
    };
    setSaving(true);
    try {
      await api.post(`/admin/${type}`, payload);
      await queryClient.invalidateQueries({ queryKey: ['inventory-workflow', type] });
      toast.success(request ? 'Store stock request created' : 'Warehouse transfer created');
      onClose();
    } catch (error) {
      setErrorText(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  const selectClass = 'mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#0b55ad] focus:ring-4 focus:ring-[#0b55ad]/10';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="create-workflow-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0b55ad]">Inventory workflow</p>
            <h2 id="create-workflow-title" className="mt-1 text-xl font-bold text-[#0b2346]">{request ? 'Create store stock request' : 'Create warehouse transfer'}</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close dialog" disabled={saving} onClick={onClose}><X size={18} /></Button>
        </div>
        <form onSubmit={submit} className="space-y-5 px-6 py-5">
          {errorText && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorText}</p>}
          {choicesLoading && <p className="text-sm text-gray-500">Loading stores, warehouses and products…</p>}
          {choicesError && <p role="alert" className="text-sm text-red-700">Could not load form options: {messageFrom(choicesError)}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {request && (
              <div>
                <Label htmlFor="request-store">Store <span className="text-red-500">*</span></Label>
                <select id="request-store" required value={storeId} onChange={(event) => setStoreId(event.target.value)} className={selectClass}>
                  <option value="">Select a store</option>
                  {(stores.data ?? []).map((store) => <option key={store._id} value={store._id}>{store.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <Label htmlFor="mother-warehouse">Mother warehouse <span className="text-red-500">*</span></Label>
              <select id="mother-warehouse" required value={motherWarehouseId} onChange={(event) => setMotherWarehouseId(event.target.value)} className={selectClass}>
                <option value="">Select a warehouse</option>
                {(warehouses.data ?? []).filter((warehouse) => !warehouse.type || warehouse.type === 'mother').map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name} {warehouse.code ? `· ${warehouse.code}` : ''}</option>)}
              </select>
            </div>
            {!request && (
              <div>
                <Label htmlFor="sub-warehouse">Destination sub-warehouse</Label>
                <select id="sub-warehouse" value={subWarehouseId} onChange={(event) => setSubWarehouseId(event.target.value)} className={selectClass}>
                  <option value="">No destination selected</option>
                  {(warehouses.data ?? []).filter((warehouse) => warehouse.type === 'sub').map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name} {warehouse.code ? `· ${warehouse.code}` : ''}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div><Label>Products and quantities <span className="text-red-500">*</span></Label><p className="mt-1 text-xs text-gray-500">Each product can only appear once.</p></div>
              <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus size={14} /> Add product</Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_112px_36px] gap-2">
                  <select aria-label={`Product ${index + 1}`} required value={line.itemId} onChange={(event) => updateLine(index, { itemId: event.target.value })} className={selectClass}>
                    <option value="">Select a product</option>
                    {(items.data ?? []).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
                  </select>
                  <Input aria-label={`Quantity ${index + 1}`} type="number" min="1" required value={line.qtyRequested} onChange={(event) => updateLine(index, { qtyRequested: event.target.value })} className="mt-1.5 h-11 rounded-xl" />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove product ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="mt-1.5 text-gray-400 hover:text-red-600"><X size={16} /></Button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="workflow-notes">Notes</Label>
            <textarea id="workflow-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#0b55ad] focus:ring-4 focus:ring-[#0b55ad]/10" placeholder="Add optional notes for the warehouse team" />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || choicesLoading || Boolean(choicesError)} className="bg-[#0b438d] text-white hover:bg-[#082f68]">
              {saving && <LoaderCircle size={16} className="animate-spin" />} Create {request ? 'request' : 'transfer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WorkflowActionDialog({
  type,
  row,
  action,
  onClose,
}: {
  type: WorkflowType;
  row: InventoryRow;
  action: 'dispatch' | 'receive' | 'reject';
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const request = type === 'store-stock-requests';
  const items = Array.isArray(row.items) ? row.items as Record<string, unknown>[] : [];
  const [quantities, setQuantities] = useState(() => items.map((item) =>
    Number(action === 'receive' ? item.qtySent ?? 0 : item.qtyRequested ?? 0),
  ));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorText('');
    if (action === 'reject' && !reason.trim()) {
      setErrorText('A reason is required before rejecting this record.');
      return;
    }
    if (action === 'dispatch' && quantities.some((quantity) => !Number.isFinite(quantity) || quantity <= 0)) {
      setErrorText('Every dispatched quantity must be greater than zero.');
      return;
    }
    if (action === 'dispatch' && quantities.some((quantity, index) => quantity > Number(items[index]?.qtyRequested ?? 0))) {
      setErrorText('A dispatched quantity cannot exceed the amount requested.');
      return;
    }
    if (action === 'receive' && request && quantities.some((quantity, index) =>
      !Number.isFinite(quantity) || quantity < 0 || quantity > Number(items[index]?.qtySent ?? 0),
    )) {
      setErrorText('Received quantities must be between zero and the amount dispatched.');
      return;
    }
    const actionPath = action === 'dispatch' ? 'dispatch' : action === 'receive' ? 'receive' : 'reject';
    const itemPayload = items.map((item, index) => {
      const itemId = item.itemId && typeof item.itemId === 'object'
        ? String((item.itemId as Record<string, unknown>)._id)
        : String(item.itemId);
      return action === 'receive'
        ? { itemId, qtyReceived: quantities[index] }
        : { itemId, qtySent: quantities[index] };
    });
    const payload = action === 'reject'
      ? { rejectReason: reason.trim() }
      : action === 'dispatch'
        ? { items: itemPayload, ...(request ? {} : { challanNumber: reference || undefined }) }
        : { ...(request ? { items: itemPayload, grnNumber: reference || undefined } : {}) };

    setSaving(true);
    try {
      await api.patch(`/admin/${type}/${row._id}/${actionPath}`, payload);
      await queryClient.invalidateQueries({ queryKey: ['inventory-workflow', type] });
      const completedAction = action === 'receive' ? 'received' : action === 'dispatch' ? 'dispatched' : 'rejected';
      toast.success(`${request ? 'Stock request' : 'Transfer'} ${completedAction}`);
      onClose();
    } catch (error) {
      setErrorText(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  const title = action === 'reject' ? 'Reject request' : action === 'dispatch' ? 'Dispatch inventory' : 'Receive inventory';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="workflow-action-title" className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0b55ad]">{request ? 'Store stock request' : 'Warehouse transfer'}</p>
          <h2 id="workflow-action-title" className="mt-1 text-xl font-bold text-[#0b2346]">{title}</h2>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          {errorText && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorText}</p>}
          {action === 'reject' ? (
            <div><Label htmlFor="reject-reason">Reason <span className="text-red-500">*</span></Label><textarea id="reject-reason" required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#0b55ad] focus:ring-4 focus:ring-[#0b55ad]/10" placeholder="Explain why this request is being rejected" /></div>
          ) : (
            <>
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                {action === 'dispatch'
                  ? `This will dispatch the requested quantities for ${items.length} product line(s) and reduce mother-warehouse stock.`
                  : `This will receive the dispatched quantities for ${items.length} product line(s) and update store stock.`}
              </div>
              {(action === 'dispatch' || action === 'receive' && request) && (
                <div className="space-y-2">
                  {items.map((item, index) => {
                    const itemName = item.itemId && typeof item.itemId === 'object'
                      ? String((item.itemId as Record<string, unknown>).name ?? (item.itemId as Record<string, unknown>)._id)
                      : String(item.itemId ?? 'Product');
                    const maximum = Number(action === 'receive' ? item.qtySent ?? 0 : item.qtyRequested ?? 0);
                    return (
                      <div key={String(item._id ?? index)} className="grid grid-cols-[minmax(0,1fr)_112px] items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
                        <div className="min-w-0"><p className="truncate text-sm font-medium text-gray-800">{itemName}</p><p className="text-xs text-gray-500">Maximum {maximum}</p></div>
                        <Input
                          aria-label={`${action === 'receive' ? 'Received' : 'Dispatch'} quantity for ${itemName}`}
                          type="number"
                          min={action === 'receive' ? 0 : 0.01}
                          max={maximum}
                          step="any"
                          required
                          value={quantities[index] ?? 0}
                          onChange={(event) => setQuantities((current) => current.map((quantity, quantityIndex) =>
                            quantityIndex === index ? Number(event.target.value) : quantity,
                          ))}
                          className="h-10 rounded-lg"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {(action === 'dispatch' && !request || action === 'receive' && request) && (
                <div><Label htmlFor="workflow-reference">{request ? 'GRN number' : 'Challan number'}</Label><Input id="workflow-reference" value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1.5 h-11 rounded-xl" placeholder="Optional reference number" /></div>
              )}
            </>
          )}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className={action === 'reject' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#0b438d] text-white hover:bg-[#082f68]'}>
              {saving && <LoaderCircle size={16} className="animate-spin" />}
              {action === 'dispatch' ? 'Confirm dispatch' : action === 'receive' ? 'Confirm receipt' : 'Reject'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function InventoryWorkflowPage({ type }: { type: WorkflowType }) {
  const queryClient = useQueryClient();
  const request = type === 'store-stock-requests';
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [action, setAction] = useState<{ row: InventoryRow; action: 'dispatch' | 'receive' | 'reject' } | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['inventory-workflow', type, page],
    queryFn: async () => {
      const { data } = await api.get(`/admin/${type}`, { params: { page, limit: 20 } });
      return { rows: (data.data ?? []) as InventoryRow[], total: Number(data.pagination?.total ?? 0) };
    },
  });
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const title = request ? 'Store stock requests' : 'Stock transfers';
  const endpointAction = async (row: InventoryRow, actionName: string) => {
    setBusyRow(row._id);
    try {
      await api.patch(`/admin/${type}/${row._id}/${actionName}`);
      await queryClient.invalidateQueries({ queryKey: ['inventory-workflow', type] });
      toast.success(`Request ${actionName === 'approve' ? 'approved' : 'updated'}`);
    } catch (error) {
      toast.error(messageFrom(error));
    } finally {
      setBusyRow(null);
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-[#0b55ad]"><ArrowLeft size={15} /> Dashboard</Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0b55ad]">Inventory operations</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0b2346]">{title}</h1>
            <p className="mt-1 text-sm text-gray-500">{request ? 'Review store purchase requests and process picking, dispatch and goods receipt.' : 'Move stock between mother and sub-warehouses with a clear dispatch and receipt trail.'}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="h-11 rounded-xl bg-[#0b438d] px-5 text-white hover:bg-[#082f68]"><Plus size={17} /> New {request ? 'request' : 'transfer'}</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[{ label: 'All records', value: total, tone: 'bg-[#fff7b2] text-[#0b55ad]', icon: ArrowRightLeft }, { label: 'Awaiting action', value: rows.filter((row) => ['requested', 'approved', 'dispatched'].includes(row.status)).length, tone: 'bg-amber-50 text-amber-800', icon: Send }, { label: 'On this page', value: rows.length, tone: 'bg-[#eef4fc] text-[#0b55ad]', icon: ArrowDownToLine }].map((stat) => (
            <Card key={stat.label} className="border-0 shadow-sm ring-1 ring-[#dce4ef]"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stat.label}</p><p className="mt-1 text-2xl font-bold text-[#0b2346]">{query.isLoading ? '—' : stat.value}</p></div><span className={`rounded-xl p-2.5 ${stat.tone}`}><stat.icon size={19} /></span></CardContent></Card>
          ))}
        </div>

        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-[#dce4ef]">
          <div className="border-b border-[#e7edf5] bg-white px-5 py-4"><h2 className="font-semibold text-[#0b2346]">Workflow queue</h2><p className="mt-0.5 text-xs text-gray-500">Status changes update inventory through the backend workflow.</p></div>
          {query.isLoading ? <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin text-[#0b55ad]" /> Loading workflow…</div>
            : query.isError ? <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-5"><p className="font-semibold text-red-800">Could not load {title.toLowerCase()}.</p><p className="mt-1 text-sm text-red-700">{messageFrom(query.error)}</p><Button variant="outline" className="mt-3" onClick={() => void query.refetch()}>Try again</Button></div>
              : rows.length === 0 ? <div className="px-6 py-16 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff7b2] text-[#0b55ad]"><ArrowRightLeft size={20} /></div><p className="font-semibold text-gray-800">Nothing in the queue</p><p className="mt-1 text-sm text-gray-500">Create a request to start an inventory workflow.</p></div>
                : <Table><TableHeader><TableRow className="bg-[#f5f8fc]"><TableHead className="px-5 text-[#526783]">Reference</TableHead><TableHead className="text-[#526783]">{request ? 'Store' : 'From'}</TableHead><TableHead className="text-[#526783]">{request ? 'Mother warehouse' : 'Destination'}</TableHead><TableHead className="text-[#526783]">Products</TableHead><TableHead className="text-[#526783]">Status</TableHead><TableHead className="text-[#526783]">Created</TableHead><TableHead className="pr-5 text-right text-[#526783]">Next step</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => {
                  const dateValue = row.createdAt ? new Date(String(row.createdAt)).toLocaleDateString() : '—';
                  const reference = String(row.poNumber ?? row.challanNumber ?? `#${row._id.slice(-6).toUpperCase()}`);
                  const itemCount = Array.isArray(row.items) ? row.items.length : 0;
                  return <TableRow key={row._id} className="transition-colors hover:bg-[#f8faff]">
                    <TableCell className="px-5 font-semibold text-[#0b2346]">{reference}</TableCell>
                    <TableCell>{relationshipName(request ? row.storeId : row.motherWarehouseId)}</TableCell>
                    <TableCell>{relationshipName(request ? row.motherWarehouseId : row.subWarehouseId)}</TableCell>
                    <TableCell><Badge variant="secondary" className="bg-gray-100 text-gray-700">{itemCount} {itemCount === 1 ? 'line' : 'lines'}</Badge></TableCell>
                    <TableCell><Badge className={`capitalize hover:bg-inherit ${statusStyle(row.status)}`}>{row.status}</Badge></TableCell>
                    <TableCell className="text-gray-500">{dateValue}</TableCell>
                    <TableCell className="pr-5"><div className="flex justify-end gap-1.5">
                      {request && row.status === 'requested' && <Button size="sm" variant="outline" disabled={busyRow === row._id} onClick={() => void endpointAction(row, 'approve')}><Check size={14} /> Approve</Button>}
                      {(request ? ['requested', 'approved'].includes(row.status) : row.status === 'requested') && <Button size="sm" className="bg-[#0b438d] text-white hover:bg-[#082f68]" disabled={busyRow === row._id} onClick={() => setAction({ row, action: 'dispatch' })}><Send size={14} /> Dispatch</Button>}
                      {row.status === 'dispatched' && <Button size="sm" className="bg-blue-700 text-white hover:bg-blue-800" onClick={() => setAction({ row, action: 'receive' })}><ArrowDownToLine size={14} /> Receive</Button>}
                      {(request ? ['requested', 'approved'].includes(row.status) : ['requested', 'dispatched'].includes(row.status)) && <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setAction({ row, action: 'reject' })}>Reject</Button>}
                      {!['requested', 'approved', 'dispatched'].includes(row.status) && <span className="pr-2 text-xs text-gray-400">Complete</span>}
                    </div></TableCell>
                  </TableRow>;
                })}</TableBody></Table>}
          {!query.isError && total > 0 && <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3"><p className="text-xs text-gray-500">Page {page} of {totalPages} · {total} records</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
        </Card>
      </div>
      {createOpen && <WorkflowCreateDialog type={type} onClose={() => setCreateOpen(false)} />}
      {action && <WorkflowActionDialog type={type} row={action.row} action={action.action} onClose={() => setAction(null)} />}
    </AdminLayout>
  );
}

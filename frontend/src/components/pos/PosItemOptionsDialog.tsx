'use client';

import { useMemo, useState } from 'react';

type Option = { label: string; optionPrice?: number };
type Group = { name: string; title?: string; required?: boolean | string; min?: number; max?: number; options?: string[]; values?: Option[] };
type AddOn = { _id: string; name: string; price: number; status?: boolean; storeId?: string };
export type PosOptionItem = {
  _id: string; name: string; price: number;
  foodVariations?: Group[] | string | null;
  choiceOptions?: Group[] | string | null;
  variations?: { type: string; price: number; stock?: number }[] | string | null;
  addOns?: AddOn[] | string | null;
};
export type PosItemSelection = { variations: { name: string; required: boolean; min: number; max: number; values: { label: string[] } }[]; choices: Record<string, string>; addOns: { id: string; qty: number }[] };

const parseGroups = (value: Group[] | string | null | undefined): Group[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  return [];
};
const parseVariants = (value: PosOptionItem['variations']) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  return [];
};

export default function PosItemOptionsDialog({ item, onCancel, onConfirm }: { item: PosOptionItem; onCancel: () => void; onConfirm: (selection: PosItemSelection) => void }) {
  const foodGroups = useMemo(() => parseGroups(item.foodVariations), [item.foodVariations]);
  const choiceGroups = useMemo(() => parseGroups(item.choiceOptions), [item.choiceOptions]);
  const productVariants = useMemo(() => parseVariants(item.variations), [item.variations]);
  const addons = useMemo(() => Array.isArray(item.addOns) ? item.addOns.filter((addon) => addon.status !== false) : [], [item.addOns]);
  const [food, setFood] = useState<Record<string, string[]>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const optionCount = foodGroups.length + choiceGroups.length + addons.length;
  const selectedVariantType = choiceGroups.map((group) => String(choices[group.name] || '').replace(/\s/g, '')).filter(Boolean).join('-');
  const selectedVariant = selectedVariantType ? productVariants.find((variant) => variant.type === selectedVariantType) : undefined;
  const hasUnavailableVariant = choiceGroups.length > 0 && Object.keys(choices).length === choiceGroups.length && !selectedVariant;
  const displayedPrice = (selectedVariant?.price ?? Number(item.price)) + foodGroups.reduce((sum, group) => sum + (group.values || []).reduce((inner, option) => inner + (food[group.name]?.includes(option.label) ? Number(option.optionPrice) || 0 : 0), 0), 0) + addons.reduce((sum, addon) => sum + (addonQty[addon._id] || 0) * Number(addon.price || 0), 0);

  if (!optionCount) return null;
  const submit = () => {
    for (const group of foodGroups) {
      const count = food[group.name]?.length || 0;
      const min = Number(group.min) || 0;
      const max = Number(group.max) || 0;
      if ((group.required === true || group.required === 'on') && !count) return setError(`Choose an option for ${group.name}.`);
      if (count < min) return setError(`Choose at least ${min} option(s) for ${group.name}.`);
      if (max && count > max) return setError(`Choose no more than ${max} option(s) for ${group.name}.`);
    }
    for (const group of choiceGroups) if (!choices[group.name]) return setError(`Choose ${group.title || group.name}.`);
    if (choiceGroups.length && (!selectedVariant || Number(selectedVariant.stock) <= 0)) return setError('This product variant is unavailable or out of stock.');
    setError('');
    onConfirm({
      variations: foodGroups.filter((group) => (food[group.name] || []).length).map((group) => ({ name: group.name, required: Boolean(group.required), min: Number(group.min) || 0, max: Number(group.max) || 0, values: { label: food[group.name] } })),
      choices,
      addOns: Object.entries(addonQty).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ id, qty })),
    });
  };

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="pos-options-title" className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
      <header><h2 id="pos-options-title" className="text-lg font-semibold">{item.name}</h2><p className="text-sm text-slate-500">Base price {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.price)}</p></header>
      {foodGroups.map((group) => <fieldset key={group.name} className="space-y-2"><legend className="text-sm font-semibold">{group.name}{group.required === true || group.required === 'on' || Number(group.min) > 0 ? ' *' : ''}<span className="ml-2 font-normal text-slate-500">{Number(group.min) > 0 ? `Choose ${group.min}${Number(group.max) > Number(group.min) ? `–${group.max}` : ''}` : Number(group.max) > 0 ? `Up to ${group.max}` : 'Choose any'}</span></legend>{(group.values || []).map((option) => <label key={option.label} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"><span className="flex items-center gap-2"><input type="checkbox" checked={(food[group.name] || []).includes(option.label)} onChange={(event) => setFood((current) => { const previous = current[group.name] || []; const next = event.target.checked ? [...previous, option.label] : previous.filter((label) => label !== option.label); return { ...current, [group.name]: next }; })} />{option.label}</span><span>+{Number(option.optionPrice || 0).toFixed(2)}</span></label>)}</fieldset>)}
      {choiceGroups.map((group) => <label key={group.name} className="block space-y-1 text-sm font-semibold">{group.title || group.name}<select value={choices[group.name] || ''} onChange={(event) => setChoices((current) => ({ ...current, [group.name]: event.target.value }))} className="w-full rounded-lg border bg-white px-3 py-2 font-normal"><option value="">Select…</option>{(group.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>)}
      {selectedVariant && <p className="text-xs text-slate-500">Variant stock: {selectedVariant.stock ?? 'managed at checkout'}</p>}
      {addons.length > 0 && <fieldset className="space-y-2"><legend className="text-sm font-semibold">Add-ons</legend>{addons.map((addon) => <div key={addon._id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"><span>{addon.name} · +{Number(addon.price).toFixed(2)}</span><input aria-label={`${addon.name} quantity`} type="number" min="0" max="99" value={addonQty[addon._id] || 0} onChange={(event) => setAddonQty((current) => ({ ...current, [addon._id]: Math.max(0, Math.min(99, Number(event.target.value) || 0)) }))} className="w-20 rounded border px-2 py-1" /></div>)}</fieldset>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {hasUnavailableVariant && <p className="text-sm text-amber-700">This combination has no price or stock entry.</p>}
      <footer className="flex items-center justify-between gap-3 border-t pt-3"><span className="text-sm font-semibold">Options subtotal: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(displayedPrice)}</span><div className="flex gap-2"><button type="button" onClick={onCancel} className="rounded-lg border px-3 py-2 text-sm">Cancel</button><button type="button" onClick={submit} disabled={hasUnavailableVariant} className="rounded-lg bg-[#08234b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add item</button></div></footer>
    </section>
  </div>;
}

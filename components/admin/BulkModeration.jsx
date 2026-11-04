'use client';

import { createContext, useContext, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCheck, Loader2, X } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';

// Admin → Products: tick listings awaiting review (or rejected) and approve / reject them together, or approve
// every listing awaiting review at once (POST /api/admin/products/moderate).

const Selection = createContext(null);
const useSelection = () => useContext(Selection);

/** POST the decision; toasts the outcome and refreshes the page. Resolves to true when anything changed. */
function useModerate() {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  return async (body) => {
    try {
      const res = await fetch('/api/admin/products/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Update failed');
      const verb = body.status === 'approved' ? 'approved' : 'rejected';
      if (data.updated) toast.success(`${data.updated} product${data.updated === 1 ? '' : 's'} ${verb}`, data.failed.length ? undefined : data.updated === 1 ? 'The seller has been messaged.' : 'Their sellers have been messaged.');
      if (data.failed.length) toast.error(`${data.failed.length} couldn’t be ${verb}`, data.failed.slice(0, 3).map((f) => `“${f.title}”: ${f.error}`).join(' · '));
      if (!data.updated && !data.failed.length) toast.success('Nothing to update', 'They were already decided.');
      startTransition(() => router.refresh());
      return true;
    } catch (err) {
      toast.error('Could not update products', err.message);
      return false;
    }
  };
}

/** Wraps the products list. `selectable` = ids on this page that can be decided (awaiting review or rejected). */
export function BulkSelectionProvider({ selectable, children }) {
  const [selected, setSelected] = useState(() => new Set());
  const key = selectable.join(',');
  // A new page / filter / refresh: drop ids that are no longer here or no longer need a decision.
  useEffect(() => setSelected((prev) => new Set([...prev].filter((id) => selectable.includes(id)))), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const value = useMemo(
    () => ({
      selectable,
      selected,
      toggle: (id) =>
        setSelected((prev) => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        }),
      setAll: (on) => setSelected(on ? new Set(selectable) : new Set()),
    }),
    [selectable, selected],
  );
  return <Selection.Provider value={value}>{children}</Selection.Provider>;
}

const box = 'size-4 cursor-pointer rounded border-stone-300 accent-ink';

/** Row checkbox (only for listings that can be decided). */
export function SelectProduct({ id, title }) {
  const { selected, toggle } = useSelection();
  return <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} aria-label={`Select “${title}”`} className={box} />;
}

/** Header checkbox: every decidable listing on this page. */
export function SelectAllProducts({ className = '' }) {
  const { selectable, selected, setAll } = useSelection();
  if (!selectable.length) return null;
  const all = selected.size === selectable.length;
  return (
    <input
      type="checkbox"
      checked={all}
      ref={(el) => el && (el.indeterminate = selected.size > 0 && !all)}
      onChange={() => setAll(!all)}
      aria-label="Select all listings awaiting a decision on this page"
      className={`${box} ${className}`}
    />
  );
}

/** Phones: "Select all (N)" above the card list. */
export function SelectAllRow() {
  const { selectable } = useSelection();
  if (!selectable.length) return null;
  return (
    <label className="mb-3 flex items-center gap-2.5 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium md:hidden">
      <SelectAllProducts />
      Select all awaiting a decision ({selectable.length})
    </label>
  );
}

/** Floating bar while something is ticked: Approve selected · Reject selected · Clear. */
export function BulkBar() {
  const { selected, setAll } = useSelection();
  const moderate = useModerate();
  const [busy, setBusy] = useState(null);
  if (!selected.size) return null;

  async function decide(status) {
    setBusy(status);
    if (await moderate({ ids: [...selected], status })) setAll(false);
    setBusy(null);
  }

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-white/95 px-4 py-3 shadow-[0_12px_32px_-14px_rgba(20,20,20,0.35)] backdrop-blur"
    >
      <p className="mr-auto text-sm font-medium">
        {selected.size} selected
        <button type="button" onClick={() => setAll(false)} disabled={Boolean(busy)} className="ml-3 text-stone-500 underline-offset-2 hover:text-ink hover:underline">
          Clear
        </button>
      </p>
      <button type="button" onClick={() => decide('rejected')} disabled={Boolean(busy)} className="btn btn-sm text-red-600 hover:bg-red-50">
        {busy === 'rejected' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <X size={14} strokeWidth={2} aria-hidden="true" />}
        Reject selected
      </button>
      <button type="button" onClick={() => decide('approved')} disabled={Boolean(busy)} className="btn btn-sm btn-dark">
        {busy === 'approved' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} strokeWidth={2} aria-hidden="true" />}
        Approve selected ({selected.size})
      </button>
    </div>
  );
}

/** Header action: approve every listing awaiting review (all pages), after a confirm step. */
export function ApproveAllButton({ count }) {
  const moderate = useModerate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!count) return null;

  async function approveAll() {
    setBusy(true);
    await moderate({ all: true, status: 'approved' });
    setBusy(false);
    setConfirming(false);
  }

  return confirming ? (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-stone-200 bg-white p-1.5 pl-4 text-sm sm:flex-nowrap">
      <span className="whitespace-nowrap">Put all {count} live?</span>
      <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="btn btn-sm text-stone-600 hover:bg-stone-100">
        Cancel
      </button>
      <button type="button" onClick={approveAll} disabled={busy} className="btn btn-sm btn-dark">
        {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
        {busy ? 'Approving…' : 'Approve all'}
      </button>
    </div>
  ) : (
    <button type="button" onClick={() => setConfirming(true)} className="btn btn-md btn-dark">
      <CheckCheck size={16} strokeWidth={1.75} aria-hidden="true" />
      Approve all awaiting review ({count})
    </button>
  );
}

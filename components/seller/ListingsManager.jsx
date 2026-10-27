'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LayoutGrid, List, Pencil, Pin, Plus, Search, Trash2, X } from 'lucide-react';
import Pagination from '@/components/Pagination';
import { StatusBadge, formatDateTime } from '@/components/dashboard/ui';
import { useToast } from '@/components/dashboard/Toaster';
import { listingStatus } from '@/lib/listing';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';

const STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'review', label: 'In review' },
  { key: 'draft', label: 'Draft' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'rejected', label: 'Rejected' },
];
const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'updated', label: 'Recently updated' },
  { key: 'title', label: 'Title: A–Z' },
  { key: 'price_high', label: 'Price: high to low' },
  { key: 'price_low', label: 'Price: low to high' },
  { key: 'sales', label: 'Most sales' },
];
// Values left out of the URL when they're the default.
const DEFAULTS = { status: 'all', q: '', sort: 'newest', featured: '', view: 'grid', stats: '1' };

const BASE = '/seller/listings';
const usd = (cents) => (cents == null ? '—' : cents === 0 ? 'Free' : formatPrice(cents, 'USD'));

function toUrl(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '' && v !== DEFAULTS[k]) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${BASE}?${s}` : BASE;
}

/** Empty shelf: dashed outlines of a vase, a box and a bowl on a table (decorative). */
function EmptyShelf() {
  return (
    <svg aria-hidden="true" viewBox="0 0 160 140" className="h-32 w-40" fill="none">
      <g stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" className="text-stone-400">
        <path d="M70 8h20v8c10 4 14 12 12 22-2 8-10 12-22 12s-20-4-22-12c-2-10 2-18 12-22z" />
        <rect x="22" y="54" width="52" height="34" rx="2" />
        <path d="M86 58h50c0 18-11 30-25 30S86 76 86 58z" />
      </g>
      <rect x="10" y="88" width="140" height="10" rx="2" className="fill-brand-600" />
      <rect x="30" y="98" width="6" height="34" rx="1" className="fill-brand-600" />
      <rect x="124" y="98" width="6" height="34" rx="1" className="fill-brand-600" />
    </svg>
  );
}

/** Small on/off switch (Stats, Featured). */
function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors ${checked ? 'border-ink bg-ink' : 'border-stone-300 bg-white'}`}
    >
      <span className={`absolute size-5 rounded-full transition-all ${checked ? 'left-[1.375rem] bg-white' : 'left-0.5 bg-stone-400'}`} />
    </button>
  );
}

/**
 * Seller → Listings: search, bulk actions (activate / deactivate / delete), grid or list view, and a sidebar with
 * stats, sort, status filters and the featured filter. Filters live in the URL; the page re-renders on the server.
 */
export default function ListingsManager({ items, counts, total, pagination, params }) {
  const router = useRouter();
  const toast = useToast();
  const dialogRef = useRef(null);
  const dialogTitle = useId();
  const [query, setQuery] = useState(params.q);
  const [selected, setSelected] = useState(() => new Set());
  const [toDelete, setToDelete] = useState([]); // ids awaiting the Yes/No confirmation
  const [busy, setBusy] = useState(null);
  const [navigating, startNavigation] = useTransition();
  const [, startRefresh] = useTransition();

  const showStats = params.stats !== '0';
  const grid = params.view !== 'list';
  const pageIds = items.map((p) => p._id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;
  const selectAllRef = useRef(null);

  // A new page of results: forget the old selection.
  const itemsKey = pageIds.join();
  useEffect(() => setSelected(new Set()), [itemsKey]);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function go(patch) {
    const next = { ...params, ...patch };
    if (!('page' in patch)) delete next.page;
    startNavigation(() => router.push(toUrl(next), { scroll: false }));
  }

  function toggle(id) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulk(action, ids) {
    setBusy(action);
    try {
      const res = await fetch('/api/seller/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      const n = (x) => `${x} listing${x === 1 ? '' : 's'}`;
      if (action === 'delete') {
        toast.success(
          `${n(data.done + data.archived)} deleted`,
          data.archived ? `${n(data.archived)} already sold, so they were hidden from the store instead — buyers keep their downloads.` : undefined,
        );
      } else {
        toast.success(
          `${n(data.done)} ${action === 'activate' ? 'activated' : 'deactivated'}`,
          data.skipped ? `${n(data.skipped)} skipped — only approved listings can be shown or hidden.` : undefined,
        );
      }
      dialogRef.current?.close();
      setSelected(new Set());
      startRefresh(() => router.refresh());
    } catch (err) {
      toast.error('Action failed', err.message);
    } finally {
      setBusy(null);
    }
  }

  async function setVisible(p, visible) {
    setBusy(`visibility:${p._id}`);
    try {
      const res = await fetch(`/api/seller/products/${p._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: visible }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      toast.success(
        visible ? `“${p.title}” is active` : `“${p.title}” is inactive`,
        visible ? 'It’s visible in the store again.' : 'It’s hidden from the store.',
      );
      startRefresh(() => router.refresh());
    } catch (err) {
      toast.error('Could not update the listing', err.message);
    } finally {
      setBusy(null);
    }
  }

  function askDelete(ids) {
    setToDelete(ids);
    dialogRef.current?.showModal();
  }

  const statusLabel = STATUS_OPTIONS.find((o) => o.key === params.status)?.label ?? 'All';
  const filtered = Boolean(params.q || params.featured || params.status !== 'all');
  const toolbarBtn = 'btn btn-sm btn-outline disabled:pointer-events-none disabled:opacity-40';

  // Render helpers (plain functions, not components, so rows don't remount on every render).
  function actions(p, className = '') {
    const s = listingStatus(p);
    return (
      <div className={`flex items-center ${className}`}>
        <Link
          href={`${BASE}/${p._id}/edit`}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
          Edit<span className="sr-only"> {p.title}</span>
        </Link>
        {p.status === 'approved' && (
          <button
            type="button"
            onClick={() => setVisible(p, s.key !== 'active')}
            disabled={Boolean(busy)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            {s.key === 'active' ? (
              <EyeOff size={14} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Eye size={14} strokeWidth={1.75} aria-hidden="true" />
            )}
            {s.key === 'active' ? 'Deactivate' : 'Activate'}
            <span className="sr-only"> {p.title}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => askDelete([p._id])}
          disabled={Boolean(busy)}
          aria-label={`Delete ${p.title}`}
          className="ml-auto grid size-8 place-items-center rounded-full text-stone-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const cover = (p, sizes) =>
    p.coverImage ? (
      <Image src={p.coverImage} alt="" fill sizes={sizes} placeholder="blur" blurDataURL={NEUTRAL_BLUR_DATA_URL} className="object-cover" />
    ) : (
      <span aria-hidden="true" className="headline flex h-full items-center justify-center text-3xl text-stone-400">
        {p.title.charAt(0)}
      </span>
    );

  return (
    <>
      {/* ---------- Header ---------- */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="headline text-3xl sm:text-4xl">Listings</h1>
        <div className="flex flex-1 flex-col gap-3 sm:max-w-xl sm:flex-row sm:items-center sm:justify-end">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              go({ q: query.trim() });
            }}
            className="relative flex-1"
          >
            <label htmlFor="listing-search" className="sr-only">
              Search listings
            </label>
            <input
              id="listing-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or tag"
              className="h-11 w-full rounded-full border border-stone-300 bg-white pl-5 pr-12 text-sm placeholder:text-stone-400 focus:border-ink focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-stone-700 hover:bg-stone-100"
            >
              <Search size={17} strokeWidth={2} aria-hidden="true" />
            </button>
          </form>
          <Link href={`${BASE}/new`} className="btn btn-md btn-dark shrink-0">
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Add a listing
          </Link>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_15rem] xl:grid-cols-[1fr_16rem]">
        {/* ---------- Main column ---------- */}
        <div className="min-w-0 lg:order-1">
          {/* Toolbar */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <label className="flex h-9 items-center gap-2 rounded-full border border-stone-300 bg-white pl-3 pr-4 text-sm">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                disabled={items.length === 0}
                onChange={() => setSelected(allSelected ? new Set() : new Set(pageIds))}
                className="size-4 accent-brand-600"
              />
              {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
            </label>
            <button type="button" disabled={!selected.size || Boolean(busy)} onClick={() => bulk('activate', [...selected])} className={toolbarBtn}>
              {busy === 'activate' ? 'Activating…' : 'Activate'}
            </button>
            <button type="button" disabled={!selected.size || Boolean(busy)} onClick={() => bulk('deactivate', [...selected])} className={toolbarBtn}>
              {busy === 'deactivate' ? 'Deactivating…' : 'Deactivate'}
            </button>
            <button type="button" disabled={!selected.size || Boolean(busy)} onClick={() => askDelete([...selected])} className={toolbarBtn}>
              Delete
            </button>
            {params.q && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  go({ q: '' });
                }}
                aria-label={`Clear search “${params.q}”`}
                className="ml-auto inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-200"
              >
                “{params.q}”
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className={`transition-opacity ${navigating ? 'opacity-60' : ''}`} aria-busy={navigating || undefined}>
            {items.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-16 text-center">
                <EmptyShelf />
                <p className="mt-6 text-lg font-medium">
                  {params.q
                    ? `No listings match “${params.q}”.`
                    : !filtered
                      ? 'You don’t have any listings yet.'
                      : params.featured
                        ? 'You don’t have any featured listings here.'
                        : `You don’t have any ${statusLabel.toLowerCase()} items.`}
                </p>
                {!filtered && (
                  <Link href={`${BASE}/new`} className="btn btn-md btn-dark mt-6">
                    <Plus size={16} strokeWidth={2} aria-hidden="true" />
                    Add your first listing
                  </Link>
                )}
              </div>
            ) : grid ? (
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((p) => {
                  const s = listingStatus(p);
                  const isSelected = selected.has(p._id);
                  return (
                    <li
                      key={p._id}
                      className={`flex flex-col overflow-hidden rounded-2xl border bg-white transition-shadow ${isSelected ? 'border-brand-600 ring-2 ring-brand-600/20' : 'border-stone-200 hover:shadow-lift'}`}
                    >
                      <div className="relative aspect-[4/3] bg-stone-100">
                        {cover(p, '(min-width: 1280px) 300px, (min-width: 640px) 45vw, 92vw')}
                        <label className="absolute left-3 top-3 grid size-8 cursor-pointer place-items-center rounded-lg bg-white/95 shadow-sm">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggle(p._id)}
                            aria-label={`Select ${p.title}`}
                            className="size-4 accent-brand-600"
                          />
                        </label>
                        {p.shopFeatured && (
                          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium shadow-sm">
                            <Pin size={12} strokeWidth={2} aria-hidden="true" className="text-brand-600" />
                            Featured
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <Link href={`${BASE}/${p._id}/edit`} className="line-clamp-2 font-medium leading-snug hover:underline">
                          {p.title}
                        </Link>
                        <p className="mt-1 text-sm tabular-nums text-stone-700">{usd(p.price)}</p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <StatusBadge status={s.tone} label={s.label} />
                          <span className="text-xs text-stone-500">Updated {formatDateTime(p.updatedAt).date}</span>
                        </div>
                        {showStats && (
                          <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-100 pt-3 text-xs">
                            <div>
                              <dt className="text-stone-500">Sales</dt>
                              <dd className="mt-0.5 text-sm font-medium tabular-nums">{p.salesCount.toLocaleString('en-US')}</dd>
                            </div>
                            <div>
                              <dt className="text-stone-500">You earned</dt>
                              <dd className="mt-0.5 text-sm font-medium tabular-nums">{formatPrice(p.earnings, 'USD')}</dd>
                            </div>
                          </dl>
                        )}
                      </div>
                      {actions(p, 'border-t border-stone-100 px-2 py-1.5')}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="border-b border-stone-200 bg-stone-50 text-xs font-medium uppercase tracking-wide text-stone-500">
                      <tr>
                        <th scope="col" className="w-10 px-4 py-3">
                          <span className="sr-only">Select</span>
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Listing
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Status
                        </th>
                        <th scope="col" className="px-4 py-3 text-right">
                          Price
                        </th>
                        {showStats && (
                          <th scope="col" className="px-4 py-3 text-right">
                            Sales
                          </th>
                        )}
                        {showStats && (
                          <th scope="col" className="px-4 py-3 text-right">
                            You earned
                          </th>
                        )}
                        <th scope="col" className="px-4 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {items.map((p) => {
                        const s = listingStatus(p);
                        return (
                          <tr key={p._id} className={selected.has(p._id) ? 'bg-brand-50/50' : 'hover:bg-stone-50/70'}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selected.has(p._id)}
                                onChange={() => toggle(p._id)}
                                aria-label={`Select ${p.title}`}
                                className="size-4 accent-brand-600"
                              />
                            </td>
                            <td className="min-w-[15rem] px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="relative aspect-[4/3] w-16 shrink-0 overflow-hidden rounded-lg bg-stone-100">{cover(p, '64px')}</div>
                                <div className="min-w-0">
                                  <Link href={`${BASE}/${p._id}/edit`} className="line-clamp-1 font-medium hover:underline">
                                    {p.title}
                                  </Link>
                                  <p className="flex items-center gap-1.5 text-xs text-stone-500">
                                    {p.shopFeatured && <Pin size={11} strokeWidth={2} aria-label="Featured" className="text-brand-600" />}
                                    Updated {formatDateTime(p.updatedAt).date}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={s.tone} label={s.label} />
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">{usd(p.price)}</td>
                            {showStats && <td className="px-4 py-3 text-right tabular-nums">{p.salesCount.toLocaleString('en-US')}</td>}
                            {showStats && <td className="px-4 py-3 text-right font-medium tabular-nums">{formatPrice(p.earnings, 'USD')}</td>}
                            <td className="whitespace-nowrap px-4 py-3">{actions(p, 'justify-end')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath={BASE} params={params} />
            {total > 0 && <p className="mt-4 text-center text-xs text-stone-500">{`${total} listing${total === 1 ? '' : 's'}`}</p>}
          </div>
        </div>

        {/* ---------- Sidebar ---------- */}
        <aside aria-label="Listing filters" className="order-first space-y-6 border-b border-stone-200 pb-6 lg:order-2 lg:border-0 lg:pb-0">
          <div className="flex items-center justify-between gap-4 lg:justify-start">
            <span className="text-sm font-medium">Stats</span>
            <Switch checked={showStats} onChange={(on) => go({ stats: on ? '1' : '0', page: params.page })} label="Show sales stats" />
          </div>

          <div className="flex gap-2" role="group" aria-label="View">
            {[
              { key: 'grid', icon: LayoutGrid, label: 'Grid view' },
              { key: 'list', icon: List, label: 'List view' },
            ].map(({ key, icon: Icon, label }) => {
              const on = (params.view || 'grid') === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  aria-label={label}
                  onClick={() => go({ view: key, page: params.page })}
                  className={`grid size-10 place-items-center rounded-full border-2 transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-ink'}`}
                >
                  <Icon size={17} strokeWidth={2} aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <div>
            <label htmlFor="listing-sort" className="text-sm font-medium">
              Sort
            </label>
            <select
              id="listing-sort"
              value={params.sort}
              onChange={(e) => go({ sort: e.target.value })}
              className="mt-2 h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm focus:border-ink focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Listing status</legend>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 lg:grid-cols-1">
              {STATUS_OPTIONS.map((o) => (
                <label key={o.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1 text-sm text-stone-700 hover:text-black">
                  <input
                    type="radio"
                    name="listing-status"
                    checked={params.status === o.key}
                    onChange={() => go({ status: o.key })}
                    className="size-4 accent-ink"
                  />
                  {o.label}
                  <span className="text-xs tabular-nums text-stone-400">{counts[o.key] ?? 0}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-2.5 border-t border-stone-200 pt-5 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={Boolean(params.featured)}
              onChange={(e) => go({ featured: e.target.checked ? '1' : '' })}
              className="size-4 accent-ink"
            />
            Featured listings
            <span className="text-xs tabular-nums text-stone-400">{counts.featured}</span>
          </label>
        </aside>
      </div>

      {/* ---------- Delete confirmation (single or bulk) ---------- */}
      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitle}
        onClick={(e) => e.target === e.currentTarget && busy !== 'delete' && e.currentTarget.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 text-left text-ink shadow-2xl backdrop:bg-black/40"
      >
        <div className="p-6">
          <span className="grid size-11 place-items-center rounded-full bg-red-50 text-red-600">
            <Trash2 size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 id={dialogTitle} className="mt-4 text-lg font-medium">
            Are you sure you want to delete?
          </h2>
          <p className="mt-1 text-sm font-medium text-stone-800">
            {toDelete.length === 1 ? items.find((p) => p._id === toDelete[0])?.title : `${toDelete.length} listings`}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            Deleted listings are removed permanently. Anything that has already been bought is hidden from the store instead, so those buyers keep
            their downloads.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              disabled={busy === 'delete'}
              className="btn btn-md text-stone-700 hover:bg-stone-100"
            >
              No
            </button>
            <button
              type="button"
              onClick={() => bulk('delete', toDelete)}
              disabled={busy === 'delete'}
              className="btn btn-md bg-red-600 text-white hover:bg-red-700"
            >
              {busy === 'delete' && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {busy === 'delete' ? 'Deleting…' : 'Yes, delete'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

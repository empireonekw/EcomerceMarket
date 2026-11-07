'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import Stars from '@/components/Stars';
import { StarInput } from '@/components/reviews/ReviewDialog';
import { useToast } from '@/components/dashboard/Toaster';
import { IMPORT_LIMITS, importedReviewProblems, importedSaleProblems } from '@/lib/imported';

const field = 'mt-1 h-10 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm focus:border-ink focus:outline-none';
const day = (d) => new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' });
const today = () => new Date().toISOString().slice(0, 10);

function Err({ children }) {
  return children ? <p className="mt-1 text-xs font-medium text-red-600">{children}</p> : null;
}

/**
 * Admin → seller → "Sales & reviews from their other shop": add the sales and reviews a seller earned outside Sellpify
 * (after checking the proof they sent), see what's been added, and remove an entry. They count in the shop's totals,
 * noted as "from the seller's other shop" (lib/data/imported.js).
 */
export default function ImportedRecordsPanel({ sellerId, records }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [tab, setTab] = useState('sale');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [sale, setSale] = useState({ count: '', note: '' });
  const [review, setReview] = useState({ authorName: '', rating: 5, body: '', reviewedAt: today(), note: '' });

  const totalSales = records.sales.reduce((n, s) => n + s.count, 0);
  const avg = records.reviews.length ? records.reviews.reduce((n, r) => n + r.rating, 0) / records.reviews.length : 0;

  async function send(method, url, body) {
    setBusy(true);
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(body && { body: JSON.stringify(body) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.fields ?? {});
        toast.error('Could not save', data.error);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      toast.error('Network error', 'Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addSale(e) {
    e.preventDefault();
    const entry = { ...sale, count: Number(sale.count) };
    const found = importedSaleProblems(entry);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (await send('POST', `/api/admin/users/${sellerId}/imported`, { kind: 'sale', ...entry })) {
      toast.success(`${entry.count.toLocaleString('en-US')} sales added`);
      setSale((s) => ({ ...s, count: '', note: '' }));
    }
  }

  async function addReview(e) {
    e.preventDefault();
    const found = importedReviewProblems(review);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (await send('POST', `/api/admin/users/${sellerId}/imported`, { kind: 'review', ...review })) {
      toast.success('Review added');
      setReview((r) => ({ ...r, authorName: '', rating: 5, body: '' }));
    }
  }

  async function remove(kind, entryId) {
    if (!window.confirm(`Remove this ${kind}? It disappears from the shop at once.`)) return;
    if (await send('DELETE', `/api/admin/users/${sellerId}/imported?kind=${kind}&entry=${entryId}`))
      toast.success(kind === 'sale' ? 'Sales removed' : 'Review removed');
  }

  return (
    <div>
      <p className="border-b border-stone-100 px-5 py-3 text-sm text-stone-600">
        Counted in the shop’s totals, noted as “from the seller’s other shop”.{' '}
        <span className="font-medium text-ink">
          {totalSales.toLocaleString('en-US')} sales · {records.reviews.length} review{records.reviews.length === 1 ? '' : 's'}
          {records.reviews.length > 0 && ` (${avg.toFixed(1)} ★)`}
        </span>
      </p>

      <div role="tablist" aria-label="Add" className="flex gap-1 px-5 pt-4">
        {[
          ['sale', 'Add sales'],
          ['review', 'Add a review'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => (setTab(key), setErrors({}))}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${tab === key ? 'bg-ink text-white' : 'text-stone-600 hover:bg-stone-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'sale' ? (
        <form onSubmit={addSale} noValidate className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          <label className="text-sm font-medium sm:col-span-2 sm:max-w-xs">
            Number of sales
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={sale.count}
              onChange={(e) => setSale((s) => ({ ...s, count: e.target.value }))}
              className={field}
            />
            <Err>{errors.count}</Err>
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            How you checked it <span className="font-normal text-stone-500">(admins only)</span>
            <input
              maxLength={IMPORT_LIMITS.note}
              value={sale.note}
              onChange={(e) => setSale((s) => ({ ...s, note: e.target.value }))}
              placeholder="e.g. Sales screenshot, sent in Messages on 5 Nov"
              className={field}
            />
            <Err>{errors.note}</Err>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="btn btn-sm btn-dark">
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Add sales
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={addReview} noValidate className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Reviewer’s name
            <input
              maxLength={IMPORT_LIMITS.name}
              value={review.authorName}
              onChange={(e) => setReview((r) => ({ ...r, authorName: e.target.value }))}
              placeholder="We show first name + initial"
              className={field}
            />
            <Err>{errors.authorName}</Err>
          </label>
          <fieldset className="text-sm font-medium">
            <legend>Stars</legend>
            <StarInput id={`${id}-stars`} value={review.rating} onChange={(rating) => setReview((r) => ({ ...r, rating }))} size={22} />
            <Err>{errors.rating}</Err>
          </fieldset>
          <label className="text-sm font-medium">
            Date written
            <input
              type="date"
              max={today()}
              value={review.reviewedAt}
              onChange={(e) => setReview((r) => ({ ...r, reviewedAt: e.target.value }))}
              className={field}
            />
            <Err>{errors.reviewedAt}</Err>
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Review text
            <textarea
              rows={3}
              maxLength={IMPORT_LIMITS.review}
              value={review.body}
              onChange={(e) => setReview((r) => ({ ...r, body: e.target.value }))}
              placeholder="Paste it exactly as written"
              className={`${field} h-auto py-2 leading-relaxed`}
            />
            <Err>{errors.body}</Err>
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            How you checked it <span className="font-normal text-stone-500">(admins only)</span>
            <input
              maxLength={IMPORT_LIMITS.note}
              value={review.note}
              onChange={(e) => setReview((r) => ({ ...r, note: e.target.value }))}
              placeholder="e.g. Screenshot of the review, sent in Messages"
              className={field}
            />
            <Err>{errors.note}</Err>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="btn btn-sm btn-dark">
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Add review
            </button>
          </div>
        </form>
      )}

      {/* ---------- What's been added ---------- */}
      {(records.sales.length > 0 || records.reviews.length > 0) && (
        <ul className="divide-y divide-stone-100 border-t border-stone-100">
          {records.sales.map((s) => (
            <li key={s._id} className="flex items-start gap-3 px-5 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.count.toLocaleString('en-US')} sales</p>
                <p className="text-xs break-words text-stone-500">
                  {s.note} · added {day(s.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove('sale', s._id)}
                disabled={busy}
                aria-label="Remove these sales"
                className="grid size-8 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          ))}
          {records.reviews.map((r) => (
            <li key={r._id} className="flex items-start gap-3 px-5 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <Stars rating={r.rating} size={13} />
                  {r.authorName} · {day(r.reviewedAt)}
                </p>
                <p className="mt-0.5 line-clamp-2 text-stone-700">{r.body}</p>
                <p className="text-xs break-words text-stone-500">
                  {r.note} · added {day(r.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove('review', r._id)}
                disabled={busy}
                aria-label="Remove this review"
                className="grid size-8 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

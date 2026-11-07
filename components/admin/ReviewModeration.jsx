'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Flag, History } from 'lucide-react';
import Stars from '@/components/Stars';
import VerifiedBadge from '@/components/VerifiedBadge';
import { StarInput } from '@/components/reviews/ReviewDialog';
import { useToast } from '@/components/dashboard/Toaster';
import { reportReasonLabel, reviewProblems } from '@/lib/reviews';
import { REVIEW_LIMITS } from '@/lib/validation';

const fmt = (d) => new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const area = 'w-full rounded-xl border border-stone-300 px-4 py-3 text-sm leading-relaxed focus:border-ink focus:outline-none focus:ring-2 focus:ring-brand-500/20';
const OUTCOME = {
  kept: { label: 'Kept', cls: 'bg-stone-100 text-stone-700' },
  edited: { label: 'Corrected', cls: 'bg-sky-50 text-sky-800' },
  removed: { label: 'Removed', cls: 'bg-red-50 text-red-700' },
};

/**
 * One review in Admin → Reviews: the review (and its earlier versions), who wrote it, the shop, the seller's report
 * and message, and the actions: Keep · Edit · Remove (or Restore a removed one). An optional note goes to the seller.
 */
export default function ReviewModeration({ review: r }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [mode, setMode] = useState(null); // null | 'edit' | 'remove'
  const [rating, setRating] = useState(r.rating);
  const [body, setBody] = useState(r.body);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const open = r.report?.status === 'open';

  async function act(action) {
    setError(null);
    if (action === 'edit') {
      const found = reviewProblems({ rating, body });
      setErrors(found);
      if (Object.keys(found).length) return;
    }
    if (action === 'remove' && reason.trim().length < 5) return setErrors({ reason: 'Say why it’s removed (the buyer sees this).' });
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/reviews/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rating, body: body.trim(), reason: reason.trim(), note: note.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.fields ?? {});
        return setError(data.error ?? 'Could not save.');
      }
      toast.success({ keep: 'Review kept', edit: 'Review corrected', remove: 'Review removed', restore: 'Review restored' }[action], open ? 'The seller and buyer have been told.' : undefined);
      setMode(null);
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`rounded-2xl border bg-white ${open ? 'border-amber-200' : 'border-stone-200'}`}>
      {/* ---------- Report ---------- */}
      {r.report && (
        <div className={`flex flex-wrap items-start gap-3 rounded-t-2xl border-b px-5 py-4 ${open ? 'border-amber-100 bg-amber-50/70' : 'border-stone-100 bg-stone-50'}`}>
          <Flag size={16} strokeWidth={1.75} aria-hidden="true" className={`mt-0.5 shrink-0 ${open ? 'text-amber-700' : 'text-stone-500'}`} />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-ink">
              {r.shop?.name ?? 'The seller'} reported it: {reportReasonLabel(r.report.reason)}
            </p>
            <p className="mt-1 whitespace-pre-line text-stone-700">“{r.report.message}”</p>
            <p className="mt-1 text-xs text-stone-500">{fmt(r.report.reportedAt)}</p>
            {r.report.note && <p className="mt-2 text-xs text-stone-600">Our reply: {r.report.note}</p>}
          </div>
          {!open && OUTCOME[r.report.status] && <span className={`rounded-full px-3 py-1 text-xs font-medium ${OUTCOME[r.report.status].cls}`}>{OUTCOME[r.report.status].label}</span>}
        </div>
      )}

      {/* ---------- Review ---------- */}
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 text-sm">
            <Link href={`/products/${r.productSlug}#reviews`} target="_blank" className="line-clamp-1 font-medium text-ink hover:underline">
              {r.productTitle}
            </Link>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-stone-500">
              {r.shop ? (
                <>
                  Shop:{' '}
                  <Link href={`/admin/users/${r.shop.id}`} className="font-medium text-stone-700 hover:underline">
                    {r.shop.name}
                  </Link>
                  {r.shop.verified && <VerifiedBadge size={13} />}
                </>
              ) : (
                'Sold by Sellpify'
              )}
              <span>·</span>
              By{' '}
              {r.buyer ? (
                <Link href={`/admin/users/${r.buyer.id}`} className="font-medium text-stone-700 hover:underline">
                  {r.buyer.name}
                </Link>
              ) : (
                r.authorName
              )}
              {r.buyer && <span className="text-xs">({r.buyer.email})</span>}
            </p>
          </div>
          <div className="text-right text-xs text-stone-500">
            <Stars rating={r.rating} size={15} />
            <p className="mt-1">{fmt(r.createdAt)}</p>
            {r.editCount > 0 && <p>Edited by the buyer {r.editCount}×</p>}
          </div>
        </div>
        <p className={`mt-3 whitespace-pre-line text-base leading-relaxed ${r.hidden ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{r.body}</p>
        {r.hidden && <p className="mt-2 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800">Removed: {r.hiddenReason}</p>}

        {r.history.length > 0 && (
          <div className="mt-3">
            <button type="button" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory} className="inline-flex items-center gap-2 text-xs font-medium text-stone-600 hover:text-ink">
              <History size={13} strokeWidth={1.75} aria-hidden="true" />
              {r.history.length} earlier version{r.history.length === 1 ? '' : 's'}
              <ChevronDown size={13} aria-hidden="true" className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>
            {showHistory && (
              <ol className="mt-2 space-y-2 border-l-2 border-stone-200 pl-4">
                {[...r.history].reverse().map((h, i) => (
                  <li key={i} className="text-sm text-stone-600">
                    <p className="flex items-center gap-2 text-xs text-stone-500">
                      <Stars rating={h.rating} size={12} />
                      {h.by === 'admin' ? 'Before an admin edit' : 'Before the buyer’s edit'} · {fmt(h.at)}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line">{h.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* ---------- Edit / remove forms ---------- */}
        {mode === 'edit' && (
          <div className="mt-4 space-y-3 rounded-xl border border-stone-200 p-4">
            <fieldset>
              <legend className="text-sm font-medium">Rating</legend>
              <StarInput id={id} value={rating} onChange={setRating} size={24} />
              {errors.rating && <p className="mt-1 text-sm text-red-600">{errors.rating}</p>}
            </fieldset>
            <div>
              <label htmlFor={`${id}-body`} className="text-sm font-medium">
                Review text
              </label>
              <textarea id={`${id}-body`} rows={4} maxLength={REVIEW_LIMITS.max} value={body} onChange={(e) => setBody(e.target.value)} className={`${area} mt-2`} />
              {errors.body && <p className="mt-1 text-sm text-red-600">{errors.body}</p>}
              <p className="mt-1 text-xs text-stone-500">The buyer is told it was corrected. This doesn’t use any of their own edits.</p>
            </div>
          </div>
        )}
        {mode === 'remove' && (
          <div className="mt-4 rounded-xl border border-red-200 p-4">
            <label htmlFor={`${id}-reason`} className="text-sm font-medium">
              Why is it removed? <span className="font-normal text-stone-500">(the buyer sees this)</span>
            </label>
            <textarea
              id={`${id}-reason`}
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. It’s about a different product and breaks our review rules."
              className={`${area} mt-2`}
            />
            {errors.reason && <p className="mt-1 text-sm text-red-600">{errors.reason}</p>}
          </div>
        )}
        {open && (
          <div className="mt-4">
            <label htmlFor={`${id}-note`} className="text-sm font-medium">
              Note to the seller <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <input id={`${id}-note`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Added to the message we send them" className={`${area} mt-2 h-11 py-0`} />
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        {/* ---------- Actions ---------- */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
          {mode === 'edit' ? (
            <>
              <button type="button" disabled={saving} onClick={() => act('edit')} className="btn btn-sm btn-dark">
                Save correction
              </button>
              <button type="button" disabled={saving} onClick={() => (setMode(null), setRating(r.rating), setBody(r.body), setErrors({}))} className="btn btn-sm btn-outline">
                Cancel
              </button>
            </>
          ) : mode === 'remove' ? (
            <>
              <button type="button" disabled={saving} onClick={() => act('remove')} className="btn btn-sm bg-red-600 text-white hover:bg-red-700">
                Remove review
              </button>
              <button type="button" disabled={saving} onClick={() => (setMode(null), setErrors({}))} className="btn btn-sm btn-outline">
                Cancel
              </button>
            </>
          ) : (
            <>
              {open && (
                <button type="button" disabled={saving} onClick={() => act('keep')} className="btn btn-sm btn-dark">
                  Keep it
                </button>
              )}
              {!r.hidden && (
                <button type="button" disabled={saving} onClick={() => setMode('edit')} className="btn btn-sm btn-outline">
                  Edit review
                </button>
              )}
              {r.hidden ? (
                <button type="button" disabled={saving} onClick={() => act('restore')} className="btn btn-sm btn-outline">
                  Restore review
                </button>
              ) : (
                <button type="button" disabled={saving} onClick={() => setMode('remove')} className="btn btn-sm text-red-600 hover:bg-red-50">
                  Remove…
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

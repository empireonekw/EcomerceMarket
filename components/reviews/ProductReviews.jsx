'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BadgeCheck, Loader2, MessageSquareText } from 'lucide-react';
import Stars from '@/components/Stars';
import ReviewDialog from '@/components/reviews/ReviewDialog';
import { useAuth } from '@/context/AuthContext';
import { REVIEW_EDIT_LIMIT } from '@/lib/reviews';

const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** One public review: who, stars, when, "Verified purchase" and "Edited". */
export function ReviewCard({ review, mine = false }) {
  return (
    <article className={`rounded-2xl border p-5 ${mine ? 'border-brand-200 bg-brand-50/40' : 'border-stone-200 bg-white'}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-stone-100 text-sm font-semibold text-stone-700">
          {review.authorName?.charAt(0) ?? '?'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-ink">
            {mine ? 'Your review' : review.authorName}
            <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-700">
              <BadgeCheck size={13} strokeWidth={2} aria-hidden="true" />
              Verified purchase
            </span>
          </p>
          <p className="text-xs text-stone-500">
            {fmtDate(review.createdAt)}
            {review.edited && ' · Edited'}
          </p>
        </div>
        <Stars rating={review.rating} size={15} />
      </header>
      <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-stone-700">{review.body}</p>
    </article>
  );
}

/**
 * Product page → Reviews (laid out by its own width: it sits beside the buy box on large screens). The summary and first page come from the server (the page stays cached); more pages,
 * the star filter and "your review" (write / edit, 3 edits) load in the browser.
 */
export default function ProductReviews({ productId, productTitle, summary, initial }) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [page, setPage] = useState(initial.page);
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [star, setStar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState(null); // { canReview, ownProduct, review }

  useEffect(() => {
    if (authLoading || !user) return setViewer(null);
    let cancelled = false;
    fetch(`/api/reviews/mine?product=${productId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => !cancelled && setViewer(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [productId, user, authLoading]);

  async function load(nextPage, rating = star) {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?product=${productId}&page=${nextPage}${rating ? `&rating=${rating}` : ''}`);
      const data = await res.json();
      setItems((prev) => (nextPage === 1 ? data.items : [...prev, ...data.items]));
      setPage(data.page);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }

  function filterBy(rating) {
    const next = star === rating ? null : rating;
    setStar(next);
    load(1, next);
  }

  // Your own review shows on top (and not again in the list).
  const mine = viewer?.review && !viewer.review.hidden ? viewer.review : null;
  const list = mine ? items.filter((r) => r.id !== mine.id) : items;
  // After writing or editing: show it as yours at once, and refresh the cached summary (average, counts).
  const refreshMine = (saved) => {
    setViewer((v) => ({
      ...v,
      canReview: false,
      review: { ...saved, id: saved.id ?? saved._id, editCount: saved.editCount ?? 0, editsLeft: saved.editsLeft ?? REVIEW_EDIT_LIMIT - (saved.editCount ?? 0) },
    }));
    router.refresh();
  };

  return (
    <section id="reviews" className="@container scroll-mt-24" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-2xl font-semibold tracking-tight text-ink">
        Reviews
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-8 @2xl:grid-cols-[15rem_minmax(0,1fr)] @2xl:gap-10">
        {/* ---------- Summary ---------- */}
        <div className="@2xl:sticky @2xl:top-28 @2xl:self-start">
          {summary.count > 0 ? (
            <>
              <p className="flex items-end gap-3">
                <span className="font-serif text-5xl leading-none text-ink">{summary.average.toFixed(1)}</span>
                <span className="pb-1">
                  <Stars rating={summary.average} size={18} />
                  <span className="mt-1 block text-sm text-stone-500">
                    {summary.count} review{summary.count === 1 ? '' : 's'}
                  </span>
                </span>
              </p>
              <ul className="mt-5 space-y-2" aria-label="Filter by rating">
                {summary.stars.map((n, i) => {
                  const rating = 5 - i;
                  const pct = summary.count ? Math.round((n / summary.count) * 100) : 0;
                  return (
                    <li key={rating}>
                      <button
                        type="button"
                        onClick={() => filterBy(rating)}
                        disabled={!n}
                        aria-pressed={star === rating}
                        className={`flex w-full items-center gap-3 rounded-lg px-2 py-1 text-sm transition-colors disabled:cursor-default ${star === rating ? 'bg-brand-50' : 'hover:bg-stone-100 disabled:hover:bg-transparent'}`}
                      >
                        <span className="w-10 shrink-0 text-left tabular-nums text-stone-600">{rating} star</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
                          <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="w-9 shrink-0 text-right tabular-nums text-stone-500">{pct}%</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-stone-500">No reviews yet.</p>
          )}

          {/* ---------- Your review / write one ---------- */}
          <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-4">
            {!user ? (
              <p className="text-sm text-stone-600">
                Bought this?{' '}
                <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="font-medium text-ink underline underline-offset-2">
                  Log in
                </Link>{' '}
                to share what you think.
              </p>
            ) : viewer?.canReview ? (
              <>
                <p className="text-sm text-stone-600">You bought this. How was it?</p>
                <ReviewDialog productId={productId} productTitle={productTitle} authorName={user.name} onSaved={refreshMine} className="mt-3 w-full" />
              </>
            ) : mine ? (
              <>
                <p className="text-sm text-stone-600">Thanks for your review!</p>
                <ReviewDialog productId={productId} productTitle={productTitle} authorName={user.name} review={mine} onSaved={refreshMine} className="mt-3 w-full" />
              </>
            ) : viewer?.review?.hidden ? (
              <p className="text-sm text-stone-600">Sellpify removed your review of this product: {viewer.review.hiddenReason}</p>
            ) : viewer?.ownProduct ? (
              <p className="text-sm text-stone-600">This is your product. Buyers’ reviews show here, and you can report any that break the rules from Seller → Reviews.</p>
            ) : (
              <p className="text-sm text-stone-600">Only buyers can review this product, so every review here is from a verified purchase.</p>
            )}
          </div>
        </div>

        {/* ---------- List ---------- */}
        <div className="min-w-0 space-y-3">
          {mine && <ReviewCard review={{ ...mine, authorName: user?.name, edited: mine.editCount > 0 }} mine />}
          {list.length === 0 && !mine ? (
            <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-12 text-center">
              <MessageSquareText size={28} strokeWidth={1.5} aria-hidden="true" className="mx-auto text-stone-400" />
              <p className="mt-3 font-medium text-ink">{star ? `No ${star}-star reviews` : 'Be the first to review this'}</p>
              <p className="mt-1 text-sm text-stone-500">{star ? 'Try another rating.' : 'Reviews come from buyers after their purchase.'}</p>
            </div>
          ) : (
            list.map((r) => <ReviewCard key={r.id} review={r} />)
          )}
          {page < totalPages && (
            <button type="button" onClick={() => load(page + 1)} disabled={loading} className="btn btn-md btn-outline w-full">
              {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {loading ? 'Loading…' : 'Show more reviews'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

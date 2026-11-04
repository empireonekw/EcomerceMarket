import Link from 'next/link';
import Form from 'next/form';
import { PageHeader, EmptyState, buttonClasses } from '@/components/dashboard/ui';
import ReviewModeration from '@/components/admin/ReviewModeration';
import { requireAdmin } from '@/lib/auth';
import { getAdminReviews } from '@/lib/data/reviews';

export const metadata = { title: 'Reviews' };

const VIEWS = [
  { value: 'reported', label: 'Reported', count: 'reported' },
  { value: 'resolved', label: 'Resolved reports', count: 'resolved' },
  { value: 'removed', label: 'Removed', count: 'removed' },
  { value: 'all', label: 'All reviews', count: 'all' },
];
const field = 'h-11 rounded-full border border-stone-300 bg-white px-4 text-sm focus:border-black focus:outline-none';

/**
 * Admin → Reviews: reviews sellers reported as fake or against the rules (oldest report first), with the seller's
 * message. Keep it, correct it or remove it; the seller and the buyer are told in their "From Sellpify" messages.
 */
export default async function AdminReviewsPage({ searchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const view = VIEWS.some((v) => v.value === sp.view) ? sp.view : 'reported';
  const q = (sp.q ?? '').trim();
  const { items, counts } = await getAdminReviews({ view, q });
  const href = (v) => `/admin/reviews?${new URLSearchParams({ view: v, ...(q && { q }) })}`;

  return (
    <>
      <PageHeader title="Reviews" description="Check reviews sellers reported. Keep, correct or remove them: both the seller and the buyer are told." />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Review views" className="flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <Link
              key={v.value}
              href={href(v.value)}
              aria-current={view === v.value ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${view === v.value ? 'border-ink bg-ink text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-ink'}`}
            >
              {v.label}
              <span
                className={`rounded-full px-1.5 text-[11px] font-medium leading-4 tabular-nums ${
                  v.value === 'reported' && counts.reported ? 'bg-amber-400 text-ink' : view === v.value ? 'bg-white/20' : 'bg-stone-100 text-stone-600'
                }`}
              >
                {counts[v.count]}
              </span>
            </Link>
          ))}
        </nav>
        <Form action="/admin/reviews" className="flex gap-2">
          <input type="hidden" name="view" value={view} />
          <label htmlFor="review-search" className="sr-only">
            Search reviews
          </label>
          <input id="review-search" type="search" name="q" defaultValue={q} placeholder="Product, text or buyer…" className={`${field} w-full lg:w-72`} />
          <button type="submit" className={buttonClasses.secondary}>
            Search
          </button>
        </Form>
      </div>

      {items.length === 0 ? (
        <EmptyState title={view === 'reported' ? 'No reported reviews' : 'No reviews here'}>
          {view === 'reported' ? 'When a seller reports a review, it shows up here.' : q ? 'Try another search.' : null}
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {items.map((r) => (
            <li key={r.id}>
              <ReviewModeration review={r} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

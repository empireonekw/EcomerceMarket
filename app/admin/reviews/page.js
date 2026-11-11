import ReviewModeration from '@/components/admin/ReviewModeration';
import { SearchBox, SegmentedNav } from '@/components/admin/ListToolbar';
import { MetricCard } from '@/components/admin/analytics/KpiCard';
import { PageTitle } from '@/components/admin/ui';
import { PendingContent, PendingNavProvider } from '@/components/dashboard/PendingNav';
import { EmptyState } from '@/components/dashboard/ui';
import { requireAdmin } from '@/lib/auth';
import { getAdminReviews } from '@/lib/data/reviews';

export const metadata = { title: 'Reviews' };

const VIEWS = [
  { value: 'reported', label: 'Reported', count: 'reported' },
  { value: 'resolved', label: 'Resolved', count: 'resolved' },
  { value: 'removed', label: 'Removed', count: 'removed' },
  { value: 'all', label: 'All reviews', count: 'all' },
];

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
      <PageTitle title="Reviews" description="Reviews sellers reported. Keep, correct or remove them: both the seller and the buyer are told." />

      <section aria-label="Review totals" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Reported"
          value={counts.reported.toLocaleString('en-US')}
          sub={counts.reported ? 'Waiting for your decision' : 'All caught up'}
          tone="brand"
          href={href('reported')}
        />
        <MetricCard label="Resolved" value={counts.resolved.toLocaleString('en-US')} sub="Reports you’ve handled" href={href('resolved')} />
        <MetricCard label="Removed" value={counts.removed.toLocaleString('en-US')} sub="Hidden from the store" href={href('removed')} />
        <MetricCard label="All reviews" value={counts.all.toLocaleString('en-US')} sub="Written by buyers" tone="ink" href={href('all')} />
      </section>

      <PendingNavProvider>
        <div className="mt-4 mb-4 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedNav
            label="Review views"
            activeKey={view}
            items={VIEWS.map((v) => ({ key: v.value, label: v.label, count: counts[v.count], href: href(v.value) }))}
          />
          <SearchBox action="/admin/reviews" params={{ view }} defaultValue={q} placeholder="Product, text or buyer…" />
        </div>

        <PendingContent fallback={<div className="h-64 animate-pulse rounded-2xl border border-stone-200 bg-white" />}>
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
        </PendingContent>
      </PendingNavProvider>
    </>
  );
}

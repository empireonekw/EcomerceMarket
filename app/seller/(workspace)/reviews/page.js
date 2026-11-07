import Link from 'next/link';
import { Flag, MessageSquareText, Star } from 'lucide-react';
import { PageHeader, StatCard, EmptyState } from '@/components/dashboard/ui';
import SellerReviewList from '@/components/seller/SellerReviewList';
import { requireSellerStore } from '@/lib/auth';
import { getSellerReviews } from '@/lib/data/reviews';

export const metadata = { title: 'Reviews' };

const FILTERS = [
  { value: 'all', label: 'All reviews' },
  { value: 'low', label: '1–2 stars' },
  { value: 'reported', label: 'Reported' },
];

/** Seller → Reviews: what buyers said about the shop's products, with "Report" for reviews that break the rules. */
export default async function SellerReviewsPage({ searchParams }) {
  const seller = await requireSellerStore('/seller/reviews');
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.value === sp.filter) ? sp.filter : 'all';
  const { items, summary } = await getSellerReviews(seller.id, { filter });

  return (
    <>
      <PageHeader title="Reviews" description="What buyers say about your products. Report a review to Sellpify if it’s fake or breaks the rules." />

      <section aria-label="Review totals" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Average rating" value={summary.count ? summary.average.toFixed(1) : '–'} sub={summary.count ? 'out of 5 stars' : 'No reviews yet'} icon={Star} featured />
        <StatCard label="Reviews" value={summary.count.toLocaleString('en-US')} sub="From verified buyers" icon={MessageSquareText} tone="info" />
        <StatCard label="Reported" value={summary.reported.toLocaleString('en-US')} sub="Waiting for Sellpify" icon={Flag} tone={summary.reported ? 'warning' : 'positive'} />
      </section>

      <nav aria-label="Filter reviews" className="mb-4 mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === 'all' ? '/seller/reviews' : `/seller/reviews?filter=${f.value}`}
            aria-current={filter === f.value ? 'page' : undefined}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${filter === f.value ? 'border-ink bg-ink text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-ink'}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState title={filter === 'all' ? 'No reviews yet' : 'Nothing here'}>
          {filter === 'all' ? 'Reviews from buyers of your products appear here.' : 'No reviews match this filter.'}
        </EmptyState>
      ) : (
        <SellerReviewList items={items} />
      )}
    </>
  );
}

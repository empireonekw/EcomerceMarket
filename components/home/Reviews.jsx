import ReviewCard from '@/components/home/ReviewCard';
import SectionHeading from '@/components/home/SectionHeading';
import Stars from '@/components/Stars';
import { getFeaturedReviews } from '@/lib/data/reviews';
import { publicName } from '@/lib/utils';

const monthsAgo = (n) => new Date(Date.UTC(2026, 9 - n, 12)).toISOString();

// Sample reviews for the UI. Shown until the first real review (from a verified buyer) exists,
// then replaced automatically. Edit or remove them here.
const SAMPLE_REVIEWS = [
  {
    _id: 'sample-1',
    rating: 5,
    body: 'Clean, consistent icons that dropped straight into our design system. Saved our team days of work on the dashboard redesign.',
    authorName: 'Sarah Mitchell',
    productTitle: 'Line Icons Pro: 2,400 Icons',
    purchasedAt: monthsAgo(2),
    createdAt: monthsAgo(1),
  },
  {
    _id: 'sample-2',
    rating: 5,
    body: 'Finally a Notion setup that actually fits how freelancers work. Client tracking, invoices and projects in one place.',
    authorName: 'Daniel Okafor',
    productTitle: 'Notion Freelancer OS',
    purchasedAt: monthsAgo(3),
    createdAt: monthsAgo(2),
  },
  {
    _id: 'sample-3',
    rating: 4,
    body: 'Beautiful sections and easy to customise. I launched my product page in an afternoon. Would love a few more pricing layouts.',
    authorName: 'Priya Sharma',
    productTitle: 'SaaS Landing Page Kit',
    purchasedAt: monthsAgo(2),
    createdAt: monthsAgo(2),
  },
  {
    _id: 'sample-4',
    rating: 5,
    body: 'The clearest explanation of design tokens and component APIs I have read. Practical, well structured and worth every cent.',
    authorName: 'Lucas Fernández',
    productTitle: 'Design Systems Handbook',
    purchasedAt: monthsAgo(4),
    createdAt: monthsAgo(3),
  },
  {
    _id: 'sample-5',
    rating: 5,
    body: 'Converted three thousand product photos to WebP in minutes. Simple, fast and it runs locally, which our client required.',
    authorName: 'Emma Johansson',
    productTitle: 'Batch Image Optimizer',
    purchasedAt: monthsAgo(1),
    createdAt: monthsAgo(1),
  },
  {
    _id: 'sample-6',
    rating: 4,
    body: 'Great variety of shapes for social posts and presentations. The SVGs are tidy and recolour perfectly in Figma.',
    authorName: 'Omar Haddad',
    productTitle: 'Abstract Shapes Vector Pack',
    purchasedAt: monthsAgo(3),
    createdAt: monthsAgo(2),
  },
];

const SAMPLES = {
  items: SAMPLE_REVIEWS.map((r) => ({ ...r, authorName: publicName(r.authorName) })), // same style as real reviews
  count: SAMPLE_REVIEWS.length,
  average: SAMPLE_REVIEWS.reduce((sum, r) => sum + r.rating, 0) / SAMPLE_REVIEWS.length,
};

/** Homepage "Loved by buyers": real reviews when there are any, otherwise the samples above. */
export default async function Reviews() {
  // A database hiccup shows the sample reviews instead of breaking the homepage.
  const real = await getFeaturedReviews(6).catch((err) => {
    console.error('[home] reviews unavailable', err);
    return { items: [] };
  });
  const reviews = real.items.length > 0 ? real : SAMPLES;

  return (
    <section className="container-page relative isolate pt-24 sm:pt-32" aria-labelledby="reviews-heading">
      <span aria-hidden="true" className="pointer-events-none absolute top-12 right-4 -z-10 font-serif text-[12rem] leading-none text-brand-200 select-none sm:right-10 sm:text-[16rem]">“</span>
      <SectionHeading
        id="reviews-heading"
        eyebrow="Reviews"
        title="Loved by buyers"
        description={
          <>
            What customers say about their downloads.{' '}
            {/* Touch screens can't hover: say "tap" there, "hover" only where a mouse can. */}
            <span className="[@media(hover:hover)]:hidden">Tap a card to see who wrote it.</span>
            <span className="hidden [@media(hover:hover)]:inline">Hover over a card to see who wrote it.</span>
          </>
        }
      >
        <p className="flex items-center gap-2.5 text-sm text-stone-600">
          <Stars rating={reviews.average} size={18} />
          <span>
            <span className="font-medium text-black tabular-nums">{reviews.average.toFixed(1)}</span> average · {reviews.count} review
            {reviews.count === 1 ? '' : 's'}
          </span>
        </p>
      </SectionHeading>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {reviews.items.map((review) => (
          <ReviewCard key={review._id} review={review} />
        ))}
      </ul>
    </section>
  );
}

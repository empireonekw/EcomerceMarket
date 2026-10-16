// DESIGN PLACEHOLDERS — not real customers. Shown in the homepage "Loved by buyers" section only while
// SHOW_SAMPLE_REVIEWS=true AND no real review exists yet (lib/data/reviews.js). Turn the flag off before launch.

const monthsAgo = (n) => new Date(Date.UTC(2026, 9 - n, 12)).toISOString();

export const SAMPLE_REVIEWS = [
  {
    _id: 'sample-1',
    rating: 5,
    body: 'Clean, consistent icons that dropped straight into our design system. Saved our team days of work on the dashboard redesign.',
    authorName: 'Sarah Mitchell',
    productTitle: 'Line Icons Pro — 2,400 Icons',
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
    body: 'Beautiful sections and easy to customise. I launched my product page in an afternoon — would love a few more pricing layouts.',
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

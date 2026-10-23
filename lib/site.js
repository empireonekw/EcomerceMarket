export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || 'Sellpify',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  // Shown on /contact, the legal pages and the About page. Set both before launch.
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@ecomercemarket.com',
  // The person or registered business that owns and runs the marketplace (About, Terms, Privacy).
  operator: process.env.NEXT_PUBLIC_SITE_OPERATOR || 'the Sellpify team',
  description:
    'Premium templates, e-books, software and vector packs from independent creators. Instant digital delivery.',
  // Category slugs here must match the Category documents in MongoDB (see scripts/seed.js).
  navCategories: [
    { label: 'Templates', slug: 'templates' },
    { label: 'E-books', slug: 'ebooks' },
    { label: 'Software', slug: 'software' },
    { label: 'Vector Packs', slug: 'vector-packs' },
  ],
  // Primary navigation. `match` decides which link gets the active pill.
  mainNav: [
    { label: 'Home', href: '/', match: (p) => p === '/' },
    { label: 'Shop', href: '/products', match: (p) => p.startsWith('/products'), dropdown: true },
    { label: 'About Us', href: '/about', match: (p) => p.startsWith('/about') },
    { label: 'Blog', href: '/blog', match: (p) => p.startsWith('/blog') },
  ],
  sellCta: { label: 'Sell With Us', href: '/sell/signup' },
};

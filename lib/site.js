export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || 'Sellpify',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  // Shown on /contact, the legal pages and the About page. Set both before launch.
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@sellpify.com',
  // The person or registered business that owns and runs the marketplace (About, Terms, Privacy).
  operator: process.env.NEXT_PUBLIC_SITE_OPERATOR || 'the Sellpify team',
  description: 'Digital products, physical goods and services from independent creators — one marketplace, secure checkout.',
  // Social profiles shown as icons in the footer. Replace with your real profile URLs (or set the env vars);
  // remove a line to hide that icon.
  social: [
    { label: 'Instagram', icon: 'instagram', href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || 'https://www.instagram.com/sellpify' },
    { label: 'Facebook', icon: 'facebook', href: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK || 'https://www.facebook.com/sellpify' },
    { label: 'X', icon: 'x', href: process.env.NEXT_PUBLIC_SOCIAL_X || 'https://x.com/sellpify' },
    { label: 'Pinterest', icon: 'pinterest', href: process.env.NEXT_PUBLIC_SOCIAL_PINTEREST || 'https://www.pinterest.com/sellpify' },
    { label: 'YouTube', icon: 'youtube', href: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE || 'https://www.youtube.com/@sellpify' },
    { label: 'LinkedIn', icon: 'linkedin', href: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN || 'https://www.linkedin.com/company/sellpify' },
  ],
  // Optional postal address shown in the footer (leave unset to hide).
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || '',
  // Primary navigation. `match` decides which link gets the active pill.
  mainNav: [
    { label: 'Home', href: '/', match: (p) => p === '/' },
    { label: 'Shop', href: '/products', match: (p) => p.startsWith('/products'), dropdown: true },
    { label: 'About Us', href: '/about', match: (p) => p.startsWith('/about') },
    { label: 'Blog', href: '/blog', match: (p) => p.startsWith('/blog') },
  ],
  sellCta: { label: 'Sell With Us', href: '/sell/signup' },
};

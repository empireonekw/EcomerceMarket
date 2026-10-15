import Link from 'next/link';
import { BadgeCheck, Download, Infinity as InfinityIcon, Lock } from 'lucide-react';
import Logo from '@/components/Logo';
import { siteConfig } from '@/lib/site';

const TRUST = [
  { icon: Download, title: 'Instant delivery', text: 'Download links the moment payment clears.' },
  { icon: Lock, title: 'Secure payments', text: 'Encrypted checkout — we never store card details.' },
  { icon: InfinityIcon, title: 'Lifetime access', text: 'Re-download your purchases any time.' },
  { icon: BadgeCheck, title: 'Verified creators', text: 'Every product is reviewed before it goes live.' },
];

const LINK_GROUPS = [
  {
    title: 'Shop',
    links: siteConfig.navCategories.map((c) => ({ label: c.label, href: `/products?category=${c.slug}` })),
  },
  {
    title: 'Discover',
    links: [
      { label: 'All products', href: '/products' },
      { label: 'Best sellers', href: '/products?sort=popular' },
      { label: 'New arrivals', href: '/products?sort=newest' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Sell With Us', href: '/sell' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-24 sm:mt-32">
      {/* ---------- Closing call to action ---------- */}
      <div className="container-page">
        <div className="flex flex-col items-start gap-8 rounded-2xl bg-stone-100 px-6 py-12 sm:px-12 sm:py-16 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="headline text-4xl leading-[1.08] text-balance sm:text-5xl">Have something worth selling?</h2>
            <p className="mt-4 text-lg text-stone-600">Open a store in minutes and reach buyers looking for exactly what you make.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/sell" className="btn btn-lg btn-primary">
              Start selling
            </Link>
            <Link href="/products" className="btn btn-lg btn-outline">
              Browse products
            </Link>
          </div>
        </div>
      </div>

      <div className="container-page">
        <ul className="grid gap-8 border-b border-stone-200 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
              <p className="mt-3 font-medium">{title}</p>
              <p className="mt-1 text-sm text-stone-500">{text}</p>
            </li>
          ))}
        </ul>

        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone-500">{siteConfig.description}</p>
          </div>

          {LINK_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <p className="text-sm text-stone-500">{group.title}</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {group.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-black transition-colors hover:text-brand-600">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-stone-200">
        <div className="container-page flex flex-col gap-3 py-6 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <nav aria-label="Legal" className="flex gap-6">
            <Link href="/terms" className="hover:text-black">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-black">
              Privacy Policy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

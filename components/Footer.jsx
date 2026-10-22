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
      { label: 'Sell With Us', href: '/sell/signup' },
    ],
  },
];

const LEGAL = [
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
];

/**
 * Site footer: a wave out of the white page into a warm beige block — call to action, trust points,
 * link columns, then the brand line and a slim legal bar. Pure server markup (no client JS).
 */
export default function Footer() {
  return (
    <footer className="mt-24 text-ink sm:mt-32">
      {/* Wavy top edge (same colour as the block below, so the two read as one shape). */}
      <svg aria-hidden="true" viewBox="0 0 1440 90" preserveAspectRatio="none" className="block h-10 w-full text-beige sm:h-16 lg:h-20">
        <path d="M0 52C190 18 380 6 600 22s420 58 640 52c80-2 150-12 200-22v38H0Z" fill="currentColor" />
      </svg>

      <div className="-mt-px bg-beige">
        <div className="container-page pb-10 pt-10 sm:pt-14">
          <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
            {/* ---------- Call to action + trust points ---------- */}
            <div className="lg:col-span-6">
              <h2 className="headline text-4xl leading-[1.05] text-balance sm:text-5xl lg:text-[3.5rem]">Have something worth selling?</h2>
              <p className="mt-4 max-w-lg text-lg text-stone-600">Open a store in minutes and reach buyers looking for exactly what you make.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/sell/signup" className="btn btn-lg btn-primary">
                  Start selling
                </Link>
                <Link href="/products" className="btn btn-lg border border-stone-400/60 text-black hover:border-black hover:bg-white/60">
                  Browse products
                </Link>
              </div>

              <ul className="mt-12 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {TRUST.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-brand-600">
                      <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="mt-0.5 text-sm text-stone-600">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* ---------- Link columns ---------- */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:col-span-6 lg:justify-items-end">
              {LINK_GROUPS.map((group) => (
                <nav key={group.title} aria-label={group.title} className="lg:min-w-36">
                  <p className="headline text-2xl">{group.title}</p>
                  <ul className="mt-5 space-y-3.5">
                    {group.links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className="text-[15px] text-stone-700 transition-colors hover:text-black hover:underline hover:underline-offset-4">
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </div>

          {/* ---------- Brand line ---------- */}
          <div className="mt-16 max-w-sm">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed text-stone-600">{siteConfig.description}</p>
          </div>

          {/* ---------- Legal bar ---------- */}
          <div className="mt-10 flex flex-col gap-3 border-t border-beige-dark pt-6 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
            </p>
            <nav aria-label="Legal">
              <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {LEGAL.map((l, i) => (
                  <li key={l.href} className="flex items-center gap-3">
                    {i > 0 && <span aria-hidden="true" className="size-1 rounded-full bg-stone-400" />}
                    <Link href={l.href} className="transition-colors hover:text-black">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

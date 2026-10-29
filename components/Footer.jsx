import Link from 'next/link';
import { BadgeCheck, Clock, Download, Infinity as InfinityIcon, Lock, Mail, MapPin, MessageSquare } from 'lucide-react';
import Logo from '@/components/Logo';
import { categoryHref } from '@/lib/category-tree';
import { getCategories } from '@/lib/data/categories';
import { siteConfig } from '@/lib/site';

const TRUST = [
  { icon: Download, title: 'Instant delivery', text: 'Download links the moment payment clears.' },
  { icon: Lock, title: 'Secure payments', text: 'Encrypted checkout — we never store card details.' },
  { icon: InfinityIcon, title: 'Lifetime access', text: 'Re-download your purchases any time.' },
  { icon: BadgeCheck, title: 'Verified creators', text: 'Every product is reviewed before it goes live.' },
];

/** Main categories for the Shop column (cached list); a database hiccup falls back to "All products" only. */
async function shopLinks() {
  try {
    return (await getCategories()).filter((c) => !c.parent).slice(0, 6).map((c) => ({ label: c.name, href: categoryHref(c) }));
  } catch (err) {
    console.error('[Footer] categories unavailable', err);
    return [];
  }
}

const LINK_GROUPS = [
  {
    title: 'Discover',
    links: [
      { label: 'All products', href: '/products' },
      { label: 'Best sellers', href: '/products?sort=popular' },
      { label: 'New arrivals', href: '/products?sort=newest' },
      { label: 'How it works', href: '/how-it-works' },
      { label: 'Help & FAQ', href: '/help' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact Us', href: '/contact' },
      { label: 'Sell With Us', href: '/sell/signup' },
      { label: 'Seller Agreement', href: '/legal/seller-agreement' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Refund Policy', href: '/legal/refund-policy' },
      { label: 'Cookie Policy', href: '/legal/cookie-policy' },
      { label: 'Acceptable Use', href: '/legal/acceptable-use' },
      { label: 'Copyright & DMCA', href: '/legal/copyright' },
      { label: 'Licensing', href: '/legal/licensing' },
      { label: 'Accessibility', href: '/legal/accessibility' },
      { label: 'Security', href: '/legal/security' },
    ],
  },
];

const LEGAL_BAR = [
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Cookies', href: '/legal/cookie-policy' },
  { label: 'Legal Center', href: '/legal' },
];

// Line-style brand marks (24px grid, stroked like the Lucide icons used elsewhere).
const SOCIAL_ICONS = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </>
  ),
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" strokeLinejoin="round" />,
  x: <path d="M4 4l11.7 16H20L8.3 4zM4 20l6.8-6.8M20 4l-6.8 6.8" strokeLinecap="round" strokeLinejoin="round" />,
  pinterest: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 20l4-9M10.7 14c.4 1.3 1.4 2 2.6 2 2 0 3.7-1.6 3.7-4a5 5 0 1 0-9.7 1.7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  youtube: (
    <>
      <path d="M2.5 17a24 24 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24 24 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" strokeLinejoin="round" />
    </>
  ),
  linkedin: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" strokeLinejoin="round" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
};

/**
 * Site footer: a wave out of the white page into a warm beige block — call to action and trust points beside four
 * link columns (Shop, Discover, Company, Legal) with a contact + social panel under them, then the brand line and a
 * slim legal bar. Pure server markup (no client JS).
 */
export default async function Footer() {
  const shop = await shopLinks();
  const groups = [{ title: 'Shop', links: [...shop, { label: 'Shop all', href: '/products' }] }, ...LINK_GROUPS];
  const { supportEmail, address, social } = siteConfig;

  return (
    <footer className="mt-24 text-ink sm:mt-32">
      {/* Wavy top edge (same colour as the block below, so the two read as one shape). */}
      <svg aria-hidden="true" viewBox="0 0 1440 90" preserveAspectRatio="none" className="block h-10 w-full text-beige sm:h-16 lg:h-20">
        <path d="M0 52C190 18 380 6 600 22s420 58 640 52c80-2 150-12 200-22v38H0Z" fill="currentColor" />
      </svg>

      <div className="-mt-px bg-beige">
        <div className="container-page pb-10 pt-10 sm:pt-14">
          <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
            {/* ---------- Call to action + trust points ---------- */}
            <div className="lg:col-span-5">
              <h2 className="font-serif text-4xl font-normal leading-[1.05] tracking-tight text-balance sm:text-5xl">Have something worth selling?</h2>
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
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-gray-900">
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

            <div className="lg:col-span-7">
              {/* ---------- Link columns ---------- */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
                {groups.map((group) => (
                  <nav key={group.title} aria-label={group.title}>
                    <p className="font-serif text-xl tracking-tight">{group.title}</p>
                    <ul className="mt-5 space-y-3">
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

              {/* ---------- Contact + social ---------- */}
              <div className="mt-12 grid gap-8 rounded-2xl bg-white/60 p-6 sm:grid-cols-2 sm:p-8">
                <div>
                  <p className="font-serif text-xl tracking-tight">Get in touch</p>
                  <ul className="mt-4 space-y-3 text-[15px] text-stone-700">
                    <li className="flex items-center gap-3">
                      <Mail size={17} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-stone-500" />
                      <a href={`mailto:${supportEmail}`} className="hover:text-black hover:underline hover:underline-offset-4">
                        {supportEmail}
                      </a>
                    </li>
                    <li className="flex items-center gap-3">
                      <MessageSquare size={17} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-stone-500" />
                      <Link href="/contact" className="hover:text-black hover:underline hover:underline-offset-4">
                        Send us a message
                      </Link>
                    </li>
                    <li className="flex items-center gap-3">
                      <Clock size={17} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-stone-500" />
                      Replies within 1–2 business days
                    </li>
                    {address && (
                      <li className="flex items-start gap-3">
                        <MapPin size={17} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-stone-500" />
                        <address className="not-italic">{address}</address>
                      </li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="font-serif text-xl tracking-tight">Follow us</p>
                  <p className="mt-2 text-sm text-stone-600">New drops, creator stories and tips.</p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {social.map((s) => (
                      <li key={s.icon}>
                        <a
                          href={s.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${siteConfig.name} on ${s.label}`}
                          className="grid size-10 place-items-center rounded-full border border-stone-300/70 bg-white text-stone-700 transition-colors hover:border-gray-900 hover:bg-gray-900 hover:text-white"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75">
                            {SOCIAL_ICONS[s.icon]}
                          </svg>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
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
                {LEGAL_BAR.map((l, i) => (
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

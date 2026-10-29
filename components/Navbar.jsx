import Link from 'next/link';
import DesktopNav from '@/components/nav/DesktopNav';
import MobileMenu from '@/components/nav/MobileMenu';
import NavSearch from '@/components/nav/NavSearch';
import CartToast from '@/components/CartToast';
import CartBadge from '@/components/CartBadge';
import Logo from '@/components/Logo';
import UserMenu from '@/components/UserMenu';
import InboxLink from '@/components/messages/InboxLink';
import { getCategories } from '@/lib/data/categories';
import { siteConfig } from '@/lib/site';

async function loadCategories() {
  try {
    return await getCategories(); // cached (unstable_cache) — no DB hit per request
  } catch (err) {
    // The header must never take the whole page down: show it without the category list.
    console.error('[Navbar] categories unavailable', err);
    return [];
  }
}

/** Compact dark strip above the header. Scrolls away; only the main bar is sticky. */
function AnnouncementBar() {
  return (
    <div className="bg-black text-white">
      {/* truncate: always a single compact line, even on the narrowest phones. */}
      <p className="container-page truncate py-1.5 text-center text-xs leading-5">
        <span className="hidden sm:inline">
          {siteConfig.name}
          <span aria-hidden="true" className="mx-2 text-white/40">
            |
          </span>
          Instant Digital Downloads &amp; Secure Delivery.{' '}
        </span>
        <span className="sm:hidden">Instant Downloads &amp; Secure Delivery. </span>
        <span className="hidden md:inline">Explore this week’s new drops </span>
        <Link href="/products" className="font-medium underline underline-offset-2 transition-colors hover:text-stone-300">
          <span className="sm:hidden">New drops →</span>
          <span className="hidden sm:inline">
            <span className="md:hidden">New drops </span>right here.
          </span>
        </Link>
      </p>
    </div>
  );
}

/**
 * Storefront header: compact announcement strip + sticky bar on the warm paper tone of the homepage hero.
 * Server Component; the interactive parts (active link, Shop dropdown, account menu, cart badge,
 * mobile menu) are small client islands, so the shell renders instantly and pages stay static.
 */
export default async function Navbar() {
  const categories = (await loadCategories()).filter((c) => !c.parent); // main categories only

  return (
    <>
      <AnnouncementBar />
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
        {/* 3 columns on desktop so the centre nav stays centred regardless of logo/utility widths. */}
        <div className="container-page relative flex items-center justify-between gap-4 py-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
          <Logo />

          <DesktopNav categories={categories} />

          <div className="flex items-center justify-end gap-0.5">
            <NavSearch className="mr-2 hidden md:block" />
            <InboxLink />
            <UserMenu />
            <CartBadge />
            <MobileMenu categories={categories} />
          </div>
        </div>
        <CartToast />
      </header>
    </>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// Set once the shopper has moved between pages of the store in this tab (client navigations don't change
// document.referrer), so "Back" knows there's a store page to go back to.
let movedWithinStore = false;

/** Mounted once in the shop layout: notes in-store page changes for <BackLink>. */
export function NavigationTracker() {
  const pathname = usePathname();
  const first = useRef(pathname);
  useEffect(() => {
    if (pathname !== first.current) movedWithinStore = true;
  }, [pathname]);
  return null;
}

/**
 * "← Back": returns to the page the shopper came from on this site (keeping their filters and scroll position), or
 * goes to `fallback` when they arrived from elsewhere (a search engine, a shared link).
 */
export default function BackLink({ fallback = '/products', className = '' }) {
  const router = useRouter();

  function back(e) {
    e.preventDefault();
    let fromHere = movedWithinStore;
    try {
      fromHere ||= Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
    } catch {}
    if (fromHere && window.history.length > 1) router.back();
    else router.push(fallback);
  }

  return (
    <a
      href={fallback}
      onClick={back}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white pr-3.5 pl-2.5 text-sm font-medium text-stone-700 transition-colors hover:border-ink hover:text-ink ${className}`}
    >
      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
      Back
    </a>
  );
}

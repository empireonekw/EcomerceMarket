'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NavSearch from '@/components/nav/NavSearch';
import { MobileAuthLinks } from '@/components/UserMenu';
import { siteConfig } from '@/lib/site';

/** Hamburger toggle + slide-down panel for screens below `lg`. */
export default function MobileMenu({ categories }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const rootRef = useRef(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onPointer = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const linkCls = (active) =>
    `flex items-center justify-between rounded-full px-4 py-2.5 text-[15px] transition-colors ${active ? 'bg-stone-100 text-black' : 'text-stone-600 hover:bg-stone-100 hover:text-black'}`;

  return (
    <div ref={rootRef} className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="grid size-10 place-items-center rounded-full text-stone-700 transition-colors hover:bg-stone-100 hover:text-black"
      >
        <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      <div
        id="mobile-menu"
        inert={!open}
        className={`absolute inset-x-0 top-full origin-top border-b border-stone-200 bg-white shadow-lg transition-[opacity,translate,visibility] duration-200 ${
          open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'
        }`}
      >
        <div className="container-page max-h-[calc(100dvh-7rem)] overflow-y-auto py-4">
          <NavSearch id="mobile-search" block className="mb-4" />
          <nav aria-label="Mobile">
            <ul className="space-y-0.5">
              {siteConfig.mainNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} aria-current={item.match(pathname) ? 'page' : undefined} className={linkCls(item.match(pathname))}>
                    {item.label}
                  </Link>
                  {item.dropdown && (
                    <ul className="mb-1 ml-3 border-l border-stone-200 pl-2">
                      {categories.map((c) => (
                        <li key={c.slug}>
                          <Link href={`/products?category=${c.slug}`} className="flex items-center justify-between rounded-full px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50 hover:text-black">
                            {c.name}
                            {c.productCount != null && <span className="text-xs text-stone-400">{c.productCount}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <Link
            href={siteConfig.sellCta.href}
            className="btn btn-lg btn-dark mt-4 w-full"
          >
            {siteConfig.sellCta.label}
          </Link>
          <div className="mt-4">
            <MobileAuthLinks />
          </div>
        </div>
      </div>
    </div>
  );
}
